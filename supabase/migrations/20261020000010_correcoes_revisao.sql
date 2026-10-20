-- ════════════════════════════════════════════════════════════════════════════
-- Painel Stark · 0010 · Correções da revisão adversarial da Fase 1
-- (só create or replace / alter / update: nada é removido)
-- ════════════════════════════════════════════════════════════════════════════

insert into public.app_config (chave, valor, descricao) values
  ('ingest_limite_global_10min', '60', 'Teto de pedidos do site somando todos os IPs a cada 10 minutos (anti-abuso)')
on conflict (chave) do nothing;

-- ─── Confirmação ao cliente sem texto livre do visitante (não vira relay de phishing) ─
update public.templates_mensagem
   set corpo = E'Olá, {{nome}}!\n\nRecebemos seu pedido {{protocolo}} sobre {{servicos}}. Ele já está com a nossa equipe.\n\nVocê recebe um retorno nosso até {{prazo_resposta}} (1 dia útil). Se a Stark não for a melhor escolha para o que você precisa, a gente fala isso com honestidade.\n\nSe quiser acrescentar algo, é só responder este e-mail.\n\nAbraço,\nEquipe Stark — Software sob medida'
 where chave = 'lead.confirmacao.email';

-- ─── Notificações só para quem está ativo ───────────────────────────────────
create or replace function public.notificar(p_profiles uuid[], p_tipo text, p_titulo text, p_corpo text, p_link text)
returns int
language sql security definer set search_path = public as $$
  with ins as (
    insert into public.notificacoes (profile_id, tipo, titulo, corpo, link)
    select distinct pr.id, p_tipo, p_titulo, p_corpo, p_link
      from unnest(p_profiles) u(id) join public.profiles pr on pr.id = u.id and pr.ativo
    returning 1
  ) select count(*)::int from ins
$$;

alter policy notificacoes_proprias on public.notificacoes using (profile_id = auth.uid() and (select public.is_equipe()));
alter policy notificacoes_marcar_lida on public.notificacoes
  using (profile_id = auth.uid() and (select public.is_equipe())) with check (profile_id = auth.uid());

