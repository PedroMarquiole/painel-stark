-- ════════════════════════════════════════════════════════════════════════════
-- Painel Stark · 0015 · Busca (⌘K) sem diferença de acento, por empresa e telefone
--
-- "clinica vitta" encontra "Clínica Vitta". Procura em contatos (nome, e-mail,
-- WhatsApp, empresa), negócios (título) e prospects (empresa, pessoa).
-- SECURITY INVOKER: a RLS de cada tabela continua valendo.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.sem_acento(t text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select translate(lower(coalesce(t, '')),
    'áàâãäåéèêëíìîïóòôõöúùûüçñý',
    'aaaaaaeeeeiiiiooooouuuucny')
$$;

create or replace function public.buscar_painel(p_termo text)
returns table (tipo text, id uuid, titulo text, subtitulo text)
language plpgsql stable security invoker set search_path = public as $$
declare
  q text := '%' || public.sem_acento(trim(p_termo)) || '%';
  dig text := regexp_replace(coalesce(p_termo, ''), '\D', '', 'g');
begin
  if length(trim(coalesce(p_termo, ''))) < 2 then return; end if;

  return query
  select 'contato'::text, c.id, c.nome, concat_ws(' · ', e.nome, c.email)
  from public.contatos c left join public.empresas e on e.id = c.empresa_id
  where public.sem_acento(c.nome) like q
     or public.sem_acento(c.email) like q
     or public.sem_acento(e.nome) like q
     or (length(dig) >= 4 and regexp_replace(coalesce(c.whatsapp, ''), '\D', '', 'g') like '%' || dig || '%')
  order by c.nome
  limit 6;

  return query
  select 'negocio'::text, n.id, n.titulo, 'Negócio'::text
  from public.negocios n
  where public.sem_acento(n.titulo) like q
  order by n.created_at desc
  limit 4;

  return query
  select 'prospect'::text, p.id, p.empresa, concat_ws(' · ', 'Prospecção', p.pessoa, p.cidade)
  from public.prospects p
  where public.sem_acento(p.empresa) like q
     or public.sem_acento(p.pessoa) like q
     or (length(dig) >= 4 and regexp_replace(coalesce(p.whatsapp, ''), '\D', '', 'g') like '%' || dig || '%')
  order by p.empresa
  limit 4;
end $$;

revoke all on function public.buscar_painel(text) from public, anon;
grant execute on function public.buscar_painel(text) to authenticated;
grant execute on function public.sem_acento(text) to authenticated, service_role;
