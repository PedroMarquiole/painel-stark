-- ════════════════════════════════════════════════════════════════════════════
-- Painel Stark · 0009 · Indicadores da home (período atual × anterior)
-- security invoker: respeita a RLS de quem consulta.
-- ════════════════════════════════════════════════════════════════════════════

create function public.painel_indicadores(p_dias int default 30) returns jsonb
language sql stable security invoker set search_path = public as $$
with
lim as (
  select now() - make_interval(days => p_dias) as ini,
         now() - make_interval(days => 2 * p_dias) as ini_ant,
         now() as fim
),
l as (
  select l.*, (l.created_at >= lim.ini) as atual, (l.created_at >= lim.ini_ant and l.created_at < lim.ini) as anterior
  from public.leads l, lim
  where l.created_at >= lim.ini_ant
),
resp as (
  select atual, anterior,
         avg(extract(epoch from (primeira_resposta_em - created_at)) / 3600.0)
           filter (where primeira_resposta_em is not null) as horas,
         count(*) filter (where primeira_resposta_em is not null and primeira_resposta_em <= sla_vence_em) as no_prazo,
         count(*) filter (where primeira_resposta_em is not null or sla_vence_em < now()) as decididos
  from l group by atual, anterior
),
neg as (
  select n.*,
         case when n.etapa = 'perdido'
              then coalesce((select (a.meta ->> 'de')::public.etapa_negocio from public.atividades a
                              where a.negocio_id = n.id and a.tipo = 'mudanca_etapa' and a.meta ->> 'para' = 'perdido'
                              order by a.ocorreu_em desc limit 1), 'novo')
              else n.etapa end as etapa_alcancada
  from public.negocios n
),
fechados as (
  select (coalesce(ganho_em, perdido_em) >= lim.ini) as atual, etapa, valor_estimado, created_at, ganho_em, motivo_perda
  from neg, lim
  where coalesce(ganho_em, perdido_em) >= lim.ini_ant
),
semanas as (
  select generate_series(date_trunc('week', now()) - interval '7 weeks', date_trunc('week', now()), interval '1 week') as semana
)
select jsonb_build_object(
  'dias', p_dias,
  'leads', jsonb_build_object('atual', (select count(*) from l where atual), 'anterior', (select count(*) from l where anterior)),
  'primeira_resposta_horas', jsonb_build_object(
     'atual', (select round(horas::numeric, 1) from resp where atual),
     'anterior', (select round(horas::numeric, 1) from resp where anterior)),
  'sla_pct', jsonb_build_object(
     'atual', (select round(100.0 * no_prazo / nullif(decididos, 0)) from resp where atual),
     'anterior', (select round(100.0 * no_prazo / nullif(decididos, 0)) from resp where anterior)),
  'ganhos', jsonb_build_object(
     'atual', (select count(*) from fechados where atual and etapa = 'ganho'),
     'anterior', (select count(*) from fechados where not atual and etapa = 'ganho')),
  'receita', jsonb_build_object(
     'atual', (select coalesce(sum(valor_estimado), 0) from fechados where atual and etapa = 'ganho'),
     'anterior', (select coalesce(sum(valor_estimado), 0) from fechados where not atual and etapa = 'ganho')),
  'ticket_medio', jsonb_build_object(
     'atual', (select round(avg(valor_estimado)) from fechados where atual and etapa = 'ganho'),
     'anterior', (select round(avg(valor_estimado)) from fechados where not atual and etapa = 'ganho')),
  'taxa_ganho_pct', jsonb_build_object(
     'atual', (select round(100.0 * count(*) filter (where etapa = 'ganho') / nullif(count(*), 0)) from fechados where atual),
     'anterior', (select round(100.0 * count(*) filter (where etapa = 'ganho') / nullif(count(*), 0)) from fechados where not atual)),
  'ciclo_dias', jsonb_build_object(
     'atual', (select round(avg(extract(epoch from ganho_em - created_at) / 86400.0)::numeric, 1) from fechados where atual and etapa = 'ganho'),
     'anterior', (select round(avg(extract(epoch from ganho_em - created_at) / 86400.0)::numeric, 1) from fechados where not atual and etapa = 'ganho')),
  'pipeline_ponderado', (select coalesce(round(sum(valor_estimado * probabilidade / 100.0)), 0)
                           from public.negocios where etapa not in ('ganho', 'perdido')),
  'pipeline_aberto', (select coalesce(sum(valor_estimado), 0) from public.negocios where etapa not in ('ganho', 'perdido')),
  'mrr', (select coalesce(sum(valor_mensal), 0) from public.contratos
           where tipo = 'recorrente' and status = 'ativo' and inicio <= current_date and (fim is null or fim >= current_date)),
  'sla_agora', (select jsonb_build_object(
       'abertos', count(*),
       'vencendo', count(*) filter (where sla_vence_em >= now() and sla_vence_em < now() + interval '4 hours'),
       'estourados', count(*) filter (where sla_vence_em < now()))
     from public.leads where primeira_resposta_em is null and status in ('novo', 'em_atendimento')),
  'por_servico', (select coalesce(jsonb_agg(jsonb_build_object('servico', s, 'n', n) order by n desc, s), '[]')
     from (select unnest(servicos) as s, count(*) as n from l where atual group by 1) x),
  'por_origem', (select coalesce(jsonb_agg(jsonb_build_object('origem', o, 'n', n) order by n desc, o), '[]')
     from (select coalesce(nullif(utm_source, ''), nullif(origem_informada, ''), 'direto') as o, count(*) as n from l where atual group by 1) x),
  'por_situacao', (select coalesce(jsonb_agg(jsonb_build_object('situacao', s, 'n', n) order by n desc), '[]')
     from (select coalesce(situacao_atual::text, 'nao_informado') as s, count(*) as n from l where atual group by 1) x),
  'motivos_perda', (select coalesce(jsonb_agg(jsonb_build_object('motivo', m, 'n', n) order by n desc), '[]')
     from (select motivo_perda::text as m, count(*) as n from fechados where atual and etapa = 'perdido' group by 1) x),
  'funil', (select jsonb_agg(jsonb_build_object('etapa', c.etapa, 'rotulo', c.rotulo,
              'n', (select count(*) from neg, lim where neg.created_at >= lim.ini_ant
                      and (select ordem from public.etapas_config e where e.etapa = neg.etapa_alcancada) >= c.ordem)) order by c.ordem)
            from public.etapas_config c where c.etapa <> 'perdido'),
  'serie', (select jsonb_agg(jsonb_build_object(
       'semana', to_char(s.semana, 'DD/MM'),
       'leads', (select count(*) from public.leads x where x.created_at >= s.semana and x.created_at < s.semana + interval '1 week'),
       'resposta_horas', (select round(avg(extract(epoch from (x.primeira_resposta_em - x.created_at)) / 3600.0)::numeric, 1)
                          from public.leads x where x.created_at >= s.semana and x.created_at < s.semana + interval '1 week'
                            and x.primeira_resposta_em is not null),
       'sla_pct', (select round(100.0 * count(*) filter (where x.primeira_resposta_em <= x.sla_vence_em)
                           / nullif(count(*) filter (where x.primeira_resposta_em is not null or x.sla_vence_em < now()), 0))
                   from public.leads x where x.created_at >= s.semana and x.created_at < s.semana + interval '1 week'),
       'receita', (select coalesce(sum(n.valor_estimado), 0) from public.negocios n
                   where n.etapa = 'ganho' and n.ganho_em >= s.semana and n.ganho_em < s.semana + interval '1 week')
     ) order by s.semana) from semanas s)
)
$$;

grant execute on function public.painel_indicadores(int) to authenticated;
