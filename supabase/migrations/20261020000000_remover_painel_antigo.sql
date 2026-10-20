-- ════════════════════════════════════════════════════════════════════════════
-- Painel Stark · 0000 · Arquiva o painel anterior do projeto stark-dashboard
--
-- O projeto já tinha um painel (migrations 01–12 de 15/10/2026: pedidos,
-- clientes, equipe…), com dados de teste. Em vez de apagar, move tudo para o
-- schema `legado` (fora da API, sem acesso de anon/authenticated). Reversível.
-- Para remover de vez, quando quiser: drop schema legado cascade;
-- Idempotente: num banco novo não faz nada. A conta em auth.users é mantida
-- e ganha perfil de admin em 0001 (que também substitui o gatilho de cadastro).
-- ════════════════════════════════════════════════════════════════════════════

create schema if not exists legado;
comment on schema legado is
  'Painel anterior (15/10/2026), arquivado pelo Painel Stark em 20/10/2026. Dados de teste. Remover: drop schema legado cascade;';
revoke all on schema legado from public;

-- Tarefas agendadas antigas
do $$
begin
  if to_regclass('cron.job') is not null then
    perform cron.unschedule(jobname) from cron.job where jobname in ('alertas-diarios', 'relatorio-mensal');
  end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'notificacoes', 'anexos', 'atividades', 'projeto_etapas', 'projetos', 'propostas', 'pedidos',
    'clientes', 'equipe', 'modelos_email', 'motivos_perda', 'origens', 'servicos', 'etapas_funil'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I set schema legado', t);
    end if;
  end loop;
end $$;

do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'anonimizar_cliente', 'autor_atual', 'calcular_resumos', 'eh_admin', 'eh_equipe',
        'gerar_alertas_diarios', 'gerar_relatorio_mensal', 'handle_new_user', 'hoje_sp',
        'painel_indicadores', 'pedidos_after_insert', 'pedidos_after_update', 'pedidos_before_insert',
        'pedidos_before_update', 'pedidos_notificar', 'pode_ver_cliente', 'pode_ver_pedido',
        'pode_ver_projeto', 'projetos_after_update', 'projetos_before_update', 'propostas_after_write',
        'propostas_before_write', 'proximo_dia_util', 'registrar_pedido', 'set_updated_at', 'somar_dias_uteis'
      ])
  loop
    execute format('alter function %s set schema legado', f);
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array['perfil_acesso', 'status_proposta', 'etapa_projeto', 'situacao_projeto', 'tipo_atividade'] loop
    if to_regtype('public.' || t) is not null then
      execute format('alter type public.%I set schema legado', t);
    end if;
  end loop;
end $$;
