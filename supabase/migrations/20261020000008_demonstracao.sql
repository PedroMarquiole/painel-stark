-- ════════════════════════════════════════════════════════════════════════════
-- Painel Stark · 0008 · Dados de demonstração com limpeza em um passo
-- Os dados fictícios (supabase/seed_demo.sql) ficam registrados aqui.
-- Antes de usar para valer: select limpar_demonstracao();  (admin)
-- ════════════════════════════════════════════════════════════════════════════

create table public.demo_registros (
  tabela text not null check (tabela in ('empresas', 'contatos', 'negocios', 'leads')),
  id uuid not null,
  primary key (tabela, id)
);
alter table public.demo_registros enable row level security;
create policy demo_ler on public.demo_registros for select to authenticated using ((select public.is_equipe()));

create function public.limpar_demonstracao() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_leads int; v_neg int; v_cont int; v_emp int;
begin
  if auth.uid() is not null and not public.tem_papel('admin') then raise exception 'sem_permissao'; end if;
  delete from public.leads where id in (select id from public.demo_registros where tabela = 'leads');
  get diagnostics v_leads = row_count;
  delete from public.negocios where id in (select id from public.demo_registros where tabela = 'negocios');
  get diagnostics v_neg = row_count;
  delete from public.contatos where id in (select id from public.demo_registros where tabela = 'contatos');
  get diagnostics v_cont = row_count;
  delete from public.empresas where id in (select id from public.demo_registros where tabela = 'empresas');
  get diagnostics v_emp = row_count;
  delete from public.notificacoes where link like '/leads?id=%'
    and substring(link from 'id=(.*)$')::uuid not in (select id from public.leads);
  delete from public.demo_registros;
  return jsonb_build_object('leads', v_leads, 'negocios', v_neg, 'contatos', v_cont, 'empresas', v_emp);
end $$;
revoke execute on function public.limpar_demonstracao() from public, anon;
grant execute on function public.limpar_demonstracao() to authenticated;
