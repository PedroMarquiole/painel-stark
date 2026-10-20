-- ════════════════════════════════════════════════════════════════════════════
-- Painel Stark · 0006 · Ingestão de pedidos + automações 1–5
--
--  site → Edge Function novo-pedido (valida formato, honeypot, ip_hash)
--       → registrar_lead(p)  [esta migration, transação única]:
--            idempotência → rate limit → validação → dedup do contato →
--            negócio aberto ou novo → responsável (regra 4) → lead + SLA →
--            confirmação ao cliente (regra 2) → aviso à equipe (regra 3)
--       → mensagens_saida → outbox-sender (Resend) via pg_net/pg_cron
--  pg_cron a cada 5 min → verificar_sla() (regra 5)
-- ════════════════════════════════════════════════════════════════════════════

insert into public.app_config (chave, valor, descricao) values
  ('atribuicao', '"rodizio"', 'rodizio = quem recebeu há mais tempo · servico = prioriza quem tem o serviço em servicos_foco'),
  ('whatsapp_ativo', 'false', 'Liga o envio por WhatsApp quando houver provedor contratado'),
  ('ingest_limite_10min', '5', 'Máximo de pedidos por IP (hash) a cada 10 minutos'),
  ('painel_url', '""', 'URL pública do painel, usada nos links de e-mail (preenchida no deploy)')
on conflict (chave) do nothing;

-- ─── Utilitários ────────────────────────────────────────────────────────────
create function public.formatar_protocolo(n bigint) returns text
language sql immutable as $$ select '#' || lpad(n::text, 4, '0') $$;

create function public.rotulo_servico(s public.servico) returns text
language sql immutable as $$
  select case s
    when 'sistemas_web' then 'Sistemas web'
    when 'aplicativo' then 'Aplicativo'
    when 'automacao_ia' then 'Automação e IA'
    when 'integracoes_apis' then 'Integrações e APIs'
    when 'dashboards' then 'Dashboards'
    when 'site_landing' then 'Site ou landing page'
    when 'loja_virtual' then 'Loja virtual'
    when 'evoluir_existente' then 'Evoluir o que já existe'
  end
$$;

-- "(11) 98765-4321" → "+5511987654321". Número inválido → null.
create function public.normalizar_whatsapp(t text) returns text
language sql immutable as $$
  select case
    when d = '' then null
    when btrim(t) like '+%' then case when length(d) between 8 and 15 then '+' || d end  -- DDI informado
    when length(d) in (10, 11) then '+55' || d                                          -- DDD + número
    when length(d) in (12, 13) and d like '55%' then '+' || d
    else null
  end
  from (select ltrim(regexp_replace(coalesce(t, ''), '\D', '', 'g'), '0') as d) x
$$;

-- {{chave}} → valor. Variáveis ausentes somem.
create function public.render_template(texto text, vars jsonb) returns text
language plpgsql immutable as $$
declare k text; v text; r text := texto;
begin
  if r is null then return null; end if;
  for k, v in select key, value from jsonb_each_text(coalesce(vars, '{}'::jsonb)) loop
    r := replace(r, '{{' || k || '}}', coalesce(v, ''));
  end loop;
  return regexp_replace(r, '\{\{[a-z_]+\}\}', '', 'g');
end $$;

-- Próximo instante dentro do horário comercial (dias úteis, janela de app_config).
create function public.proximo_horario_comercial(ts timestamptz default now()) returns timestamptz
language plpgsql stable set search_path = public as $$
declare
  cfg jsonb := (select valor from public.app_config where chave = 'horario_comercial');
  ini time := coalesce((cfg ->> 'inicio')::time, '08:00');
  fim time := coalesce((cfg ->> 'fim')::time, '19:00');
  loc timestamp := ts at time zone 'America/Sao_Paulo';
  d date := loc::date;
begin
  for _ in 1..30 loop
    if extract(isodow from d) < 6
       and not exists (select 1 from public.feriados f where f.data = d and f.conta_no_sla) then
      if loc < d + ini then return (d + ini) at time zone 'America/Sao_Paulo'; end if;
      if loc < d + fim then return loc at time zone 'America/Sao_Paulo'; end if;
    end if;
    d := d + 1;
    loc := d::timestamp;
  end loop;
  return ts;
end $$;