-- ─── Ingestão ───────────────────────────────────────────────────────────────
create or replace function public.registrar_lead(p jsonb) returns jsonb
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
  v_ip text := coalesce(nullif(p ->> 'ip_hash', ''), 'sem-ip');
  v_consentiu boolean := coalesce(p ->> 'consentimento', '') in ('true', 't', '1');
  v_janela timestamptz := date_trunc('hour', now()) + floor(extract(minute from now()) / 10) * interval '10 minutes';
  v_limite int := coalesce((select (valor #>> '{}')::int from public.app_config where chave = 'ingest_limite_10min'), 5);
  v_limite_global int := coalesce((select (valor #>> '{}')::int from public.app_config where chave = 'ingest_limite_global_10min'), 60);
  v_cont int;
  v_servicos public.servico[];
  v_situacao public.situacao_atual;
  v_contato public.contatos%rowtype;
  v_contato_novo boolean := false;
  v_negocio_id uuid;
  v_negocio_novo boolean := false;
  v_resp uuid;
  v_resp_negocio uuid;
  v_lead public.leads%rowtype;
  v_exec uuid;
  v_vars jsonb;
  v_painel text := coalesce((select valor #>> '{}' from public.app_config where chave = 'painel_url'), '');
  v_destinos uuid[];
  v_resp_email text;
  v_nome_seguro text;
begin
  v_do_site := v_origem_ing in ('api', 'netlify_forms', 'supabase_direct');

  -- 1) Idempotência, serializada: dois envios simultâneos com a mesma chave viram 1 lead
  if v_chave is not null then
    perform pg_advisory_xact_lock(hashtext('lead:' || v_chave));
    select * into v_lead from public.leads where chave_idempotencia = v_chave;
    if found then
      return jsonb_build_object('ok', true, 'numero', v_lead.protocolo, 'lead_id', v_lead.id, 'duplicado', true);
    end if;
  end if;

  -- 2) Anti-abuso: por IP (hash) e um teto global. A exceção desfaz o incremento, mas o limite segue valendo.
  if v_do_site then
    insert into public.ingest_rate_limit (ip_hash, janela) values (v_ip, v_janela)
    on conflict (ip_hash, janela) do update set contagem = public.ingest_rate_limit.contagem + 1
    returning contagem into v_cont;
    if v_cont > v_limite then raise exception 'muitos_pedidos'; end if;
    insert into public.ingest_rate_limit (ip_hash, janela) values ('__global__', v_janela)
    on conflict (ip_hash, janela) do update set contagem = public.ingest_rate_limit.contagem + 1
    returning contagem into v_cont;
    if v_cont > v_limite_global then raise exception 'muitos_pedidos'; end if;
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

  -- 4) Deduplicação, serializada por e-mail e WhatsApp (evita corrida no unique)
  perform pg_advisory_xact_lock(hashtext('contato:' || v_email));
  if v_whats is not null then perform pg_advisory_xact_lock(hashtext('contato:' || v_whats)); end if;
  select * into v_contato from public.contatos where email = v_email;
  if v_contato.id is null and v_whats is not null then
    select * into v_contato from public.contatos where whatsapp = v_whats;
  end if;

  if v_contato.id is null then
    insert into public.contatos (nome, email, whatsapp)
    values (v_nome, v_email, v_whats)
    returning * into v_contato;
    v_contato_novo := true;
  elsif not v_do_site then
    -- Só a equipe completa canais vazios de um cliente existente. O formulário público não
    -- altera o cadastro (senão qualquer um anexaria o próprio e-mail/WhatsApp a um cliente).
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

  -- 5) Negócio aberto do cliente e responsável (sempre alguém ativo)
  select n.id, n.responsavel_id into v_negocio_id, v_resp_negocio
    from public.negocios n
   where n.contato_id = v_contato.id and n.etapa not in ('ganho', 'perdido')
   order by n.created_at desc limit 1;

  v_resp := case when exists (select 1 from public.profiles where id = v_resp_negocio and ativo) then v_resp_negocio end;
  if v_resp is null and exists (select 1 from public.profiles where id = v_contato.responsavel_id and ativo) then
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
           responsavel_id = case when exists (select 1 from public.profiles where id = n.responsavel_id and ativo)
                                 then n.responsavel_id else v_resp end
     where n.id = v_negocio_id;
  end if;

  if v_resp is not null and not exists (select 1 from public.profiles where id = v_contato.responsavel_id and ativo) then
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
    v_origem_ing, v_chave, left(nullif(p ->> 'user_agent', ''), 400), nullif(v_ip, 'sem-ip'), p -> 'payload_bruto'
  ) returning * into v_lead;

  insert into public.atividades (tipo, canal, direcao, automatica, contato_id, negocio_id, lead_id, titulo, corpo, meta)
  values ('lead_recebido', 'sistema', 'entrada', true, v_contato.id, v_negocio_id, v_lead.id,
          format('Pedido %s recebido %s', public.formatar_protocolo(v_lead.protocolo),
                 case when v_do_site then 'pelo site' else 'manualmente' end),
          v_dor,
          jsonb_build_object('contato_novo', v_contato_novo, 'negocio_novo', v_negocio_novo, 'servicos', v_servicos));

  -- Nome que vai para o e-mail do cliente: só letras (nada de URL/texto injetado)
  v_nome_seguro := nullif(left(regexp_replace(split_part(v_nome, ' ', 1), '[^[:alpha:]''-]', '', 'g'), 40), '');
  v_vars := jsonb_build_object(
    'nome', coalesce(v_nome_seguro, 'tudo bem'),
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

  v_exec := public.iniciar_execucao('lead_processar', 'lead', v_lead.id);
  if v_exec is not null then
    perform public.concluir_execucao(v_exec, jsonb_build_object(
      'protocolo', v_lead.protocolo, 'contato_novo', v_contato_novo, 'negocio_novo', v_negocio_novo));
  end if;

  v_exec := public.iniciar_execucao('lead_atribuir', 'lead', v_lead.id);
  if v_exec is not null then
    perform public.concluir_execucao(v_exec, jsonb_build_object('responsavel_id', v_resp));
    if v_resp is not null then
      insert into public.atividades (tipo, canal, direcao, automatica, contato_id, negocio_id, lead_id, titulo)
      values ('atribuicao', 'sistema', 'interna', true, v_contato.id, v_negocio_id, v_lead.id,
              'Atribuído a ' || (select nome from public.profiles where id = v_resp));
    end if;
  end if;

  -- Regra 2: no máximo 1 confirmação por destinatário por hora (anti-abuso do formulário público)
  v_exec := public.iniciar_execucao('lead_confirmacao_cliente', 'lead', v_lead.id);
  if v_exec is not null then
    if exists (select 1 from public.mensagens_saida m
                where m.destinatario = v_email and m.template_chave = 'lead.confirmacao.email'
                  and m.created_at > now() - interval '1 hour') then
      perform public.concluir_execucao(v_exec, jsonb_build_object('motivo', 'confirmacao_recente_para_o_mesmo_email'), 'ignorada');
    else
      perform public.enfileirar_mensagem('email', 'cliente', v_email, 'lead.confirmacao.email', v_vars,
        'lead_confirmacao_cliente:email:' || v_lead.id, v_exec, v_contato.id);
      perform public.enfileirar_mensagem('whatsapp', 'cliente', v_whats, 'lead.confirmacao.whatsapp', v_vars,
        'lead_confirmacao_cliente:whatsapp:' || v_lead.id, v_exec, v_contato.id);
      perform public.concluir_execucao(v_exec, jsonb_build_object('enfileirada', true));
    end if;
  end if;

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
    'duplicado', false);
end $$;

-- ─── Responder pelo painel: só admin/comercial; opt-out é erro (não fecha SLA nem finge envio) ─
create or replace function public.responder_lead(p_lead uuid, p_canal text, p_assunto text, p_corpo text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_lead public.leads%rowtype; v_contato public.contatos%rowtype; v_id uuid; v_destino text;
begin
  if not public.tem_papel('admin', 'comercial') then raise exception 'sem_permissao'; end if;
  if p_canal not in ('email', 'whatsapp') then raise exception 'canal_invalido'; end if;
  if coalesce(btrim(p_corpo), '') = '' then raise exception 'mensagem_vazia'; end if;
  select * into v_lead from public.leads where id = p_lead;
  if not found then raise exception 'lead_nao_encontrado'; end if;
  select * into v_contato from public.contatos where id = v_lead.contato_id;
  if p_canal = 'whatsapp' and not coalesce((select (valor #>> '{}')::boolean from public.app_config where chave = 'whatsapp_ativo'), false) then
    raise exception 'whatsapp_desligado';
  end if;
  if (p_canal = 'email' and v_contato.opt_out_email) or (p_canal = 'whatsapp' and v_contato.opt_out_whatsapp) then
    raise exception 'opt_out';
  end if;
  v_destino := case p_canal when 'email' then v_contato.email else v_contato.whatsapp end;
  if v_destino is null then raise exception 'sem_destino'; end if;

  insert into public.mensagens_saida (canal, destino_tipo, destinatario, contato_id, profile_id, assunto, corpo,
                                      chave_idempotencia, status)
  values (p_canal, 'cliente', v_destino, v_contato.id, auth.uid(), p_assunto, p_corpo, 'resposta:' || gen_random_uuid(), 'pendente')
  returning id into v_id;

  insert into public.atividades (tipo, canal, direcao, automatica, contato_id, negocio_id, lead_id, autor_id, titulo, corpo, meta)
  values ('mensagem', p_canal::public.canal, 'saida', false, v_contato.id, v_lead.negocio_id, v_lead.id, auth.uid(),
          coalesce(nullif(p_assunto, ''), 'Mensagem enviada'), p_corpo, jsonb_build_object('mensagem_id', v_id));
  return v_id;
end $$;

-- ─── Outbox: "travada" medida pela hora da reserva; falha definitiva fica visível ─
alter table public.mensagens_saida add column if not exists reservada_em timestamptz;

create or replace function public.reservar_mensagens(p_limite int default 20)
returns setof public.mensagens_saida
language sql security definer set search_path = public as $$
  update public.mensagens_saida m
     set status = 'enviando', tentativas = m.tentativas + 1, reservada_em = now()
   where m.id in (
     select id from public.mensagens_saida
      where agendada_para <= now() and tentativas < max_tentativas
        and (status in ('pendente', 'erro')
             or (status = 'enviando' and reservada_em < now() - interval '10 minutes'))
      order by agendada_para
      limit p_limite
      for update skip locked)
  returning m.*
$$;

create or replace function public.concluir_mensagem(p_id uuid, p_ok boolean, p_provider text default null,
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
    if m.destino_tipo = 'cliente' and m.execucao_id is not null then
      insert into public.atividades (tipo, canal, direcao, automatica, contato_id, lead_id, titulo, corpo, meta)
      select 'mensagem', m.canal::public.canal, 'saida', true, m.contato_id,
             (select e.entidade_id from public.automacoes_execucoes e where e.id = m.execucao_id and e.entidade_tipo = 'lead'),
             coalesce(m.assunto, 'Mensagem automática'), m.corpo, jsonb_build_object('mensagem_id', m.id)
      where m.canal in ('email', 'whatsapp');
    end if;
  else
    update public.mensagens_saida
       set status = 'erro', erro = left(p_erro, 1000),
           agendada_para = now() + make_interval(mins => power(2, greatest(tentativas - 1, 0))::int)
     where id = p_id
    returning * into m;
    -- Última tentativa: marca a execução como erro e avisa os admins (falha não fica invisível)
    if m.tentativas >= m.max_tentativas then
      if m.execucao_id is not null then
        update public.automacoes_execucoes set status = 'erro', erro = left(p_erro, 500), finalizada_em = now() where id = m.execucao_id;
      end if;
      perform public.notificar(public.ids_equipe(array['admin']::public.papel_equipe[]), 'envio_falhou',
        format('Falha ao enviar %s para %s', m.canal, m.destinatario), left(p_erro, 160), null);
    end if;
  end if;
end $$;

-- ─── Regra 5: um alerta por estágio, o mais grave que se aplica; ignora demonstração e inativos ─
create or replace function public.verificar_sla() returns int
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_exec uuid;
  v_n int := 0;
  v_alerta interval := make_interval(hours => coalesce((select (valor #>> '{}')::int from public.app_config where chave = 'sla_alerta_horas'), 4));
  v_admins uuid[] := public.ids_equipe(array['admin']::public.papel_equipe[]);
  v_comercial uuid[] := public.ids_equipe(array['admin', 'comercial']::public.papel_equipe[]);
  v_painel text := coalesce((select valor #>> '{}' from public.app_config where chave = 'painel_url'), '');
  v_destinos uuid[];
  v_estagio text;
  v_titulo text;
  v_texto text;
begin
  for r in
    select l.id, l.protocolo, l.sla_vence_em, l.nome_informado, l.sla_vence_em - now() as falta,
           case when exists (select 1 from public.profiles p where p.id = l.responsavel_id and p.ativo) then l.responsavel_id end as resp
      from public.leads l
     where l.primeira_resposta_em is null
       and l.status in ('novo', 'em_atendimento')
       and l.sla_vence_em - now() <= v_alerta
       and not exists (select 1 from public.demo_registros d where d.tabela = 'leads' and d.id = l.id)
  loop
    v_estagio := case when r.falta < interval '0' then 'estourado' when r.falta <= interval '1 hour' then '1h' else '4h' end;
    v_exec := public.iniciar_execucao('sla_alerta', 'lead', r.id, v_estagio);
    if v_exec is null then continue; end if;

    -- estágios menos graves que ficaram para trás não disparam depois
    if v_estagio in ('1h', 'estourado') then perform public.iniciar_execucao('sla_alerta', 'lead', r.id, '4h'); end if;
    if v_estagio = 'estourado' then perform public.iniciar_execucao('sla_alerta', 'lead', r.id, '1h'); end if;
    update public.automacoes_execucoes set status = 'ignorada', finalizada_em = now(), resultado = jsonb_build_object('motivo', 'estagio_mais_grave_ja_alertado')
     where entidade_id = r.id and status = 'executando' and id <> v_exec
       and chave_idempotencia like 'sla_alerta:lead:%';

    v_destinos := case
      when v_estagio = '4h' then case when r.resp is null then v_comercial else array[r.resp] end
      when v_estagio = '1h' then array_remove(array[r.resp], null) || v_admins
      else array_remove(array[r.resp], null) || v_admins end;
    v_titulo := case v_estagio when '4h' then 'SLA vencendo' when '1h' then 'SLA em 1h' else 'SLA estourado' end;
    v_texto := case v_estagio when '4h' then 'menos de 4h' when '1h' then 'menos de 1h' else 'prazo vencido' end;

    perform public.notificar(v_destinos, case v_estagio when '4h' then 'sla_vencendo' when '1h' then 'sla_critico' else 'sla_estourado' end,
      format('%s · %s %s', v_titulo, public.formatar_protocolo(r.protocolo), r.nome_informado),
      case v_estagio when 'estourado' then 'O prazo de 1 dia útil passou.' else 'Ninguém respondeu ainda: ' || v_texto || '.' end,
      '/leads?id=' || r.id);
    perform public.enfileirar_mensagem('email', 'equipe', pr.email, 'sla.alerta.equipe.email',
        jsonb_build_object('protocolo', public.formatar_protocolo(r.protocolo), 'nome_completo', r.nome_informado,
                           'faltam', v_texto, 'link', v_painel || '/leads?id=' || r.id),
        'sla_alerta:' || v_estagio || ':' || r.id || ':' || pr.id, v_exec, null, pr.id)
      from public.profiles pr where pr.ativo and pr.id = any (v_destinos);
    perform public.concluir_execucao(v_exec, jsonb_build_object('estagio', v_estagio));
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

update public.templates_mensagem
   set assunto = 'SLA: {{faltam}} · pedido {{protocolo}}',
       corpo = E'Pedido {{protocolo}} de {{nome_completo}} ainda sem resposta ({{faltam}}). O site promete retorno em até 1 dia útil.\n\nAbrir no painel: {{link}}'
 where chave = 'sla.alerta.equipe.email';

-- ─── Funções novas nascem privadas (inclusive para PUBLIC) ─────────────────
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke execute on function %s from public, anon', f);
  end loop;
end $$;
revoke execute on function public.registrar_lead(jsonb), public.verificar_sla(), public.reservar_mensagens(int),
  public.concluir_mensagem(uuid, boolean, text, text, text), public.notificar(uuid[], text, text, text, text) from authenticated;
grant execute on function public.registrar_lead(jsonb), public.verificar_sla(), public.reservar_mensagens(int),
  public.concluir_mensagem(uuid, boolean, text, text, text), public.notificar(uuid[], text, text, text, text) to service_role;
grant execute on function public.responder_lead(uuid, text, text, text), public.painel_indicadores(int) to authenticated;

-- ─── Indicadores: semanas e datas no fuso de São Paulo; descartados (spam/teste) fora do SLA ─
create or replace function public.painel_indicadores(p_dias int default 30) returns jsonb
language sql stable security invoker set search_path = public as $$
with
lim as (
  select now() - make_interval(days => p_dias) as ini,
         now() - make_interval(days => 2 * p_dias) as ini_ant,
         now() as fim
),
l as (
  select l.*, (l.created_at >= lim.ini) as atual, (l.created_at >= lim.ini_ant and l.created_at < lim.ini) as anterior
  from public.leads l, lim
  where l.created_at >= lim.ini_ant
),
resp as (
  select atual, anterior,
         avg(extract(epoch from (primeira_resposta_em - created_at)) / 3600.0)
           filter (where primeira_resposta_em is not null) as horas,
         count(*) filter (where primeira_resposta_em is not null and primeira_resposta_em <= sla_vence_em) as no_prazo,
         count(*) filter (where primeira_resposta_em is not null or sla_vence_em < now()) as decididos
  from l where status <> 'descartado' group by atual, anterior
),
neg as (
  select n.*,
         case when n.etapa = 'perdido'
              then coalesce((select (a.meta ->> 'de')::public.etapa_negocio from public.atividades a
                              where a.negocio_id = n.id and a.tipo = 'mudanca_etapa' and a.meta ->> 'para' = 'perdido'
                              order by a.ocorreu_em desc limit 1), 'novo')
              else n.etapa end as etapa_alcancada
  from public.negocios n
),
fechados as (
  select (coalesce(ganho_em, perdido_em) >= lim.ini) as atual, etapa, valor_estimado, created_at, ganho_em, motivo_perda
  from neg, lim
  where coalesce(ganho_em, perdido_em) >= lim.ini_ant
),
semanas as (
  select generate_series(date_trunc('week', now() at time zone 'America/Sao_Paulo') - interval '7 weeks',
                         date_trunc('week', now() at time zone 'America/Sao_Paulo'), interval '1 week') as semana
)
select jsonb_build_object(
  'dias', p_dias,
  'leads', jsonb_build_object('atual', (select count(*) from l where atual), 'anterior', (select count(*) from l where anterior)),
  'primeira_resposta_horas', jsonb_build_object(
     'atual', (select round(horas::numeric, 1) from resp where atual),
     'anterior', (select round(horas::numeric, 1) from resp where anterior)),
  'sla_pct', jsonb_build_object(
     'atual', (select round(100.0 * no_prazo / nullif(decididos, 0)) from resp where atual),
     'anterior', (select round(100.0 * no_prazo / nullif(decididos, 0)) from resp where anterior)),
  'ganhos', jsonb_build_object(
     'atual', (select count(*) from fechados where atual and etapa = 'ganho'),
     'anterior', (select count(*) from fechados where not atual and etapa = 'ganho')),
  'receita', jsonb_build_object(
     'atual', (select coalesce(sum(valor_estimado), 0) from fechados where atual and etapa = 'ganho'),
     'anterior', (select coalesce(sum(valor_estimado), 0) from fechados where not atual and etapa = 'ganho')),
  'ticket_medio', jsonb_build_object(
     'atual', (select round(avg(valor_estimado)) from fechados where atual and etapa = 'ganho'),
     'anterior', (select round(avg(valor_estimado)) from fechados where not atual and etapa = 'ganho')),
  'taxa_ganho_pct', jsonb_build_object(
     'atual', (select round(100.0 * count(*) filter (where etapa = 'ganho') / nullif(count(*), 0)) from fechados where atual),
     'anterior', (select round(100.0 * count(*) filter (where etapa = 'ganho') / nullif(count(*), 0)) from fechados where not atual)),
  'ciclo_dias', jsonb_build_object(
     'atual', (select round(avg(extract(epoch from ganho_em - created_at) / 86400.0)::numeric, 1) from fechados where atual and etapa = 'ganho'),
     'anterior', (select round(avg(extract(epoch from ganho_em - created_at) / 86400.0)::numeric, 1) from fechados where not atual and etapa = 'ganho')),
  'pipeline_ponderado', (select coalesce(round(sum(valor_estimado * probabilidade / 100.0)), 0)
                           from public.negocios where etapa not in ('ganho', 'perdido')),
  'pipeline_aberto', (select coalesce(sum(valor_estimado), 0) from public.negocios where etapa not in ('ganho', 'perdido')),
  'mrr', (select coalesce(sum(valor_mensal), 0) from public.contratos
           where tipo = 'recorrente' and status = 'ativo' and inicio <= (now() at time zone 'America/Sao_Paulo')::date and (fim is null or fim >= (now() at time zone 'America/Sao_Paulo')::date)),
  'sla_agora', (select jsonb_build_object(
       'abertos', count(*),
       'vencendo', count(*) filter (where sla_vence_em >= now() and sla_vence_em < now() + interval '4 hours'),
       'estourados', count(*) filter (where sla_vence_em < now()))
     from public.leads where primeira_resposta_em is null and status in ('novo', 'em_atendimento')),
  'por_servico', (select coalesce(jsonb_agg(jsonb_build_object('servico', s, 'n', n) order by n desc, s), '[]')
     from (select unnest(servicos) as s, count(*) as n from l where atual group by 1) x),
  'por_origem', (select coalesce(jsonb_agg(jsonb_build_object('origem', o, 'n', n) order by n desc, o), '[]')
     from (select coalesce(nullif(utm_source, ''), nullif(origem_informada, ''), 'direto') as o, count(*) as n from l where atual group by 1) x),
  'por_situacao', (select coalesce(jsonb_agg(jsonb_build_object('situacao', s, 'n', n) order by n desc), '[]')
     from (select coalesce(situacao_atual::text, 'nao_informado') as s, count(*) as n from l where atual group by 1) x),
  'motivos_perda', (select coalesce(jsonb_agg(jsonb_build_object('motivo', m, 'n', n) order by n desc), '[]')
     from (select motivo_perda::text as m, count(*) as n from fechados where atual and etapa = 'perdido' group by 1) x),
  'funil', (select jsonb_agg(jsonb_build_object('etapa', c.etapa, 'rotulo', c.rotulo,
              'n', (select count(*) from neg, lim where neg.created_at >= lim.ini_ant
                      and (select ordem from public.etapas_config e where e.etapa = neg.etapa_alcancada) >= c.ordem)) order by c.ordem)
            from public.etapas_config c where c.etapa <> 'perdido'),
  'serie', (select jsonb_agg(jsonb_build_object(
       'semana', to_char(s.semana, 'DD/MM'),
       'leads', (select count(*) from public.leads x where (x.created_at at time zone 'America/Sao_Paulo') >= s.semana and (x.created_at at time zone 'America/Sao_Paulo') < s.semana + interval '1 week'),
       'resposta_horas', (select round(avg(extract(epoch from (x.primeira_resposta_em - x.created_at)) / 3600.0)::numeric, 1)
                          from public.leads x where (x.created_at at time zone 'America/Sao_Paulo') >= s.semana and (x.created_at at time zone 'America/Sao_Paulo') < s.semana + interval '1 week'
                            and x.primeira_resposta_em is not null and x.status <> 'descartado'),
       'sla_pct', (select round(100.0 * count(*) filter (where x.primeira_resposta_em <= x.sla_vence_em)
                           / nullif(count(*) filter (where x.primeira_resposta_em is not null or x.sla_vence_em < now()), 0))
                   from public.leads x where (x.created_at at time zone 'America/Sao_Paulo') >= s.semana and (x.created_at at time zone 'America/Sao_Paulo') < s.semana + interval '1 week'
                     and x.status <> 'descartado'),
       'receita', (select coalesce(sum(n.valor_estimado), 0) from public.negocios n
                   where n.etapa = 'ganho' and (n.ganho_em at time zone 'America/Sao_Paulo') >= s.semana and (n.ganho_em at time zone 'America/Sao_Paulo') < s.semana + interval '1 week')
     ) order by s.semana) from semanas s)
)
$$;

