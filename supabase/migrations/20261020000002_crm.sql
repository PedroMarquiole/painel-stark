-- ════════════════════════════════════════════════════════════════════════════
-- Painel Stark · 0002 · CRM: empresas, contatos, leads, negócios, linha do tempo
-- ════════════════════════════════════════════════════════════════════════════

create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  site text,
  setor text,
  porte text,          -- [CONFIRMAR] faixas do Passo 2/3 do site
  cnpj text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index empresas_nome_trgm on public.empresas using gin (nome extensions.gin_trgm_ops);

create table public.contatos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text,                  -- sempre minúsculo — chave de dedup
  whatsapp text,               -- E.164 normalizado (+5511987654321) — chave de dedup
  empresa_id uuid references public.empresas (id) on delete set null,
  cargo text,
  opt_out_email boolean not null default false,
  opt_out_whatsapp boolean not null default false,
  responsavel_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contato_tem_canal check (email is not null or whatsapp is not null),
  constraint email_minusculo check (email = lower(email)),
  constraint whatsapp_e164 check (whatsapp is null or whatsapp ~ '^\+[1-9][0-9]{7,14}$')
);
-- Deduplicação: um contato por e-mail e por WhatsApp
create unique index contatos_email_uniq on public.contatos (email) where email is not null;
create unique index contatos_whatsapp_uniq on public.contatos (whatsapp) where whatsapp is not null;
create index contatos_nome_trgm on public.contatos using gin (nome extensions.gin_trgm_ops);
create index contatos_empresa on public.contatos (empresa_id);

-- Etapas do funil: probabilidade padrão e alerta de "parado"
create table public.etapas_config (
  etapa public.etapa_negocio primary key,
  ordem smallint not null,
  rotulo text not null,
  probabilidade_padrao smallint not null check (probabilidade_padrao between 0 and 100),
  dias_alerta_parado smallint  -- null = sem alerta
);
insert into public.etapas_config values
  ('novo',        1, 'Novo',                 5,    1),
  ('triagem',     2, 'Em triagem',          10,    2),
  ('diagnostico', 3, 'Diagnóstico agendado', 20,   7),
  ('descoberta',  4, 'Descoberta feita',    35,    5),
  ('proposta',    5, 'Proposta enviada',    50,    7),
  ('negociacao',  6, 'Negociação',          70,   10),
  ('ganho',       7, 'Ganho',              100, null),
  ('perdido',     8, 'Perdido',              0, null);

create table public.negocios (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  contato_id uuid not null references public.contatos (id) on delete restrict,
  empresa_id uuid references public.empresas (id) on delete set null,
  responsavel_id uuid references public.profiles (id) on delete set null,
  etapa public.etapa_negocio not null default 'novo',
  etapa_desde timestamptz not null default now(),
  ordem double precision not null default 0,   -- posição no Kanban (fracionária, sem renumerar)
  servicos public.servico[] not null default '{}',
  valor_estimado numeric(12,2),
  probabilidade smallint not null default 5 check (probabilidade between 0 and 100),
  previsao_fechamento date,
  motivo_perda public.motivo_perda,
  motivo_perda_detalhe text,
  ganho_em timestamptz,
  perdido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint perda_tem_motivo check (etapa <> 'perdido' or motivo_perda is not null)
);
create index negocios_etapa on public.negocios (etapa, ordem);
create index negocios_contato on public.negocios (contato_id);
create index negocios_responsavel on public.negocios (responsavel_id) where etapa not in ('ganho', 'perdido');

