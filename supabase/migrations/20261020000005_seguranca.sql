-- ════════════════════════════════════════════════════════════════════════════
-- Painel Stark · 0005 · Auditoria, RLS em TODAS as tabelas, Realtime
--
-- Papéis:  admin     → tudo
--          comercial → CRM, propostas, leitura de financeiro
--          projetos  → projetos/horas; leitura do CRM
-- anon não acessa nada. Ingestão, link público de proposta e NPS passam por
-- Edge Functions com service role (que ignora RLS) — chave nunca vai ao cliente.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Auditoria ──────────────────────────────────────────────────────────────
create table public.auditoria (
  id bigint generated always as identity primary key,
  tabela text not null,
  registro_id uuid,
  acao text not null check (acao in ('INSERT', 'UPDATE', 'DELETE')),
  ator_id uuid,                        -- null = sistema/automação
  alterado jsonb,                      -- UPDATE: só os campos que mudaram {campo: [antes, depois]}
  antes jsonb,
  depois jsonb,
  em timestamptz not null default now()
);
create index auditoria_registro on public.auditoria (tabela, registro_id, em desc);

create function public.registrar_auditoria() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_diff jsonb;
begin
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(k, jsonb_build_array(v_old -> k, v_new -> k)) into v_diff
      from jsonb_object_keys(v_new) k
     where k <> 'updated_at' and (v_old -> k) is distinct from (v_new -> k);
    if v_diff is null then return new; end if;
  end if;
  insert into public.auditoria (tabela, registro_id, acao, ator_id, alterado, antes, depois)
  values (tg_table_name, ((coalesce(v_new, v_old)) ->> 'id')::uuid, tg_op, auth.uid(), v_diff,
          case when tg_op = 'DELETE' then v_old end,
          case when tg_op = 'INSERT' then v_new end);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'empresas', 'contatos', 'leads', 'negocios', 'tarefas', 'reunioes',
    'propostas', 'projetos', 'contratos', 'faturas', 'automacoes', 'templates_mensagem', 'app_config'
  ] loop
    -- app_config usa chave text, não id: registro_id fica null e o diff guarda a mudança
    execute format('create trigger %I_auditoria after insert or update or delete on public.%I
                    for each row execute function public.registrar_auditoria()', t, t);
  end loop;
end $$;

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- Liga RLS em todas as tabelas do schema public, sem exceção.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Gerador de políticas: leitura para um conjunto de papéis, escrita para outro.
create function pg_temp.politicas(tabela text, ler text, escrever text) returns void
language plpgsql as $$
begin
  execute format('create policy %I on public.%I for select to authenticated using (%s)', tabela || '_ler', tabela, ler);
  if escrever is not null then
    execute format('create policy %I on public.%I for insert to authenticated with check (%s)', tabela || '_inserir', tabela, escrever);
    execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)', tabela || '_editar', tabela, escrever, escrever);
    execute format('create policy %I on public.%I for delete to authenticated using (%s)', tabela || '_apagar', tabela, escrever);
  end if;
end $$;

do $$
declare
  equipe     constant text := '(select public.is_equipe())';
  admin      constant text := '(select public.tem_papel(''admin''))';
  comercial  constant text := '(select public.tem_papel(''admin'', ''comercial''))';
  projetos   constant text := '(select public.tem_papel(''admin'', ''projetos''))';
  t text;
begin
  -- CRM: todos leem, comercial escreve
  foreach t in array array['empresas', 'contatos', 'leads', 'negocios', 'reunioes',
                           'propostas', 'proposta_itens', 'templates_mensagem'] loop
    perform pg_temp.politicas(t, equipe, comercial);
  end loop;
  perform pg_temp.politicas('proposta_visualizacoes', equipe, null);

  -- Colaborativo: qualquer pessoa da equipe registra atividade e tarefa
  perform pg_temp.politicas('atividades', equipe, equipe);
  perform pg_temp.politicas('tarefas', equipe, equipe);

  -- Projetos
  foreach t in array array['projetos', 'projeto_fases', 'entregas'] loop
    perform pg_temp.politicas(t, equipe, projetos);
  end loop;
  perform pg_temp.politicas('nps_respostas', equipe, null);

  -- Financeiro: admin e comercial leem, admin escreve
  perform pg_temp.politicas('contratos', comercial, admin);
  perform pg_temp.politicas('faturas', comercial, admin);

  -- Configuração e motor de regras
  foreach t in array array['app_config', 'feriados', 'etapas_config', 'automacoes'] loop
    perform pg_temp.politicas(t, equipe, admin);
  end loop;
  perform pg_temp.politicas('automacoes_execucoes', equipe, null);  -- escrita só pelo servidor
  perform pg_temp.politicas('mensagens_saida', equipe, null);
  perform pg_temp.politicas('auditoria', admin, null);
  -- ingest_rate_limit: RLS ligado e nenhuma política = só service role.
end $$;

-- Equipe: todos se veem; cada um edita o próprio perfil (trigger protege papel/ativo); admin edita todos
create policy profiles_ler on public.profiles for select to authenticated
  using ((select public.is_equipe()) or id = auth.uid());
create policy profiles_editar on public.profiles for update to authenticated
  using (id = auth.uid() or (select public.tem_papel('admin')))
  with check (id = auth.uid() or (select public.tem_papel('admin')));

-- Horas: todos leem; cada um aponta as suas; admin corrige qualquer uma
create policy horas_ler on public.apontamentos_horas for select to authenticated using ((select public.is_equipe()));
create policy horas_inserir on public.apontamentos_horas for insert to authenticated
  with check ((select public.is_equipe()) and (profile_id = auth.uid() or (select public.tem_papel('admin'))));
create policy horas_editar on public.apontamentos_horas for update to authenticated
  using (profile_id = auth.uid() or (select public.tem_papel('admin')))
  with check (profile_id = auth.uid() or (select public.tem_papel('admin')));
create policy horas_apagar on public.apontamentos_horas for delete to authenticated
  using (profile_id = auth.uid() or (select public.tem_papel('admin')));

-- Pessoais
create policy filtros_ler on public.filtros_salvos for select to authenticated
  using (profile_id = auth.uid() or (compartilhado and (select public.is_equipe())));
create policy filtros_escrever on public.filtros_salvos for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid() and (select public.is_equipe()));
create policy notificacoes_proprias on public.notificacoes for select to authenticated using (profile_id = auth.uid());
create policy notificacoes_marcar_lida on public.notificacoes for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy push_proprias on public.push_subscriptions for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- anon: nada. (Supabase concede privilégios de tabela ao anon por padrão; removemos por garantia.)
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
-- Funções do projeto (não as de extensões como citext/pg_trgm): ninguém executa por padrão.
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke execute on function %s from public, anon', f);
  end loop;
end $$;
grant execute on function public.is_equipe(), public.tem_papel(public.papel_equipe[]), public.papel_atual(),
  public.sla_deadline(timestamptz, int) to authenticated, service_role;

-- ─── Realtime (inbox ao vivo, kanban, notificações) ─────────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.leads, public.negocios, public.atividades, public.notificacoes, public.tarefas;
  end if;
end $$;
