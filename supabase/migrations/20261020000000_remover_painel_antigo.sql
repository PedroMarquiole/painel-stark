-- ════════════════════════════════════════════════════════════════════════════
-- Painel Stark · 0000 · Remove o painel anterior do projeto stark-dashboard
--
-- O projeto já tinha um painel (migrations 01–12 de 15/10/2026: pedidos,
-- clientes, equipe…). Os dados eram de teste — descarte confirmado pela Stark.
-- Idempotente: num banco novo não faz nada. A conta em auth.users é mantida
-- e ganha perfil de admin em 0001.
-- ════════════════════════════════════════════════════════════════════════════

-- Tarefas agendadas antigas
do $$
begin
  if to_regclass('cron.job') is not null then
    perform cron.unschedule(jobname) from cron.job where jobname in ('alertas-diarios', 'relatorio-mensal');
  end if;
end $$;

drop trigger if exists on_auth_user_created on auth.users;

drop table if exists
  public.notificacoes, public.anexos, public.atividades, public.projeto_etapas,
  public.projetos, public.propostas, public.pedidos, public.clientes, public.equipe,
  public.modelos_email, public.motivos_perda, public.origens, public.servicos, public.etapas_funil
  cascade;

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
    execute format('drop function if exists %s cascade', f);
  end loop;
end $$;

drop type if exists
  public.perfil_acesso, public.status_proposta, public.etapa_projeto,
  public.situacao_projeto, public.tipo_atividade
  cascade;
