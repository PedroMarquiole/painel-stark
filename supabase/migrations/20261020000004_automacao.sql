-- ════════════════════════════════════════════════════════════════════════════
-- Painel Stark · 0004 · Automação: regras, execuções, fila de saída, notificações
--
-- Fluxo: evento (trigger/pg_cron) → automacoes_execucoes (idempotente) →
--        Edge Function `automation-runner` avalia condições e executa ações →
--        mensagens para cliente/equipe entram em mensagens_saida (outbox) →
--        Edge Function `outbox-sender` envia respeitando horário comercial,
--        opt-out e nova tentativa com backoff.
-- ════════════════════════════════════════════════════════════════════════════

create table public.templates_mensagem (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique,          -- ex.: lead.confirmacao.email
  canal public.canal not null check (canal in ('email', 'whatsapp')),
  destino text not null default 'cliente' check (destino in ('cliente', 'equipe')),
  nome text not null,
  assunto text,                        -- só e-mail
  corpo text not null,                 -- {{nome}}, {{protocolo}}, {{link_agendamento}}...
  whatsapp_template_name text,         -- nome do template aprovado na Meta (Cloud API)
  ativo boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.automacoes (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique,
  numero smallint,                     -- nº da regra na especificação
  nome text not null,
  descricao text,
  gatilho text not null,               -- lead.criado, sla.vencendo, negocio.parado, cron:semanal ...
  condicoes jsonb not null default '[]'::jsonb,  -- [{ campo, op, valor }]
  acoes jsonb not null default '[]'::jsonb,      -- [{ tipo, params }]
  ativa boolean not null default false,
  envia_ao_cliente boolean not null default false,  -- IA/automação só fala com cliente com regra explícita
  respeita_horario_comercial boolean not null default true,
  fase smallint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

create table public.automacoes_execucoes (
  id uuid primary key default gen_random_uuid(),
  automacao_id uuid not null references public.automacoes (id) on delete cascade,
  -- Idempotência: <regra>:<entidade>:<ocorrência>. Ex.: sla_alerta_4h:lead:<id>
  chave_idempotencia text not null unique,
  entidade_tipo text not null,
  entidade_id uuid,
  evento jsonb not null default '{}'::jsonb,
  status text not null default 'pendente' check (status in ('pendente', 'executando', 'sucesso', 'erro', 'ignorada')),
  tentativas smallint not null default 0,
  proxima_tentativa_em timestamptz not null default now(),
  resultado jsonb,
  erro text,
  created_at timestamptz not null default now(),
  finalizada_em timestamptz
);
create index execucoes_fila on public.automacoes_execucoes (proxima_tentativa_em) where status in ('pendente', 'erro');

create table public.mensagens_saida (
  id uuid primary key default gen_random_uuid(),
  canal text not null check (canal in ('email', 'whatsapp', 'push')),
  destino_tipo text not null check (destino_tipo in ('cliente', 'equipe')),
  destinatario text not null,          -- e-mail, E.164 ou id do grupo
  contato_id uuid references public.contatos (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete cascade,
  template_chave text references public.templates_mensagem (chave) on update cascade,
  assunto text,
  corpo text not null,
  execucao_id uuid references public.automacoes_execucoes (id) on delete set null,
  chave_idempotencia text not null unique,   -- nada é enviado duas vezes
  status text not null default 'pendente'
    check (status in ('pendente', 'enviando', 'enviada', 'erro', 'cancelada', 'bloqueada_opt_out')),
  agendada_para timestamptz not null default now(),  -- já ajustada ao horário comercial
  tentativas smallint not null default 0,
  max_tentativas smallint not null default 5,
  enviada_em timestamptz,
  provider text,
  provider_message_id text,
  erro text,
  created_at timestamptz not null default now()
);
create index mensagens_fila on public.mensagens_saida (agendada_para) where status in ('pendente', 'erro');

create table public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  tipo text not null,
  titulo text not null,
  corpo text,
  link text,
  lida_em timestamptz,
  created_at timestamptz not null default now()
);
create index notificacoes_nao_lidas on public.notificacoes (profile_id, created_at desc) where lida_em is null;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

-- Anti-spam da ingestão: contagem por ip_hash em janelas de 10 min (só service role)
create table public.ingest_rate_limit (
  ip_hash text not null,
  janela timestamptz not null,
  contagem integer not null default 1,
  primary key (ip_hash, janela)
);

-- ─── Regras prontas (todas desligadas; cada fase liga as suas) ───────────────
insert into public.automacoes (numero, chave, nome, gatilho, envia_ao_cliente, fase, descricao) values
  (1,  'lead_processar',          'Processar lead novo',              'lead.criado',          false, 1, 'Protocolo, dedup, enriquecimento, triagem IA e score'),
  (2,  'lead_confirmacao_cliente','Confirmação ao cliente',           'lead.criado',          true,  1, 'E-mail e WhatsApp com o protocolo'),
  (3,  'lead_avisar_equipe',      'Avisar a equipe',                  'lead.criado',          false, 1, 'Grupo de WhatsApp / e-mail / push com resumo e link'),
  (4,  'lead_atribuir',           'Atribuir responsável',             'lead.criado',          false, 1, 'Rodízio ou por tipo de serviço'),
  (5,  'sla_alerta',              'Alerta de SLA',                    'sla.vencendo',         false, 1, '4h antes: responsável · 1h antes: admin'),
  (6,  'lead_followup',           'Follow-up sem resposta',           'lead.sem_resposta',    true,  2, 'D+2, D+5, D+10; para ao receber resposta'),
  (7,  'negocio_parado',          'Negócio parado',                   'negocio.parado',       false, 2, 'Cria tarefa de follow-up'),
  (8,  'reuniao_lembretes',       'Lembretes de reunião',             'reuniao.agendada',     true,  2, '24h e 1h antes; tarefa de notas depois'),
  (9,  'proposta_visualizada',    'Proposta visualizada',             'proposta.visualizada', false, 3, 'Notifica o responsável na hora'),
  (10, 'proposta_followup',       'Follow-up de proposta',            'proposta.sem_resposta',true,  3, '3 dias sem resposta'),
  (11, 'proposta_aceita',         'Proposta aceita',                  'proposta.aceita',      true,  3, 'Ganho, projeto, contrato, 1ª fatura, boas-vindas'),
  (12, 'fatura_lembrete',         'Lembrete de cobrança',             'fatura.vencimento',    true,  4, 'D-3, D0, D+3'),
  (13, 'projeto_entregue',        'Projeto entregue',                 'projeto.entregue',     true,  4, 'NPS + oferta de Evolução contínua'),
  (14, 'relatorio_semanal',       'Relatório semanal',                'cron:seg_07h',         false, 2, 'Leads, SLA, funil, receita, gargalos'),
  (15, 'resumo_diario',           'Resumo do dia',                    'cron:diario_07h',      false, 2, 'Por pessoa: leads, tarefas, reuniões');

create trigger templates_updated_at before update on public.templates_mensagem for each row execute function public.set_updated_at();
create trigger automacoes_updated_at before update on public.automacoes for each row execute function public.set_updated_at();