-- Cada envio do formulário do site
create sequence public.leads_protocolo_seq start 1;

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  protocolo bigint not null unique default nextval('public.leads_protocolo_seq'),
  contato_id uuid not null references public.contatos (id) on delete restrict,
  negocio_id uuid references public.negocios (id) on delete set null,
  responsavel_id uuid references public.profiles (id) on delete set null,

  -- Passo 1 (confirmado no site)
  servicos public.servico[] not null check (cardinality(servicos) >= 1),
  situacao_atual public.situacao_atual,
  dor text not null check (char_length(dor) between 1 and 1200),

  -- Passos 2 e 3 [CONFIRMAR NO REPOSITÓRIO] — opcionais até lermos o form real
  nome_informado text not null,
  email_informado text,
  whatsapp_informado text,
  empresa_informada text,
  porte text,
  prazo text,
  investimento text,
  origem_informada text,        -- "Como conheceu a Stark?" (google, instagram, indicacao…)
  respostas_extras jsonb not null default '{}'::jsonb,  -- qualquer campo novo do site cai aqui sem migration
  consentimento_lgpd_em timestamptz,  -- aceite do aviso de privacidade (obrigatório no form do site)

  -- Simulador do site (ouro para a proposta)
  respondeu_simulador boolean not null default false,
  simulador jsonb,  -- { pessoas_tarefas_repetitivas, horas_semana, ... }

  -- Origem
  utm_source text, utm_medium text, utm_campaign text, utm_term text, utm_content text,
  referrer text,
  landing_page text,
  origem_ingestao text not null default 'api' check (origem_ingestao in ('api', 'netlify_forms', 'supabase_direct', 'manual')),
  chave_idempotencia text unique,  -- id do envio no provedor; reenvio do mesmo webhook não duplica
  user_agent text,
  ip_hash text,
  payload_bruto jsonb,

  -- Atendimento e SLA
  status text not null default 'novo' check (status in ('novo', 'em_atendimento', 'convertido', 'descartado')),
  motivo_descarte text,
  sla_vence_em timestamptz not null,
  primeira_resposta_em timestamptz,
  primeira_resposta_por uuid references public.profiles (id) on delete set null,

  -- Triagem IA (Fase 2)
  ia_resumo text,
  ia_tipo_projeto text,
  ia_complexidade public.complexidade,
  ia_urgencia smallint check (ia_urgencia between 1 and 5),
  ia_nao_e_para_stark boolean,
  ia_rascunho_resposta text,
  score smallint check (score between 0 and 100),
  score_motivos jsonb,  -- [{ regra, pontos, explicacao }] — mostra *por que* o score é aquele

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint descarte_tem_motivo check (status <> 'descartado' or motivo_descarte is not null)
);
create index leads_inbox on public.leads (created_at desc) where status in ('novo', 'em_atendimento');
create index leads_sla_aberto on public.leads (sla_vence_em) where primeira_resposta_em is null;
create index leads_contato on public.leads (contato_id);
create index leads_dor_trgm on public.leads using gin (dor extensions.gin_trgm_ops);

