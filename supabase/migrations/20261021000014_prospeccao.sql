-- Painel Stark — 0014: Prospecção (empresas que a Stark vai atrás).
-- Separada da caixa de entrada: sem prazo de 1 dia útil, ritmo combinado pela equipe.
-- Encontra o resto do painel num ponto só: prospect interessado vira negócio no Funil (Em triagem).
-- O painel não envia nada sozinho: lembra, sugere a mensagem e registra o que aconteceu.
-- (só create / insert / update: nada é removido; prospects nunca são apagados, só encerrados)

-- ─── Tabelas ────────────────────────────────────────────────────────────────
create table public.prospeccao_listas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 1 and 80),
  origem text not null check (char_length(origem) between 1 and 200),   -- de onde vieram os contatos (LGPD)
  criada_por uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.prospects (
  id uuid primary key default gen_random_uuid(),
  empresa text not null check (char_length(empresa) between 1 and 160),
  pessoa text check (char_length(pessoa) <= 120),
  cargo text check (char_length(cargo) <= 120),
  email text check (email = lower(email)),
  whatsapp text check (whatsapp is null or whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
  linkedin text,
  instagram text,
  site text,
  cidade text,
  segmento text,
  porque text check (char_length(porque) <= 600),                     -- por que abordar esta empresa
  canal text not null default 'linkedin' check (canal in ('linkedin', 'whatsapp', 'email', 'instagram', 'telefone')),
  origem text not null default 'Cadastro manual',                      -- de onde veio o contato (LGPD)
  lista_id uuid references public.prospeccao_listas (id),
  responsavel_id uuid references public.profiles (id),
  situacao text not null default 'a_abordar'
    check (situacao in ('a_abordar', 'contatado', 'acompanhamento', 'respondeu', 'interessado', 'sem_interesse', 'nao_abordar')),
  toques smallint not null default 0,                                   -- contatos feitos sem resposta (para o ritmo)
  proximo_contato date,                                                 -- quando aparece em "Hoje"
  ultimo_contato_em timestamptz,
  encerrado_em timestamptz,
  motivo_encerramento text,
  contato_id uuid references public.contatos (id),
  negocio_id uuid references public.negocios (id),
  criado_por uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index prospects_hoje on public.prospects (proximo_contato)
  where situacao in ('a_abordar', 'contatado', 'acompanhamento', 'respondeu');
create index prospects_situacao on public.prospects (situacao, created_at);
-- Repetidos: o mesmo e-mail, WhatsApp, LinkedIn ou site não entra duas vezes
create unique index prospects_email_uniq on public.prospects (email) where email is not null;
create unique index prospects_whatsapp_uniq on public.prospects (whatsapp) where whatsapp is not null;
create unique index prospects_linkedin_uniq on public.prospects (lower(linkedin)) where linkedin is not null;
create unique index prospects_site_uniq on public.prospects (lower(site)) where site is not null;

create table public.prospeccao_toques (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects (id),
  canal text check (canal in ('linkedin', 'whatsapp', 'email', 'instagram', 'telefone')),
  resultado text not null
    check (resultado in ('enviada', 'respondeu', 'depois', 'sem_interesse', 'interessado', 'nao_abordar', 'reaberto', 'nota', 'importado')),
  anotacao text check (char_length(anotacao) <= 2000),
  autor_id uuid references public.profiles (id),
  ocorreu_em timestamptz not null default now()
);
create index prospeccao_toques_prospect on public.prospeccao_toques (prospect_id, ocorreu_em desc);
create index prospeccao_toques_semana on public.prospeccao_toques (ocorreu_em) where resultado = 'enviada';

-- Mensagens sugeridas por canal e por contato (1º, 2º, 3º). {{pessoa}}, {{empresa}}, {{seu_nome}}
create table public.prospeccao_modelos (
  canal text not null check (canal in ('linkedin', 'whatsapp', 'email', 'instagram', 'telefone')),
  toque smallint not null check (toque between 1 and 3),
  texto text not null check (char_length(texto) <= 2000),
  updated_at timestamptz not null default now(),
  primary key (canal, toque)
);

create trigger prospects_updated_at before update on public.prospects for each row execute function public.set_updated_at();
create trigger prospects_auditoria after insert or update on public.prospects
  for each row execute function public.registrar_auditoria();

-- Ritmo (dias úteis entre os contatos) e meta semanal
insert into public.app_config (chave, valor) values
  ('prospeccao_ritmo', '[3, 4]'::jsonb),
  ('prospeccao_meta_semana', '20'::jsonb)
on conflict (chave) do nothing;

insert into public.prospeccao_modelos (canal, toque, texto) values
  ('linkedin', 1, E'Oi, {{pessoa}}! Sou {{seu_nome}}, da Stark. A gente cria sistemas sob medida para empresas como a {{empresa}} tirarem processos da planilha e do WhatsApp.\nFaz sentido uma conversa rápida de 20 minutos para eu entender como vocês fazem hoje?'),
  ('linkedin', 2, E'Oi, {{pessoa}}, tudo bem? Volto aqui porque costumo ver na {{empresa}} e em empresas parecidas o mesmo problema: muita coisa controlada à mão.\nSe quiser, mostro em 20 minutos como outras empresas resolveram isso.'),
  ('linkedin', 3, E'Oi, {{pessoa}}! Passando uma última vez por aqui.\nSe organizar processos da {{empresa}} com um sistema próprio fizer sentido em algum momento, é só me chamar. Se não for prioridade agora, sem problema.'),
  ('whatsapp', 1, E'Oi, {{pessoa}}! Aqui é {{seu_nome}}, da Stark — Software sob medida. Ajudamos empresas como a {{empresa}} a sair da planilha e do controle no WhatsApp com um sistema do jeito delas.\nPosso te explicar em 2 minutos?'),
  ('whatsapp', 2, E'Oi, {{pessoa}}, tudo bem? Só retomando minha mensagem sobre sistemas sob medida para a {{empresa}}. Tem 20 minutos esta semana?'),
  ('whatsapp', 3, E'{{pessoa}}, última mensagem por aqui para não incomodar. Se em algum momento fizer sentido, é só responder. Obrigado!'),
  ('email', 1, E'Olá, {{pessoa}}!\n\nSou {{seu_nome}}, da Stark. Criamos sistemas sob medida para empresas que hoje dependem de planilhas e mensagens soltas para controlar o dia a dia.\n\nPodemos conversar 20 minutos para eu entender como a {{empresa}} faz hoje?\n\n{{seu_nome}}\nStark — Software sob medida'),
  ('email', 2, E'Olá, {{pessoa}}, tudo bem?\n\nRetomando meu e-mail anterior: se fizer sentido, mostro em 20 minutos exemplos de sistemas que fizemos para empresas parecidas com a {{empresa}}.\n\n{{seu_nome}}'),
  ('email', 3, E'Olá, {{pessoa}}!\n\nEste é meu último contato por aqui. Se um sistema sob medida fizer sentido para a {{empresa}} no futuro, é só responder este e-mail.\n\n{{seu_nome}}'),
  ('instagram', 1, E'Oi! Sou {{seu_nome}}, da Stark. Vi o perfil da {{empresa}} e queria entender como vocês organizam pedidos e clientes hoje. A gente cria sistemas sob medida para isso. Posso te mandar uma mensagem com mais detalhes?'),
  ('instagram', 2, E'Oi! Retomando: se quiserem organizar pedidos e clientes da {{empresa}} sem planilha, posso mostrar como em 20 minutos.'),
  ('instagram', 3, E'Última mensagem para não incomodar: se fizer sentido no futuro, é só chamar. Obrigado!'),
  ('telefone', 1, E'Roteiro: apresentar a Stark em 1 frase, perguntar como a {{empresa}} controla [PROCESSO] hoje, propor 20 minutos de conversa.'),
  ('telefone', 2, E'Roteiro: retomar a ligação anterior, perguntar se conseguiram pensar, propor um horário.'),
  ('telefone', 3, E'Roteiro: último contato, deixar a porta aberta.')
on conflict do nothing;

-- ─── Regras ─────────────────────────────────────────────────────────────────
/** Soma dias úteis (pula fim de semana e feriados que contam no prazo). */
create function public.somar_dias_uteis(p_dia date, p_n int) returns date
language plpgsql stable set search_path = public as $$
declare d date := p_dia; n int := 0;
begin
  if p_n <= 0 then return p_dia; end if;
  while n < p_n loop
    d := d + 1;
    if extract(isodow from d) < 6 and not exists (select 1 from public.feriados f where f.data = d and f.conta_no_sla) then
      n := n + 1;
    end if;
  end loop;
  return d;
end $$;

create function public.hoje_sp() returns date language sql stable set search_path = public as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

/**
 * Registrar o que aconteceu num contato. Muda a situação e marca o próximo contato pelo ritmo.
 * enviada: mandou e não teve resposta · respondeu · depois (pediu para falar depois) · sem_interesse · nota
 */
create function public.registrar_toque_prospect(p_prospect uuid, p_canal text, p_resultado text,
                                                p_anotacao text default null, p_proximo date default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p public.prospects%rowtype;
  v_ritmo int[] := coalesce((select array(select jsonb_array_elements_text(valor)::int) from public.app_config where chave = 'prospeccao_ritmo'), array[3, 4]);
  v_max int;
  v_hoje date := public.hoje_sp();
begin
  if not public.tem_papel('admin', 'comercial') then raise exception 'sem_permissao'; end if;
  if p_resultado not in ('enviada', 'respondeu', 'depois', 'sem_interesse', 'nota') then raise exception 'resultado_invalido'; end if;
  select * into p from public.prospects where id = p_prospect for update;
  if not found then raise exception 'prospect_nao_encontrado'; end if;
  if p.situacao = 'nao_abordar' then raise exception 'nao_abordar'; end if;
  if p.situacao = 'interessado' and p_resultado <> 'nota' then raise exception 'ja_virou_negocio'; end if;
  if p_proximo is not null and p_proximo < v_hoje then raise exception 'data_no_passado'; end if;
  if p_resultado = 'depois' and p_proximo is null then raise exception 'informe_a_data'; end if;
  v_max := cardinality(v_ritmo) + 1;  -- contatos sem resposta antes de encerrar (padrão 3)

  insert into public.prospeccao_toques (prospect_id, canal, resultado, anotacao, autor_id)
  values (p_prospect, coalesce(p_canal, p.canal), p_resultado, nullif(btrim(p_anotacao), ''), auth.uid());

  if p_resultado = 'nota' then
    return jsonb_build_object('situacao', p.situacao, 'proximo_contato', p.proximo_contato, 'toques', p.toques);
  end if;

  p.ultimo_contato_em := now();
  p.responsavel_id := coalesce(p.responsavel_id, auth.uid());
  if p_canal is not null then p.canal := p_canal; end if;

  if p_resultado = 'enviada' then
    p.toques := p.toques + 1;
    if p.toques >= v_max then
      -- 3 contatos sem resposta: encerra (dá para reabrir)
      p.situacao := 'sem_interesse';
      p.proximo_contato := null;
      p.encerrado_em := now();
      p.motivo_encerramento := format('Sem resposta depois de %s contatos', p.toques);
    else
      p.situacao := case when p.toques = 1 then 'contatado' else 'acompanhamento' end;
      p.proximo_contato := coalesce(p_proximo, public.somar_dias_uteis(v_hoje, v_ritmo[p.toques]));
    end if;
  elsif p_resultado = 'respondeu' then
    p.situacao := 'respondeu';
    p.proximo_contato := coalesce(p_proximo, public.somar_dias_uteis(v_hoje, 1));
  elsif p_resultado = 'depois' then
    p.situacao := case when p.situacao = 'a_abordar' then 'contatado' else p.situacao end;
    p.proximo_contato := p_proximo;
  elsif p_resultado = 'sem_interesse' then
    p.situacao := 'sem_interesse';
    p.proximo_contato := null;
    p.encerrado_em := now();
    p.motivo_encerramento := coalesce(nullif(btrim(p_anotacao), ''), 'Disse que não tem interesse');
  end if;

  update public.prospects set
    situacao = p.situacao, toques = p.toques, proximo_contato = p.proximo_contato, ultimo_contato_em = p.ultimo_contato_em,
    encerrado_em = p.encerrado_em, motivo_encerramento = p.motivo_encerramento, responsavel_id = p.responsavel_id, canal = p.canal
   where id = p_prospect;
  return jsonb_build_object('situacao', p.situacao, 'proximo_contato', p.proximo_contato, 'toques', p.toques);
end $$;

/** Mudar a situação à mão (arrastar no Pipeline, reabrir, não abordar mais). Interessado tem função própria. */
create function public.mudar_situacao_prospect(p_prospect uuid, p_situacao text, p_motivo text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare p public.prospects%rowtype; v_hoje date := public.hoje_sp();
begin
  if not public.tem_papel('admin', 'comercial') then raise exception 'sem_permissao'; end if;
  if p_situacao not in ('a_abordar', 'contatado', 'acompanhamento', 'respondeu', 'sem_interesse', 'nao_abordar') then raise exception 'situacao_invalida'; end if;
  select * into p from public.prospects where id = p_prospect for update;
  if not found then raise exception 'prospect_nao_encontrado'; end if;
  if p.situacao = 'interessado' then raise exception 'ja_virou_negocio'; end if;
  if p.situacao = p_situacao then return jsonb_build_object('situacao', p.situacao, 'proximo_contato', p.proximo_contato); end if;

  update public.prospects set
    situacao = p_situacao,
    proximo_contato = case when p_situacao in ('sem_interesse', 'nao_abordar') then null
                           when p.situacao in ('sem_interesse', 'nao_abordar') or p.proximo_contato is null then v_hoje
                           else p.proximo_contato end,
    toques = case when p_situacao = 'a_abordar' then 0 else toques end,
    encerrado_em = case when p_situacao in ('sem_interesse', 'nao_abordar') then now() end,
    motivo_encerramento = case when p_situacao in ('sem_interesse', 'nao_abordar') then coalesce(nullif(btrim(p_motivo), ''), motivo_encerramento) end
   where id = p_prospect
  returning * into p;

  insert into public.prospeccao_toques (prospect_id, resultado, anotacao, autor_id)
  values (p_prospect,
          case p_situacao when 'nao_abordar' then 'nao_abordar' when 'sem_interesse' then 'sem_interesse' else 'reaberto' end,
          coalesce(nullif(btrim(p_motivo), ''), 'Situação mudada para ' || p_situacao), auth.uid());
  return jsonb_build_object('situacao', p.situacao, 'proximo_contato', p.proximo_contato);
end $$;

/**
 * Tem interesse: cria (ou reaproveita) o contato e abre o negócio no Funil em "Em triagem",
 * com o histórico da prospecção na linha do tempo. Precisa de e-mail ou WhatsApp (o Funil usa para responder).
 */
create function public.converter_prospect(p_prospect uuid, p_email text default null, p_whatsapp text default null,
                                          p_servicos public.servico[] default '{}')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p public.prospects%rowtype;
  v_email text;
  v_whats text;
  v_contato uuid;
  v_empresa uuid;
  v_negocio uuid;
  v_resp uuid;
  v_hist text;
begin
  if not public.tem_papel('admin', 'comercial') then raise exception 'sem_permissao'; end if;
  select * into p from public.prospects where id = p_prospect for update;
  if not found then raise exception 'prospect_nao_encontrado'; end if;
  if p.situacao = 'interessado' and p.negocio_id is not null then
    return jsonb_build_object('negocio_id', p.negocio_id, 'contato_id', p.contato_id, 'ja_existia', true);
  end if;
  if p.situacao = 'nao_abordar' then raise exception 'nao_abordar'; end if;

  v_email := lower(nullif(btrim(coalesce(p_email, p.email)), ''));
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' then raise exception 'email_invalido'; end if;
  v_whats := coalesce(public.normalizar_whatsapp(p_whatsapp), p.whatsapp);
  if p_whatsapp is not null and btrim(p_whatsapp) <> '' and public.normalizar_whatsapp(p_whatsapp) is null then raise exception 'whatsapp_invalido'; end if;
  if v_email is null and v_whats is null then raise exception 'precisa_email_ou_whatsapp'; end if;
  v_resp := coalesce(p.responsavel_id, auth.uid());

  -- Contato: o mesmo e-mail ou WhatsApp já existente é reaproveitado
  select id into v_contato from public.contatos where (v_email is not null and email = v_email) or (v_whats is not null and whatsapp = v_whats) limit 1;
  select id into v_empresa from public.empresas where lower(nome) = lower(p.empresa) limit 1;
  if v_empresa is null then insert into public.empresas (nome) values (p.empresa) returning id into v_empresa; end if;
  if v_contato is null then
    insert into public.contatos (nome, email, whatsapp, empresa_id, cargo, responsavel_id)
    values (coalesce(nullif(p.pessoa, ''), p.empresa), v_email, v_whats, v_empresa, p.cargo, v_resp)
    returning id into v_contato;
  end if;

  insert into public.negocios (titulo, contato_id, empresa_id, responsavel_id, servicos, etapa, probabilidade)
  values (coalesce(public.rotulo_servico(p_servicos[1]), 'Prospecção') || ' · ' || p.empresa, v_contato, v_empresa, v_resp,
          coalesce(p_servicos, '{}'), 'triagem', (select probabilidade_padrao from public.etapas_config where etapa = 'triagem'))
  returning id into v_negocio;

  select string_agg(format('%s · %s%s', to_char(t.ocorreu_em at time zone 'America/Sao_Paulo', 'DD/MM'),
                           coalesce(t.canal, '—') || ' · ' || t.resultado, coalesce(': ' || t.anotacao, '')), E'\n' order by t.ocorreu_em)
    into v_hist from public.prospeccao_toques t where t.prospect_id = p_prospect;

  insert into public.atividades (tipo, canal, direcao, automatica, contato_id, negocio_id, autor_id, titulo, corpo, meta)
  values ('prospeccao', 'sistema', 'interna', true, v_contato, v_negocio, auth.uid(),
          'Veio da prospecção' || coalesce(' (' || (select nome from public.prospeccao_listas where id = p.lista_id) || ')', ''),
          coalesce(p.porque || E'\n\n', '') || coalesce(v_hist, ''),
          jsonb_build_object('prospect_id', p.id, 'origem', p.origem));

  update public.prospects set situacao = 'interessado', contato_id = v_contato, negocio_id = v_negocio,
         email = coalesce(email, v_email), whatsapp = coalesce(whatsapp, v_whats),
         proximo_contato = null, encerrado_em = now(), motivo_encerramento = null, ultimo_contato_em = now()
   where id = p_prospect;
  insert into public.prospeccao_toques (prospect_id, resultado, anotacao, autor_id)
  values (p_prospect, 'interessado', 'Virou negócio no Funil', auth.uid());

  return jsonb_build_object('negocio_id', v_negocio, 'contato_id', v_contato, 'ja_existia', false);
end $$;

/**
 * Importar uma planilha. Com p_simular = true só devolve o que aconteceria em cada linha.
 * Repetidos (e-mail, WhatsApp, LinkedIn ou site) e quem já é cliente ficam de fora.
 * Os novos são divididos entre os responsáveis (rodízio) e espalhados N por dia útil em "Hoje".
 */
create function public.importar_prospects(p_linhas jsonb, p_lista text, p_origem text,
                                          p_responsaveis uuid[] default '{}', p_por_dia int default 5,
                                          p_simular boolean default true)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  i int := 0;
  n_novos int := 0;
  v_lista uuid;
  v_status text;
  v_email text; v_whats text; v_linkedin text; v_site text; v_empresa text;
  v_resultado jsonb := '[]'::jsonb;
  v_dia date := public.somar_dias_uteis(public.hoje_sp(), 1);
  v_resps uuid[] := case when cardinality(coalesce(p_responsaveis, '{}')) = 0 then array[auth.uid()] else p_responsaveis end;
  v_vistos text[] := '{}';
  v_chaves text[];
begin
  if not public.tem_papel('admin', 'comercial') then raise exception 'sem_permissao'; end if;
  if jsonb_typeof(p_linhas) <> 'array' or jsonb_array_length(p_linhas) > 2000 then raise exception 'planilha_grande_demais'; end if;
  if not p_simular and (coalesce(btrim(p_lista), '') = '' or coalesce(btrim(p_origem), '') = '') then raise exception 'informe_lista_e_origem'; end if;
  if not p_simular then
    insert into public.prospeccao_listas (nome, origem, criada_por) values (left(btrim(p_lista), 80), left(btrim(p_origem), 200), auth.uid())
    returning id into v_lista;
  end if;

  for r in select * from jsonb_array_elements(p_linhas) loop
    i := i + 1;
    v_empresa := nullif(btrim(r ->> 'empresa'), '');
    v_email := lower(nullif(btrim(r ->> 'email'), ''));
    if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' then v_email := null; end if;
    v_whats := public.normalizar_whatsapp(r ->> 'whatsapp');
    v_linkedin := nullif(btrim(r ->> 'linkedin'), '');
    v_site := lower(regexp_replace(nullif(btrim(r ->> 'site'), ''), '^https?://(www\.)?|/$', '', 'g'));
    v_chaves := array_remove(array['e:' || v_email, 'w:' || v_whats, 'l:' || lower(v_linkedin), 's:' || v_site], null);

    v_status := case
      when v_empresa is null then 'sem_empresa'
      when exists (select 1 from public.prospects x where x.situacao = 'nao_abordar'
                     and ((v_email is not null and x.email = v_email) or (v_whats is not null and x.whatsapp = v_whats)
                          or (v_linkedin is not null and lower(x.linkedin) = lower(v_linkedin)) or (v_site is not null and lower(x.site) = v_site)))
        then 'nao_abordar'
      when exists (select 1 from public.prospects x
                    where (v_email is not null and x.email = v_email) or (v_whats is not null and x.whatsapp = v_whats)
                       or (v_linkedin is not null and lower(x.linkedin) = lower(v_linkedin)) or (v_site is not null and lower(x.site) = v_site))
        or v_chaves && v_vistos
        then 'repetido'
      when exists (select 1 from public.contatos c where (v_email is not null and c.email = v_email) or (v_whats is not null and c.whatsapp = v_whats))
        then 'cliente'
      when v_email is null and v_whats is null and v_linkedin is null and nullif(btrim(r ->> 'instagram'), '') is null then 'sem_contato'
      else 'novo' end;
    v_vistos := v_vistos || v_chaves;

    -- Sem nenhum contato entra mesmo assim (com o site), mas avisa
    if not p_simular and v_status in ('novo', 'sem_contato') then
      insert into public.prospects (empresa, pessoa, cargo, email, whatsapp, linkedin, instagram, site, cidade, segmento, porque, canal,
                                    origem, lista_id, responsavel_id, proximo_contato, criado_por)
      values (left(v_empresa, 160), left(nullif(btrim(r ->> 'pessoa'), ''), 120), left(nullif(btrim(r ->> 'cargo'), ''), 120),
              v_email, v_whats, v_linkedin, nullif(btrim(r ->> 'instagram'), ''), v_site,
              nullif(btrim(r ->> 'cidade'), ''), nullif(btrim(r ->> 'segmento'), ''), left(nullif(btrim(r ->> 'porque'), ''), 600),
              case when v_linkedin is not null then 'linkedin' when v_whats is not null then 'whatsapp'
                   when v_email is not null then 'email' when nullif(btrim(r ->> 'instagram'), '') is not null then 'instagram' else 'telefone' end,
              left(btrim(p_origem), 200), v_lista, v_resps[(n_novos % cardinality(v_resps)) + 1],
              public.somar_dias_uteis(v_dia, (n_novos / greatest(p_por_dia, 1))), auth.uid());
      n_novos := n_novos + 1;
    end if;
    v_resultado := v_resultado || jsonb_build_object('linha', i, 'status', v_status);
  end loop;

  return jsonb_build_object(
    'lista_id', v_lista,
    'linhas', v_resultado,
    'novos', (select count(*) from jsonb_array_elements(v_resultado) x where x ->> 'status' in ('novo', 'sem_contato')),
    'repetidos', (select count(*) from jsonb_array_elements(v_resultado) x where x ->> 'status' = 'repetido'),
    'clientes', (select count(*) from jsonb_array_elements(v_resultado) x where x ->> 'status' = 'cliente'),
    'bloqueados', (select count(*) from jsonb_array_elements(v_resultado) x where x ->> 'status' = 'nao_abordar'),
    'sem_contato', (select count(*) from jsonb_array_elements(v_resultado) x where x ->> 'status' = 'sem_contato'),
    'sem_empresa', (select count(*) from jsonb_array_elements(v_resultado) x where x ->> 'status' = 'sem_empresa'));
end $$;

/** Números do topo da aba. Semana começa na segunda (São Paulo). */
create function public.prospeccao_indicadores() returns jsonb
language sql stable security invoker set search_path = public as $$
  with semana as (select date_trunc('week', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo' as ini),
  abordados as (   -- prospects com 1º contato nos últimos 30 dias
    select p.id, p.canal,
           exists (select 1 from public.prospeccao_toques t where t.prospect_id = p.id and t.resultado in ('respondeu', 'interessado', 'depois')) as respondeu
      from public.prospects p
     where exists (select 1 from public.prospeccao_toques t where t.prospect_id = p.id and t.resultado = 'enviada' and t.ocorreu_em > now() - interval '30 days')
  )
  select jsonb_build_object(
    'hoje', (select count(*) from public.prospects where situacao in ('a_abordar', 'contatado', 'acompanhamento', 'respondeu') and proximo_contato <= public.hoje_sp()),
    'atrasados', (select count(*) from public.prospects where situacao in ('a_abordar', 'contatado', 'acompanhamento', 'respondeu') and proximo_contato < public.hoje_sp()),
    'a_abordar', (select count(*) from public.prospects where situacao = 'a_abordar'),
    'contatos_semana', (select count(*) from public.prospeccao_toques, semana where resultado = 'enviada' and ocorreu_em >= semana.ini),
    'meta_semana', (select (valor #>> '{}')::int from public.app_config where chave = 'prospeccao_meta_semana'),
    'resposta_pct', (select round(100.0 * count(*) filter (where respondeu) / nullif(count(*), 0)) from abordados),
    'por_canal', (select coalesce(jsonb_agg(jsonb_build_object('canal', canal, 'n', n, 'pct', pct) order by pct desc nulls last), '[]')
                    from (select canal, count(*) n, round(100.0 * count(*) filter (where respondeu) / nullif(count(*), 0)) pct
                            from abordados group by canal) x),
    'viraram_negocio', (select count(*) from public.prospects where situacao = 'interessado' and encerrado_em > now() - interval '30 days'),
    'valor_no_funil', (select coalesce(sum(n.valor_estimado), 0) from public.prospects p join public.negocios n on n.id = p.negocio_id
                        where p.situacao = 'interessado' and n.etapa not in ('ganho', 'perdido'))
  )
$$;

/** Às 8h dos dias úteis: avisa cada responsável quantos contatos tem para hoje. */
create function public.avisar_prospeccao_hoje() returns int
language plpgsql security definer set search_path = public as $$
declare r record; v_n int := 0;
begin
  if extract(isodow from public.hoje_sp()) >= 6
     or exists (select 1 from public.feriados f where f.data = public.hoje_sp() and f.conta_no_sla) then
    return 0;
  end if;
  for r in
    select p.responsavel_id, count(*) as n, count(*) filter (where p.proximo_contato < public.hoje_sp()) as atrasados
      from public.prospects p join public.profiles pr on pr.id = p.responsavel_id and pr.ativo
     where p.situacao in ('a_abordar', 'contatado', 'acompanhamento', 'respondeu') and p.proximo_contato <= public.hoje_sp()
     group by p.responsavel_id
  loop
    perform public.notificar(array[r.responsavel_id], 'prospeccao_hoje',
      format('%s contato%s de prospecção para hoje', r.n, case when r.n > 1 then 's' else '' end),
      case when r.atrasados > 0 then format('%s atrasado%s.', r.atrasados, case when r.atrasados > 1 then 's' else '' end) end,
      '/prospeccao');
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- ─── Segurança: todos da equipe leem; admin e comercial escrevem ────────────
alter table public.prospeccao_listas enable row level security;
alter table public.prospects enable row level security;
alter table public.prospeccao_toques enable row level security;
alter table public.prospeccao_modelos enable row level security;
do $$
declare t text;
begin
  foreach t in array array['prospeccao_listas', 'prospects', 'prospeccao_toques', 'prospeccao_modelos'] loop
    execute format('create policy %I on public.%I for select to authenticated using ((select public.is_equipe()))', t || '_ler', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select public.tem_papel(''admin'', ''comercial'')))', t || '_inserir', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select public.tem_papel(''admin'', ''comercial''))) with check ((select public.tem_papel(''admin'', ''comercial'')))', t || '_editar', t);
  end loop;
end $$;

revoke execute on function public.somar_dias_uteis(date, int), public.hoje_sp(), public.avisar_prospeccao_hoje() from public, anon;
revoke execute on function public.registrar_toque_prospect(uuid, text, text, text, date), public.mudar_situacao_prospect(uuid, text, text),
  public.converter_prospect(uuid, text, text, public.servico[]), public.importar_prospects(jsonb, text, text, uuid[], int, boolean),
  public.prospeccao_indicadores() from public, anon;
revoke execute on function public.avisar_prospeccao_hoje() from authenticated;
grant execute on function public.registrar_toque_prospect(uuid, text, text, text, date), public.mudar_situacao_prospect(uuid, text, text),
  public.converter_prospect(uuid, text, text, public.servico[]), public.importar_prospects(jsonb, text, text, uuid[], int, boolean),
  public.prospeccao_indicadores(), public.somar_dias_uteis(date, int), public.hoje_sp() to authenticated;
grant execute on function public.avisar_prospeccao_hoje() to service_role;

-- 8h em São Paulo (11h UTC), segunda a sexta
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('stark-prospeccao-hoje', '0 11 * * 1-5', 'select public.avisar_prospeccao_hoje()');
  end if;
end $$;
