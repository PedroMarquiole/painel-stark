-- ════════════════════════════════════════════════════════════════════════════
-- Painel Stark · 0019 · Base de empresas (dados abertos de CNPJ da Receita Federal)
--
-- Recorte carregado pelo robô do GitHub (.github/workflows/base-cnpj.yml):
-- estabelecimentos ATIVOS, sem MEI, com telefone ou e-mail, dos estados e ramos
-- escolhidos. A busca da Prospecção consulta aqui, sem serviço externo.
-- Dados públicos por lei (Receita Federal); a origem fica registrada no prospect.
-- ════════════════════════════════════════════════════════════════════════════

create table public.empresas_cnpj (
  cnpj text primary key check (cnpj ~ '^\d{14}$'),
  nome text not null,                 -- nome fantasia (ou razão social)
  razao text,
  cnae text not null check (cnae ~ '^\d{7}$'),
  uf char(2) not null,
  municipio text not null,
  municipio_norm text not null,       -- sem acento, minúsculo (para buscar)
  bairro text,
  endereco text,
  cep text,
  telefone text,
  telefone2 text,
  email text,
  abertura date,
  porte smallint,                     -- 1 micro · 3 pequena · 5 demais
  carregado_em date not null default current_date
);
create index empresas_cnpj_busca on public.empresas_cnpj (uf, municipio_norm, cnae);

alter table public.empresas_cnpj enable row level security;
create policy empresas_cnpj_ler on public.empresas_cnpj for select to authenticated using ((select public.is_equipe()));
revoke all on public.empresas_cnpj from anon;
grant select on public.empresas_cnpj to authenticated;

/** Busca por estado + cidade + prefixos de CNAE. Quem tem e-mail e celular vem primeiro. */
create or replace function public.buscar_empresas_cnpj(p_uf text, p_cidade text, p_cnaes text[], p_limite int default 50, p_pular int default 0)
returns jsonb
language sql stable security invoker set search_path = public as $$
  with alvo as (
    select e.* from public.empresas_cnpj e
     where e.uf = upper(p_uf)
       and e.municipio_norm = public.sem_acento(p_cidade)
       and e.cnae like any (select c || '%' from unnest(p_cnaes) c)
  )
  select jsonb_build_object(
    'total', (select count(*) from alvo),
    'itens', coalesce((select jsonb_agg(to_jsonb(x) - 'municipio_norm' - 'carregado_em') from (
      select * from alvo
       order by (email is not null) desc,
                (coalesce(telefone, '') ~ '^\(?\d{2}\)?\s?9\d{4}') desc,
                abertura desc nulls last
       limit least(greatest(p_limite, 1), 100) offset greatest(p_pular, 0)) x), '[]'::jsonb),
    'atualizado', (select max(carregado_em) from public.empresas_cnpj where uf = upper(p_uf))
  )
$$;
revoke execute on function public.buscar_empresas_cnpj(text, text, text[], int, int) from public, anon;
grant execute on function public.buscar_empresas_cnpj(text, text, text[], int, int) to authenticated;

/** Estados já carregados (a busca usa a base só onde ela existe). */
create or replace function public.ufs_cnpj()
returns text[]
language sql stable security invoker set search_path = public as $$
  select coalesce(array_agg(distinct uf order by uf), '{}') from public.empresas_cnpj
$$;
revoke execute on function public.ufs_cnpj() from public, anon;
grant execute on function public.ufs_cnpj() to authenticated;