-- Prazo do SLA é do banco, não do front
create function public.leads_set_sla() returns trigger language plpgsql set search_path = public as $$
begin
  new.sla_vence_em := public.sla_deadline(
    new.created_at,
    coalesce((select (valor #>> '{}')::int from public.app_config where chave = 'sla_horas_uteis'), 24)
  );
  return new;
end $$;
create trigger leads_sla before insert on public.leads
  for each row execute function public.leads_set_sla();

-- Linha do tempo unificada: tudo que acontece com o cliente
create table public.atividades (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,                 -- mensagem, ligacao, nota, mudanca_etapa, lead_recebido, proposta_visualizada, ...
  canal public.canal not null default 'sistema',
  direcao public.direcao not null default 'interna',
  automatica boolean not null default false,  -- enviada por automação (não conta como 1ª resposta)
  contato_id uuid references public.contatos (id) on delete cascade,
  negocio_id uuid references public.negocios (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete cascade,
  projeto_id uuid,                    -- FK adicionada em 0003
  autor_id uuid references public.profiles (id) on delete set null,  -- null = sistema
  titulo text not null,
  corpo text,
  meta jsonb not null default '{}'::jsonb,
  ocorreu_em timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index atividades_contato on public.atividades (contato_id, ocorreu_em desc);
create index atividades_negocio on public.atividades (negocio_id, ocorreu_em desc);

-- 1ª resposta humana para o cliente fecha o SLA dos leads abertos daquele contato
create function public.atividades_fecha_sla() returns trigger language plpgsql
security definer set search_path = public as $$
begin
  if new.direcao = 'saida' and not new.automatica
     and new.canal in ('email', 'whatsapp', 'ligacao', 'reuniao')
     and new.contato_id is not null then
    update public.leads
       set primeira_resposta_em = new.ocorreu_em,
           primeira_resposta_por = new.autor_id,
           status = case when status = 'novo' then 'em_atendimento' else status end
     where contato_id = new.contato_id
       and primeira_resposta_em is null
       and created_at <= new.ocorreu_em;
  end if;
  return new;
end $$;
create trigger atividades_sla after insert on public.atividades
  for each row execute function public.atividades_fecha_sla();

-- Mudança de etapa → atividade + carimbos + probabilidade padrão
create function public.negocios_mudanca_etapa() returns trigger language plpgsql
security definer set search_path = public as $$
begin
  if new.etapa is distinct from old.etapa then
    new.etapa_desde := now();
    new.ganho_em := case when new.etapa = 'ganho' then now() end;
    new.perdido_em := case when new.etapa = 'perdido' then now() end;
    if new.probabilidade = old.probabilidade then
      new.probabilidade := (select probabilidade_padrao from public.etapas_config where etapa = new.etapa);
    end if;
    insert into public.atividades (tipo, canal, direcao, contato_id, negocio_id, autor_id, titulo, meta)
    values ('mudanca_etapa', 'sistema', 'interna', new.contato_id, new.id, auth.uid(),
            format('Etapa: %s → %s',
                   (select rotulo from public.etapas_config where etapa = old.etapa),
                   (select rotulo from public.etapas_config where etapa = new.etapa)),
            jsonb_build_object('de', old.etapa, 'para', new.etapa, 'motivo_perda', new.motivo_perda));
  end if;
  return new;
end $$;
create trigger negocios_etapa before update of etapa on public.negocios
  for each row execute function public.negocios_mudanca_etapa();

create table public.tarefas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  status text not null default 'aberta' check (status in ('aberta', 'em_andamento', 'concluida', 'cancelada')),
  prioridade smallint not null default 2 check (prioridade between 1 and 3),
  vence_em timestamptz,
  responsavel_id uuid references public.profiles (id) on delete set null,
  contato_id uuid references public.contatos (id) on delete cascade,
  negocio_id uuid references public.negocios (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete cascade,
  projeto_id uuid,                    -- FK em 0003
  ordem double precision not null default 0,
  origem_automacao text,              -- chave da regra que criou (null = humano)
  concluida_em timestamptz,
  criada_por uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tarefas_responsavel on public.tarefas (responsavel_id, vence_em) where status in ('aberta', 'em_andamento');

create table public.reunioes (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid references public.negocios (id) on delete cascade,
  contato_id uuid not null references public.contatos (id) on delete cascade,
  responsavel_id uuid references public.profiles (id) on delete set null,
  tipo text not null default 'diagnostico',
  inicio timestamptz not null,
  fim timestamptz not null,
  meet_url text,
  calendar_event_id text,
  status text not null default 'agendada' check (status in ('agendada', 'realizada', 'cancelada', 'nao_compareceu')),
  notas_descoberta jsonb,  -- formulário pós-reunião → alimenta a proposta
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fim > inicio)
);
create index reunioes_inicio on public.reunioes (inicio) where status = 'agendada';

create table public.filtros_salvos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  escopo text not null,               -- inbox, funil, projetos...
  nome text not null,
  filtros jsonb not null,
  compartilhado boolean not null default false,
  ordem smallint not null default 0,
  created_at timestamptz not null default now()
);

create trigger empresas_updated_at before update on public.empresas for each row execute function public.set_updated_at();
create trigger contatos_updated_at before update on public.contatos for each row execute function public.set_updated_at();
create trigger negocios_updated_at before update on public.negocios for each row execute function public.set_updated_at();
create trigger leads_updated_at before update on public.leads for each row execute function public.set_updated_at();
create trigger tarefas_updated_at before update on public.tarefas for each row execute function public.set_updated_at();
create trigger reunioes_updated_at before update on public.reunioes for each row execute function public.set_updated_at();
