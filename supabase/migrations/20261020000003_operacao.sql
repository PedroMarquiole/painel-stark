-- ════════════════════════════════════════════════════════════════════════════
-- Painel Stark · 0003 · Operação: propostas, projetos, horas, contratos, faturas
-- ════════════════════════════════════════════════════════════════════════════

create table public.propostas (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  versao smallint not null default 1,
  modelo text,                         -- modelo por tipo de serviço
  status text not null default 'rascunho'
    check (status in ('rascunho', 'enviada', 'visualizada', 'aceita', 'recusada', 'expirada', 'substituida')),
  titulo text not null,
  escopo text,                         -- markdown
  prazo_semanas smallint,
  valor_total numeric(12,2) not null default 0,
  recorrencia_mensal numeric(12,2),    -- Evolução contínua, se incluída
  valida_ate date,
  -- link público: /p/<token>. Lido só pela Edge Function (service role), nunca por anon.
  token_publico text not null unique default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  enviada_em timestamptz,
  primeira_visualizacao_em timestamptz,
  visualizacoes integer not null default 0,
  aceita_em timestamptz,
  aceite_nome text,
  aceite_documento text,
  aceite_ip_hash text,
  pdf_path text,                       -- Storage: propostas/<id>.pdf
  criada_por uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (negocio_id, versao)
);

create table public.proposta_itens (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid not null references public.propostas (id) on delete cascade,
  fase public.fase_projeto not null,
  descricao text not null,
  horas numeric(7,1),
  valor numeric(12,2) not null default 0,
  ordem smallint not null default 0
);

create table public.proposta_visualizacoes (
  id bigint generated always as identity primary key,
  proposta_id uuid not null references public.propostas (id) on delete cascade,
  em timestamptz not null default now(),
  ip_hash text,
  user_agent text
);

create table public.projetos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  negocio_id uuid references public.negocios (id) on delete set null,
  proposta_id uuid references public.propostas (id) on delete set null,
  contato_id uuid not null references public.contatos (id) on delete restrict,
  empresa_id uuid references public.empresas (id) on delete set null,
  responsavel_id uuid references public.profiles (id) on delete set null,
  status text not null default 'ativo' check (status in ('ativo', 'pausado', 'entregue', 'cancelado')),
  saude text not null default 'verde' check (saude in ('verde', 'amarelo', 'vermelho')),  -- status para o cliente
  fase_atual public.fase_projeto not null default 'descoberta',
  horas_orcadas numeric(8,1),
  valor_orcado numeric(12,2),
  inicio date,
  previsao_entrega date,
  entregue_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projeto_fases (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos (id) on delete cascade,
  fase public.fase_projeto not null,
  status text not null default 'pendente' check (status in ('pendente', 'em_andamento', 'concluida')),
  inicio date,
  fim_previsto date,
  concluida_em timestamptz,
  horas_orcadas numeric(8,1),
  unique (projeto_id, fase)
);

create table public.entregas (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos (id) on delete cascade,
  fase public.fase_projeto not null,
  titulo text not null,
  marco boolean not null default false,
  vence_em date,
  entregue_em timestamptz,
  ordem double precision not null default 0
);

create table public.apontamentos_horas (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete restrict default auth.uid(),
  projeto_id uuid not null references public.projetos (id) on delete cascade,
  tarefa_id uuid references public.tarefas (id) on delete set null,
  fase public.fase_projeto,
  data date not null default current_date,
  horas numeric(4,2) not null check (horas > 0 and horas <= 24),
  descricao text,
  faturavel boolean not null default true,
  created_at timestamptz not null default now()
);
create index apontamentos_semana on public.apontamentos_horas (profile_id, data);
create index apontamentos_projeto on public.apontamentos_horas (projeto_id);

create table public.contratos (
  id uuid primary key default gen_random_uuid(),
  contato_id uuid not null references public.contatos (id) on delete restrict,
  empresa_id uuid references public.empresas (id) on delete set null,
  projeto_id uuid references public.projetos (id) on delete set null,
  proposta_id uuid references public.propostas (id) on delete set null,
  tipo text not null check (tipo in ('avulso', 'recorrente')),
  descricao text not null,
  valor_total numeric(12,2),          -- avulso
  valor_mensal numeric(12,2),         -- recorrente → MRR
  dia_vencimento smallint check (dia_vencimento between 1 and 28),
  inicio date not null,
  fim date,
  status text not null default 'ativo' check (status in ('ativo', 'encerrado', 'cancelado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (tipo <> 'recorrente' or valor_mensal is not null),
  check (tipo <> 'avulso' or valor_total is not null)
);

create sequence public.faturas_numero_seq start 1;
create table public.faturas (
  id uuid primary key default gen_random_uuid(),
  numero bigint not null unique default nextval('public.faturas_numero_seq'),
  contrato_id uuid not null references public.contratos (id) on delete restrict,
  competencia date,
  descricao text,
  valor numeric(12,2) not null check (valor > 0),
  vence_em date not null,
  status text not null default 'aberta' check (status in ('aberta', 'paga', 'cancelada')),
  paga_em timestamptz,
  link_pagamento text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contrato_id, competencia)  -- idempotência da geração mensal
);
create index faturas_abertas on public.faturas (vence_em) where status = 'aberta';

create table public.nps_respostas (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos (id) on delete cascade,
  contato_id uuid not null references public.contatos (id) on delete cascade,
  nota smallint check (nota between 0 and 10),
  comentario text,
  token_publico text not null unique default replace(gen_random_uuid()::text, '-', ''),
  enviada_em timestamptz not null default now(),
  respondida_em timestamptz
);

-- FKs pendentes de 0002
alter table public.atividades add constraint atividades_projeto_fk
  foreign key (projeto_id) references public.projetos (id) on delete cascade;
alter table public.tarefas add constraint tarefas_projeto_fk
  foreign key (projeto_id) references public.projetos (id) on delete cascade;

create trigger propostas_updated_at before update on public.propostas for each row execute function public.set_updated_at();
create trigger projetos_updated_at before update on public.projetos for each row execute function public.set_updated_at();
create trigger contratos_updated_at before update on public.contratos for each row execute function public.set_updated_at();
create trigger faturas_updated_at before update on public.faturas for each row execute function public.set_updated_at();

-- ─── Visões de indicadores (security_invoker: respeitam RLS de quem consulta) ─
create view public.v_mrr with (security_invoker = true) as
  select coalesce(sum(valor_mensal), 0)::numeric(12,2) as mrr, count(*) as contratos_recorrentes
  from public.contratos
  where tipo = 'recorrente' and status = 'ativo' and inicio <= current_date and (fim is null or fim >= current_date);

create view public.v_projeto_orcado_realizado with (security_invoker = true) as
  select p.id as projeto_id, p.nome, p.horas_orcadas, p.valor_orcado,
         coalesce(sum(a.horas), 0) as horas_realizadas,
         case when p.horas_orcadas > 0 then round(coalesce(sum(a.horas), 0) / p.horas_orcadas * 100, 1) end as pct_horas
  from public.projetos p
  left join public.apontamentos_horas a on a.projeto_id = p.id
  group by p.id;