-- ─── Motor: execuções idempotentes e fila de mensagens ──────────────────────
-- Devolve o id da execução, ou null se a regra está desligada ou já rodou para esta ocorrência.
create function public.iniciar_execucao(
  p_automacao text, p_entidade_tipo text, p_entidade_id uuid,
  p_ocorrencia text default null, p_evento jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_aut uuid; v_id uuid;
begin
  select id into v_aut from public.automacoes where chave = p_automacao and ativa;
  if v_aut is null then return null; end if;
  insert into public.automacoes_execucoes (automacao_id, chave_idempotencia, entidade_tipo, entidade_id, evento, status, tentativas)
  values (v_aut,
          concat_ws(':', p_automacao, p_entidade_tipo, p_entidade_id::text, p_ocorrencia),
          p_entidade_tipo, p_entidade_id, p_evento, 'executando', 1)
  on conflict (chave_idempotencia) do nothing
  returning id into v_id;
  return v_id;
end $$;

create function public.concluir_execucao(p_id uuid, p_resultado jsonb default '{}'::jsonb, p_status text default 'sucesso')
returns void
language sql security definer set search_path = public as $$
  update public.automacoes_execucoes
     set status = p_status, resultado = p_resultado, finalizada_em = now()
   where id = p_id
$$;

create function public.enfileirar_mensagem(
  p_canal text, p_destino_tipo text, p_destinatario text, p_template text, p_vars jsonb,
  p_chave text, p_execucao uuid default null, p_contato uuid default null, p_profile uuid default null,
  p_agendar timestamptz default now()
) returns uuid
language plpgsql security definer set search_path = public as $$
declare t public.templates_mensagem%rowtype; v_id uuid; v_status text := 'pendente';
begin
  if p_destinatario is null then return null; end if;
  if p_canal = 'whatsapp' and not coalesce((select (valor #>> '{}')::boolean from public.app_config where chave = 'whatsapp_ativo'), false) then
    return null;
  end if;
  select * into t from public.templates_mensagem where chave = p_template and ativo;
  if not found then return null; end if;
  if p_contato is not null and exists (
       select 1 from public.contatos c where c.id = p_contato
        and ((p_canal = 'email' and c.opt_out_email) or (p_canal = 'whatsapp' and c.opt_out_whatsapp))) then
    v_status := 'bloqueada_opt_out';
  end if;
  insert into public.mensagens_saida (canal, destino_tipo, destinatario, contato_id, profile_id, template_chave,
                                      assunto, corpo, execucao_id, chave_idempotencia, status, agendada_para)
  values (p_canal, p_destino_tipo, p_destinatario, p_contato, p_profile, p_template,
          public.render_template(t.assunto, p_vars), public.render_template(t.corpo, p_vars),
          p_execucao, p_chave, v_status, p_agendar)
  on conflict (chave_idempotencia) do nothing
  returning id into v_id;
  return v_id;
end $$;

create function public.notificar(p_profiles uuid[], p_tipo text, p_titulo text, p_corpo text, p_link text)
returns int
language sql security definer set search_path = public as $$
  with ins as (
    insert into public.notificacoes (profile_id, tipo, titulo, corpo, link)
    select distinct unnest(p_profiles), p_tipo, p_titulo, p_corpo, p_link
    returning 1
  ) select count(*)::int from ins
$$;

create function public.ids_equipe(p_papeis public.papel_equipe[]) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}') from public.profiles where ativo and papel = any (p_papeis)
$$;

-- Regra 4: rodízio (quem recebeu lead há mais tempo) ou por serviço
create function public.escolher_responsavel(p_servicos public.servico[]) returns uuid
language sql stable security definer set search_path = public as $$
  select pr.id
    from public.profiles pr
   where pr.ativo and pr.papel in ('comercial', 'admin')
   order by
     case when (select valor #>> '{}' from public.app_config where chave = 'atribuicao') = 'servico'
               and pr.servicos_foco && p_servicos then 0 else 1 end,
     (select max(l.created_at) from public.leads l where l.responsavel_id = pr.id) asc nulls first,
     pr.created_at
   limit 1
$$;

-- ─── Ingestão ───────────────────────────────────────────────────────────────
-- Erros com códigos estáveis (a Edge Function traduz para mensagens ao visitante):
-- nome_invalido · email_invalido · whatsapp_invalido · descricao_invalida ·
-- consentimento_obrigatorio · servico_invalido · muitos_pedidos
create function public.registrar_lead(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_nome text := nullif(btrim(p ->> 'nome'), '');
  v_email text := lower(nullif(btrim(p ->> 'email'), ''));
  v_whats_raw text := nullif(btrim(p ->> 'whatsapp'), '');
  v_whats text := public.normalizar_whatsapp(p ->> 'whatsapp');
  v_empresa text := nullif(btrim(p ->> 'empresa'), '');
  v_dor text := nullif(btrim(coalesce(nullif(p ->> 'dor', ''), p ->> 'descricao')), '');
  v_origem_ing text := coalesce(nullif(p ->> 'origem_ingestao', ''), 'api');
  v_do_site boolean;
  v_chave text := nullif(p ->> 'chave_idempotencia', '');
  v_ip text := nullif(p ->> 'ip_hash', '');
  v_consentiu boolean := coalesce(p ->> 'consentimento', '') in ('true', 't', '1');
  v_janela timestamptz := date_trunc('hour', now()) + floor(extract(minute from now()) / 10) * interval '10 minutes';
  v_limite int := coalesce((select (valor #>> '{}')::int from public.app_config where chave = 'ingest_limite_10min'), 5);
  v_cont int;
  v_servicos public.servico[];
  v_situacao public.situacao_atual;
  v_contato public.contatos%rowtype;
  v_contato_novo boolean := false;
  v_negocio_id uuid;
  v_negocio_novo boolean := false;
  v_resp uuid;
  v_lead public.leads%rowtype;
  v_exec uuid;
  v_vars jsonb;
  v_painel text := coalesce((select valor #>> '{}' from public.app_config where chave = 'painel_url'), '');
  v_destinos uuid[];
  v_resp_email text;
begin
  v_do_site := v_origem_ing in ('api', 'netlify_forms', 'supabase_direct');

  -- 1) Idempotência: o mesmo envio devolve o mesmo protocolo
  if v_chave is not null then
    select * into v_lead from public.leads where chave_idempotencia = v_chave;
    if found then
      return jsonb_build_object('ok', true, 'numero', v_lead.protocolo, 'lead_id', v_lead.id, 'duplicado', true);
    end if;
  end if;

  -- 2) Anti-abuso por IP (hash). A exceção desfaz o incremento, mas o limite segue valendo.
  if v_ip is not null then
    insert into public.ingest_rate_limit (ip_hash, janela) values (v_ip, v_janela)
    on conflict (ip_hash, janela) do update set contagem = public.ingest_rate_limit.contagem + 1
    returning contagem into v_cont;
    if v_cont > v_limite then raise exception 'muitos_pedidos'; end if;
  end if;

  -- 3) Validação
  if v_nome is null or char_length(v_nome) not between 2 and 120 then raise exception 'nome_invalido'; end if;
  if v_email is null or char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' then
    raise exception 'email_invalido';
  end if;
  if (v_whats_raw is not null and v_whats is null) or (v_do_site and v_whats is null) then
    raise exception 'whatsapp_invalido';
  end if;
  if v_dor is null or char_length(v_dor) < 10 then raise exception 'descricao_invalida'; end if;
  v_dor := left(v_dor, 1200);
  if v_do_site and not v_consentiu then raise exception 'consentimento_obrigatorio'; end if;
  if jsonb_typeof(p -> 'servicos') is distinct from 'array' then raise exception 'servico_invalido'; end if;
  begin
    select coalesce(array_agg(distinct s::public.servico), '{}') into v_servicos
      from jsonb_array_elements_text(p -> 'servicos') s;
  exception when invalid_text_representation then
    raise exception 'servico_invalido';
  end;
  if cardinality(v_servicos) = 0 then raise exception 'servico_invalido'; end if;
  begin
    v_situacao := nullif(p ->> 'situacao_atual', '')::public.situacao_atual;
  exception when invalid_text_representation then
    v_situacao := null;
  end;

  -- 4) Deduplicação: mesmo e-mail ou mesmo WhatsApp = mesmo cliente
  select * into v_contato from public.contatos where email = v_email;
  if v_contato.id is null and v_whats is not null then
    select * into v_contato from public.contatos where whatsapp = v_whats;
  end if;

  if v_contato.id is null then
    insert into public.contatos (nome, email, whatsapp)
    values (v_nome, v_email, v_whats)
    returning * into v_contato;
    v_contato_novo := true;
  else
    update public.contatos c
       set email = coalesce(c.email, case when not exists (select 1 from public.contatos x where x.email = v_email) then v_email end),
           whatsapp = coalesce(c.whatsapp, case when not exists (select 1 from public.contatos x where x.whatsapp = v_whats) then v_whats end)
     where c.id = v_contato.id
    returning * into v_contato;
  end if;

  if v_empresa is not null and v_contato.empresa_id is null then
    select id into v_contato.empresa_id from public.empresas where lower(nome) = lower(v_empresa) limit 1;
    if v_contato.empresa_id is null then
      insert into public.empresas (nome) values (v_empresa) returning id into v_contato.empresa_id;
    end if;
    update public.contatos set empresa_id = v_contato.empresa_id where id = v_contato.id;
  end if;

  -- 5) Negócio: pedido novo de cliente com negócio aberto entra no mesmo negócio
  select n.id, n.responsavel_id into v_negocio_id, v_resp
    from public.negocios n
   where n.contato_id = v_contato.id and n.etapa not in ('ganho', 'perdido')
   order by n.created_at desc limit 1;

  if v_resp is not null and not exists (select 1 from public.profiles where id = v_resp and ativo) then v_resp := null; end if;
  if v_resp is null and v_contato.responsavel_id is not null
     and exists (select 1 from public.profiles where id = v_contato.responsavel_id and ativo) then
    v_resp := v_contato.responsavel_id;
  end if;
  if v_resp is null and exists (select 1 from public.automacoes where chave = 'lead_atribuir' and ativa) then
    v_resp := public.escolher_responsavel(v_servicos);
  end if;

  if v_negocio_id is null then
    insert into public.negocios (titulo, contato_id, empresa_id, responsavel_id, servicos)
    values (public.rotulo_servico(v_servicos[1]) || ' · ' || coalesce(v_empresa, v_nome),
            v_contato.id, v_contato.empresa_id, v_resp, v_servicos)
    returning id into v_negocio_id;
    v_negocio_novo := true;
  else
    update public.negocios n
       set servicos = (select array_agg(distinct x) from unnest(n.servicos || v_servicos) x),
           responsavel_id = coalesce(n.responsavel_id, v_resp)
     where n.id = v_negocio_id;
  end if;

  if v_contato.responsavel_id is null and v_resp is not null then
    update public.contatos set responsavel_id = v_resp where id = v_contato.id;
  end if;

  -- 6) O lead (protocolo e prazo do SLA vêm do banco)
  insert into public.leads (
    contato_id, negocio_id, responsavel_id, servicos, situacao_atual, dor,
    nome_informado, email_informado, whatsapp_informado, empresa_informada,
    porte, prazo, investimento, origem_informada, respostas_extras, consentimento_lgpd_em,
    respondeu_simulador, simulador,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content, referrer, landing_page,
    origem_ingestao, chave_idempotencia, user_agent, ip_hash, payload_bruto
  ) values (
    v_contato.id, v_negocio_id, v_resp, v_servicos, v_situacao, v_dor,
    v_nome, v_email, v_whats_raw, v_empresa,
    nullif(p ->> 'porte', ''), nullif(p ->> 'prazo', ''), nullif(p ->> 'investimento', ''),
    nullif(p ->> 'origem', ''), coalesce(p -> 'extras', '{}'::jsonb),
    case when v_consentiu then now() end,
    coalesce(jsonb_typeof(p -> 'simulador') = 'object', false), case when jsonb_typeof(p -> 'simulador') = 'object' then p -> 'simulador' end,
    left(nullif(p ->> 'utm_source', ''), 200), left(nullif(p ->> 'utm_medium', ''), 200),
    left(nullif(p ->> 'utm_campaign', ''), 200), left(nullif(p ->> 'utm_term', ''), 200),
    left(nullif(p ->> 'utm_content', ''), 200), left(nullif(p ->> 'referrer', ''), 500),
    left(nullif(p ->> 'landing_page', ''), 500),
    v_origem_ing, v_chave, left(nullif(p ->> 'user_agent', ''), 400), v_ip, p -> 'payload_bruto'
  ) returning * into v_lead;

  insert into public.atividades (tipo, canal, direcao, automatica, contato_id, negocio_id, lead_id, titulo, corpo, meta)
  values ('lead_recebido', 'sistema', 'entrada', true, v_contato.id, v_negocio_id, v_lead.id,
          format('Pedido %s recebido %s', public.formatar_protocolo(v_lead.protocolo),
                 case when v_do_site then 'pelo site' else 'manualmente' end),
          v_dor,
          jsonb_build_object('contato_novo', v_contato_novo, 'negocio_novo', v_negocio_novo, 'servicos', v_servicos));

  v_vars := jsonb_build_object(
    'nome', split_part(v_nome, ' ', 1),
    'nome_completo', v_nome,
    'protocolo', public.formatar_protocolo(v_lead.protocolo),
    'servicos', (select string_agg(public.rotulo_servico(s), ', ') from unnest(v_servicos) s),
    'dor', v_dor,
    'empresa', coalesce(v_empresa, '—'),
    'whatsapp', coalesce(v_whats, '—'),
    'email', v_email,
    'prazo_resposta', to_char(v_lead.sla_vence_em at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI'),
    'link', v_painel || '/leads?id=' || v_lead.id
  );

  -- Regra 1: processamento (IA e score entram na Fase 2)
  v_exec := public.iniciar_execucao('lead_processar', 'lead', v_lead.id);
  if v_exec is not null then
    perform public.concluir_execucao(v_exec, jsonb_build_object(
      'protocolo', v_lead.protocolo, 'contato_novo', v_contato_novo, 'negocio_novo', v_negocio_novo));
  end if;

  -- Regra 4: atribuição (registrada para o log; a escolha aconteceu acima)
  v_exec := public.iniciar_execucao('lead_atribuir', 'lead', v_lead.id);
  if v_exec is not null then
    perform public.concluir_execucao(v_exec, jsonb_build_object('responsavel_id', v_resp));
    if v_resp is not null then
      insert into public.atividades (tipo, canal, direcao, automatica, contato_id, negocio_id, lead_id, titulo)
      values ('atribuicao', 'sistema', 'interna', true, v_contato.id, v_negocio_id, v_lead.id,
              'Atribuído a ' || (select nome from public.profiles where id = v_resp));
    end if;
  end if;

  -- Regra 2: confirmação ao cliente (transacional: sai na hora, mesmo fora do expediente)
  v_exec := public.iniciar_execucao('lead_confirmacao_cliente', 'lead', v_lead.id);
  if v_exec is not null then
    perform public.enfileirar_mensagem('email', 'cliente', v_email, 'lead.confirmacao.email', v_vars,
      'lead_confirmacao_cliente:email:' || v_lead.id, v_exec, v_contato.id);
    perform public.enfileirar_mensagem('whatsapp', 'cliente', v_whats, 'lead.confirmacao.whatsapp', v_vars,
      'lead_confirmacao_cliente:whatsapp:' || v_lead.id, v_exec, v_contato.id);
    perform public.concluir_execucao(v_exec);
  end if;

  -- Regra 3: avisar a equipe (no painel para todos do comercial; e-mail para o responsável)
  v_exec := public.iniciar_execucao('lead_avisar_equipe', 'lead', v_lead.id);
  if v_exec is not null then
    v_destinos := public.ids_equipe(array['admin', 'comercial']::public.papel_equipe[]);
    perform public.notificar(v_destinos, 'lead_novo',
      format('Novo pedido %s · %s', public.formatar_protocolo(v_lead.protocolo), v_nome),
      left(v_dor, 160), '/leads?id=' || v_lead.id);
    for v_resp_email, v_destinos in
      select pr.email, array[pr.id] from public.profiles pr
       where pr.ativo and (pr.id = v_resp or (v_resp is null and pr.papel = 'admin'))
    loop
      perform public.enfileirar_mensagem('email', 'equipe', v_resp_email, 'lead.novo.equipe.email', v_vars,
        'lead_avisar_equipe:email:' || v_lead.id || ':' || v_destinos[1], v_exec, null, v_destinos[1]);
    end loop;
    perform public.concluir_execucao(v_exec, jsonb_build_object('notificados', cardinality(public.ids_equipe(array['admin', 'comercial']::public.papel_equipe[]))));
  end if;

  return jsonb_build_object(
    'ok', true, 'numero', v_lead.protocolo, 'lead_id', v_lead.id, 'contato_id', v_contato.id,
    'negocio_id', v_negocio_id, 'contato_novo', v_contato_novo, 'negocio_novo', v_negocio_novo,
    'duplicado', false,
    -- campos para o e-mail legado da Edge Function
    'nome', v_nome, 'empresa', v_empresa, 'email', v_email, 'whatsapp', v_whats,
    'servico', (select string_agg(public.rotulo_servico(s), ', ') from unnest(v_servicos) s),
    'descricao', v_dor);
end $$;

-- Lead criado à mão no painel (botão N): mesmas regras, origem "manual", sem consentimento obrigatório
create function public.criar_lead_manual(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.tem_papel('admin', 'comercial') then raise exception 'sem_permissao'; end if;
  return public.registrar_lead((p - 'chave_idempotencia' - 'ip_hash') || jsonb_build_object('origem_ingestao', 'manual'));
end $$;

-- Responder pelo painel: entra na fila e na linha do tempo (fecha o SLA — é resposta humana)
create function public.responder_lead(p_lead uuid, p_canal text, p_assunto text, p_corpo text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_lead public.leads%rowtype; v_contato public.contatos%rowtype; v_id uuid;
begin
  if not public.is_equipe() then raise exception 'sem_permissao'; end if;
  if p_canal not in ('email', 'whatsapp') then raise exception 'canal_invalido'; end if;
  if coalesce(btrim(p_corpo), '') = '' then raise exception 'mensagem_vazia'; end if;
  select * into v_lead from public.leads where id = p_lead;
  if not found then raise exception 'lead_nao_encontrado'; end if;
  select * into v_contato from public.contatos where id = v_lead.contato_id;
  if p_canal = 'whatsapp' and not coalesce((select (valor #>> '{}')::boolean from public.app_config where chave = 'whatsapp_ativo'), false) then
    raise exception 'whatsapp_desligado';
  end if;

  insert into public.mensagens_saida (canal, destino_tipo, destinatario, contato_id, profile_id, assunto, corpo,
                                      chave_idempotencia, status)
  values (p_canal, 'cliente', case p_canal when 'email' then v_contato.email else v_contato.whatsapp end,
          v_contato.id, auth.uid(), p_assunto, p_corpo, 'resposta:' || gen_random_uuid(),
          case when (p_canal = 'email' and v_contato.opt_out_email) or (p_canal = 'whatsapp' and v_contato.opt_out_whatsapp)
               then 'bloqueada_opt_out' else 'pendente' end)
  returning id into v_id;

  insert into public.atividades (tipo, canal, direcao, automatica, contato_id, negocio_id, lead_id, autor_id, titulo, corpo, meta)
  values ('mensagem', p_canal::public.canal, 'saida', false, v_contato.id, v_lead.negocio_id, v_lead.id, auth.uid(),
          coalesce(nullif(p_assunto, ''), 'Mensagem enviada'), p_corpo, jsonb_build_object('mensagem_id', v_id));
  return v_id;
end $$;

-- ─── Regra 5: alerta de SLA (pg_cron a cada 5 min) ──────────────────────────
create function public.verificar_sla() returns int
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_exec uuid;
  v_n int := 0;
  v_alerta interval := make_interval(hours => coalesce((select (valor #>> '{}')::int from public.app_config where chave = 'sla_alerta_horas'), 4));
  v_admins uuid[] := public.ids_equipe(array['admin']::public.papel_equipe[]);
  v_comercial uuid[] := public.ids_equipe(array['admin', 'comercial']::public.papel_equipe[]);
  v_painel text := coalesce((select valor #>> '{}' from public.app_config where chave = 'painel_url'), '');
begin
  for r in
    select l.id, l.protocolo, l.responsavel_id, l.sla_vence_em, l.nome_informado,
           l.sla_vence_em - now() as falta
      from public.leads l
     where l.primeira_resposta_em is null
       and l.status in ('novo', 'em_atendimento')
       and l.sla_vence_em - now() <= v_alerta
  loop
    -- 4h: responsável (ou comercial inteiro, se ninguém foi atribuído)
    v_exec := public.iniciar_execucao('sla_alerta', 'lead', r.id, '4h');
    if v_exec is not null then
      perform public.notificar(case when r.responsavel_id is null then v_comercial else array[r.responsavel_id] end, 'sla_vencendo',
        format('SLA vencendo · %s %s', public.formatar_protocolo(r.protocolo), r.nome_informado),
        'Menos de 4h para responder.', '/leads?id=' || r.id);
      perform public.enfileirar_mensagem('email', 'equipe', pr.email, 'sla.alerta.equipe.email',
          jsonb_build_object('protocolo', public.formatar_protocolo(r.protocolo), 'nome_completo', r.nome_informado,
                             'faltam', 'menos de 4h', 'link', v_painel || '/leads?id=' || r.id),
          'sla_alerta:4h:' || r.id || ':' || pr.id, v_exec, null, pr.id)
        from public.profiles pr where pr.ativo and pr.id = any (case when r.responsavel_id is null then v_comercial else array[r.responsavel_id] end);
      perform public.concluir_execucao(v_exec);
      v_n := v_n + 1;
    end if;

    -- 1h: admin
    if r.falta <= interval '1 hour' then
      v_exec := public.iniciar_execucao('sla_alerta', 'lead', r.id, '1h');
      if v_exec is not null then
        perform public.notificar(v_admins, 'sla_critico',
          format('SLA em 1h · %s %s', public.formatar_protocolo(r.protocolo), r.nome_informado),
          'Ninguém respondeu ainda.', '/leads?id=' || r.id);
        perform public.enfileirar_mensagem('email', 'equipe', pr.email, 'sla.alerta.equipe.email',
            jsonb_build_object('protocolo', public.formatar_protocolo(r.protocolo), 'nome_completo', r.nome_informado,
                               'faltam', 'menos de 1h', 'link', v_painel || '/leads?id=' || r.id),
            'sla_alerta:1h:' || r.id || ':' || pr.id, v_exec, null, pr.id)
          from public.profiles pr where pr.ativo and pr.id = any (v_admins);
        perform public.concluir_execucao(v_exec);
        v_n := v_n + 1;
      end if;
    end if;

    -- estourou: responsável + admin, uma vez
    if r.falta < interval '0' then
      v_exec := public.iniciar_execucao('sla_alerta', 'lead', r.id, 'estourado');
      if v_exec is not null then
        perform public.notificar(array_remove(array[r.responsavel_id], null) || v_admins, 'sla_estourado',
          format('SLA estourado · %s %s', public.formatar_protocolo(r.protocolo), r.nome_informado),
          'O prazo de 1 dia útil passou.', '/leads?id=' || r.id);
        perform public.concluir_execucao(v_exec);
        v_n := v_n + 1;
      end if;
    end if;
  end loop;
  return v_n;
end $$;

-- ─── Outbox: reserva e conclusão (usadas pela Edge Function outbox-sender) ──
create function public.reservar_mensagens(p_limite int default 20)
returns setof public.mensagens_saida
language sql security definer set search_path = public as $$
  update public.mensagens_saida m
     set status = 'enviando', tentativas = m.tentativas + 1
   where m.id in (
     select id from public.mensagens_saida
      where agendada_para <= now() and tentativas < max_tentativas
        and (status in ('pendente', 'erro')
             or (status = 'enviando' and agendada_para < now() - interval '10 minutes'))  -- travada
      order by agendada_para
      limit p_limite
      for update skip locked)
  returning m.*
$$;

create function public.concluir_mensagem(p_id uuid, p_ok boolean, p_provider text default null,
                                         p_provider_id text default null, p_erro text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare m public.mensagens_saida%rowtype;
begin
  if p_ok then
    update public.mensagens_saida
       set status = 'enviada', enviada_em = now(), provider = p_provider, provider_message_id = p_provider_id, erro = null
     where id = p_id
    returning * into m;
    -- mensagens automáticas ao cliente entram na linha do tempo (respostas humanas já entraram)
    if m.destino_tipo = 'cliente' and m.execucao_id is not null then
      insert into public.atividades (tipo, canal, direcao, automatica, contato_id, lead_id, titulo, corpo, meta)
      select 'mensagem', m.canal::public.canal, 'saida', true, m.contato_id,
             (select e.entidade_id from public.automacoes_execucoes e where e.id = m.execucao_id and e.entidade_tipo = 'lead'),
             coalesce(m.assunto, 'Mensagem automática'), m.corpo, jsonb_build_object('mensagem_id', m.id)
      where m.canal in ('email', 'whatsapp');
    end if;
  else
    -- nova tentativa com espera exponencial: 1, 2, 4, 8, 16 min
    update public.mensagens_saida
       set status = 'erro', erro = left(p_erro, 1000),
           agendada_para = now() + make_interval(mins => power(2, greatest(tentativas - 1, 0))::int)
     where id = p_id;
  end if;
end $$;

-- Dispara a Edge Function outbox-sender (pg_net). Sem pg_net/vault (ex.: testes), não faz nada.
create function public.disparar_outbox() returns void
language plpgsql security definer set search_path = public as $$
declare v_url text; v_segredo text;
begin
  if to_regnamespace('net') is null or to_regnamespace('vault') is null then return; end if;
  execute $q$ select decrypted_secret from vault.decrypted_secrets where name = 'outbox_url' $q$ into v_url;
  execute $q$ select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' $q$ into v_segredo;
  if v_url is null then return; end if;
  execute $q$ select net.http_post(url := $1, headers := $2, body := '{}'::jsonb, timeout_milliseconds := 10000) $q$
    using v_url, jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', coalesce(v_segredo, ''));
end $$;

create function public.mensagens_disparar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.disparar_outbox();
  return null;
end $$;
create trigger mensagens_saida_disparar after insert on public.mensagens_saida
  for each statement execute function public.mensagens_disparar();

-- ─── Agendamentos (só onde pg_cron existe) ──────────────────────────────────
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('stark-verificar-sla', '*/5 * * * *', 'select public.verificar_sla()');
    perform cron.schedule('stark-outbox', '* * * * *', 'select public.disparar_outbox()');
    perform cron.schedule('stark-limpar-rate-limit', '17 3 * * *',
      $q$delete from public.ingest_rate_limit where janela < now() - interval '1 day'$q$);
  end if;
end $$;

-- ─── Templates ──────────────────────────────────────────────────────────────
insert into public.templates_mensagem (chave, canal, destino, nome, assunto, corpo) values
('lead.confirmacao.email', 'email', 'cliente', 'Confirmação do pedido (e-mail)',
 'Recebemos seu pedido {{protocolo}} · Stark',
 E'Olá, {{nome}}!\n\nRecebemos seu pedido {{protocolo}} sobre {{servicos}}. Ele já está com a nossa equipe.\n\nVocê recebe um retorno nosso até {{prazo_resposta}} (1 dia útil), por e-mail e WhatsApp. Se a Stark não for a melhor escolha para o que você precisa, a gente fala isso com honestidade.\n\nO que você nos contou:\n“{{dor}}”\n\nSe quiser acrescentar algo, é só responder este e-mail.\n\nAbraço,\nEquipe Stark — Software sob medida'),
('lead.confirmacao.whatsapp', 'whatsapp', 'cliente', 'Confirmação do pedido (WhatsApp)', null,
 E'Olá, {{nome}}! Aqui é da Stark. Recebemos seu pedido {{protocolo}} e retornamos até {{prazo_resposta}}. Se quiser, já pode mandar mais detalhes por aqui.'),
('lead.novo.equipe.email', 'email', 'equipe', 'Novo pedido (equipe)',
 'Novo pedido {{protocolo}} · {{nome_completo}}',
 E'Novo pedido {{protocolo}} — responder até {{prazo_resposta}}.\n\nNome: {{nome_completo}}\nEmpresa: {{empresa}}\nE-mail: {{email}}\nWhatsApp: {{whatsapp}}\nServiços: {{servicos}}\n\nO que precisa:\n{{dor}}\n\nAbrir no painel: {{link}}'),
('sla.alerta.equipe.email', 'email', 'equipe', 'Alerta de SLA (equipe)',
 'SLA: {{faltam}} para responder {{protocolo}}',
 E'Faltam {{faltam}} para responder o pedido {{protocolo}} de {{nome_completo}} dentro do prazo prometido no site.\n\nAbrir no painel: {{link}}')
on conflict (chave) do nothing;

-- Fase 1 liga as regras 1–5
update public.automacoes set ativa = true where numero between 1 and 5;

-- ─── Permissões ─────────────────────────────────────────────────────────────
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = any (array[
       'formatar_protocolo', 'rotulo_servico', 'normalizar_whatsapp', 'render_template', 'proximo_horario_comercial',
       'iniciar_execucao', 'concluir_execucao', 'enfileirar_mensagem', 'notificar', 'ids_equipe', 'escolher_responsavel',
       'registrar_lead', 'criar_lead_manual', 'responder_lead', 'verificar_sla', 'reservar_mensagens',
       'concluir_mensagem', 'disparar_outbox', 'mensagens_disparar'])
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
grant execute on function public.criar_lead_manual(jsonb), public.responder_lead(uuid, text, text, text),
  public.formatar_protocolo(bigint), public.rotulo_servico(public.servico) to authenticated;
