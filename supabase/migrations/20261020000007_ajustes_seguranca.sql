-- ════════════════════════════════════════════════════════════════════════════
-- Painel Stark · 0007 · Ajustes apontados pelo Security Advisor do Supabase
-- ════════════════════════════════════════════════════════════════════════════

-- search_path fixo em todas as funções do projeto
alter function public.render_template(text, jsonb) set search_path = public;
alter function public.gerar_feriados(int) set search_path = public;
alter function public.set_updated_at() set search_path = public;
alter function public.pascoa(int) set search_path = public;
alter function public.formatar_protocolo(bigint) set search_path = public;
alter function public.normalizar_whatsapp(text) set search_path = public;
alter function public.rotulo_servico(public.servico) set search_path = public;

-- Funções privadas por padrão: nem anon nem authenticated executam via API.
-- (Gatilhos disparam sem precisar de EXECUTE; RLS usa só os helpers liberados abaixo.)
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- O que a equipe logada pode chamar (RLS e ações do painel)
grant execute on function
  public.is_equipe(), public.tem_papel(public.papel_equipe[]), public.papel_atual(),
  public.sla_deadline(timestamptz, int), public.formatar_protocolo(bigint), public.rotulo_servico(public.servico),
  public.criar_lead_manual(jsonb), public.responder_lead(uuid, text, text, text)
to authenticated;

-- Funções criadas no futuro nascem privadas
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ingest_rate_limit é só do servidor; política explícita deixa isso claro
create policy ingest_rate_limit_ninguem on public.ingest_rate_limit for all to authenticated using (false) with check (false);
