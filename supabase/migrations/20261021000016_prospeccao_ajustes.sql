-- ════════════════════════════════════════════════════════════════════════════
-- Painel Stark · 0016 · Prospecção: ajustes do pente fino
--
-- 1. Registrar contato num prospect encerrado (Sem interesse) reabre de verdade:
--    limpa o encerramento e "Pediu para falar depois" volta para a lista do dia.
--    Reaberto depois de N contatos ganha mais um ciclo (não fecha no 1º "Mandei").
-- 2. "Pediu para falar depois" conta como contato feito (não fica "0 de 3").
-- 3. Desfazer devolve o prospect exatamente como estava (data, contatos, situação).
-- 4. "Responderam %": quem respondeu já no 1º contato também conta como abordado;
--    o canal é o do 1º contato registrado.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.registrar_toque_prospect(p_prospect uuid, p_canal text, p_resultado text,
                                                           p_anotacao text default null, p_proximo date default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p public.prospects%rowtype;
  v_ritmo int[] := coalesce((select array(select jsonb_array_elements_text(valor)::int) from public.app_config where chave = 'prospeccao_ritmo'), array[3, 4]);
  v_max int;
  v_hoje date := public.hoje_sp();
begin
  if not public.tem_papel('admin', 'comercial') then raise exception 'sem_permissao'; end if;
  if p_resultado not in ('enviada', 'respondeu', 'depois', 'sem_interesse', 'nota') then raise exception 'resultado_invalido'; end if;
  select * into p from public.prospects where id = p_prospect for update;
  if not found then raise exception 'prospect_nao_encontrado'; end if;
  if p.situacao = 'nao_abordar' then raise exception 'nao_abordar'; end if;
  if p.situacao = 'interessado' and p_resultado <> 'nota' then raise exception 'ja_virou_negocio'; end if;
  if p_proximo is not null and p_proximo < v_hoje then raise exception 'data_no_passado'; end if;
  if p_resultado = 'depois' and p_proximo is null then raise exception 'informe_a_data'; end if;
  v_max := cardinality(v_ritmo) + 1;  -- contatos sem resposta antes de encerrar (padrão 3)

  insert into public.prospeccao_toques (prospect_id, canal, resultado, anotacao, autor_id)
  values (p_prospect, coalesce(p_canal, p.canal), p_resultado, nullif(btrim(p_anotacao), ''), auth.uid());

  if p_resultado = 'nota' then
    return jsonb_build_object('situacao', p.situacao, 'proximo_contato', p.proximo_contato, 'toques', p.toques);
  end if;

  -- Contato com quem estava encerrado: reabre (mais um ciclo de contatos)
  if p.situacao = 'sem_interesse' and p_resultado <> 'sem_interesse' then
    p.encerrado_em := null;
    p.motivo_encerramento := null;
    p.toques := least(p.toques, v_max - 1);
    p.situacao := case when p.toques = 0 then 'a_abordar' else 'acompanhamento' end;
  end if;

  p.ultimo_contato_em := now();
  p.responsavel_id := coalesce(p.responsavel_id, auth.uid());
  if p_canal is not null then p.canal := p_canal; end if;

  if p_resultado = 'enviada' then
    p.toques := p.toques + 1;
    if p.toques >= v_max then
      -- N contatos sem resposta: encerra (dá para reabrir)
      p.situacao := 'sem_interesse';
      p.proximo_contato := null;
      p.encerrado_em := now();
      p.motivo_encerramento := format('Sem resposta depois de %s contatos', p.toques);
    else
      p.situacao := case when p.toques = 1 then 'contatado' else 'acompanhamento' end;
      p.proximo_contato := coalesce(p_proximo, public.somar_dias_uteis(v_hoje, v_ritmo[p.toques]));
    end if;
  elsif p_resultado = 'respondeu' then
    p.toques := greatest(p.toques, 1);
    p.situacao := 'respondeu';
    p.proximo_contato := coalesce(p_proximo, public.somar_dias_uteis(v_hoje, 1));
  elsif p_resultado = 'depois' then
    p.toques := greatest(p.toques, 1);  -- conversaram: conta como contato
    p.situacao := case when p.situacao in ('a_abordar', 'contatado') then 'contatado' else p.situacao end;
    p.proximo_contato := p_proximo;
  elsif p_resultado = 'sem_interesse' then
    p.situacao := 'sem_interesse';
    p.proximo_contato := null;
    p.encerrado_em := now();
    p.motivo_encerramento := coalesce(nullif(btrim(p_anotacao), ''), 'Disse que não tem interesse');
  end if;

  update public.prospects set
    situacao = p.situacao, toques = p.toques, proximo_contato = p.proximo_contato, ultimo_contato_em = p.ultimo_contato_em,
    encerrado_em = p.encerrado_em, motivo_encerramento = p.motivo_encerramento, responsavel_id = p.responsavel_id, canal = p.canal
   where id = p_prospect;
  return jsonb_build_object('situacao', p.situacao, 'proximo_contato', p.proximo_contato, 'toques', p.toques);
end $$;

/**
 * Desfazer (aviso "Desfazer" depois de mudar a situação ou arrastar no Pipeline):
 * devolve situação, data do próximo contato, contatos e encerramento como estavam.
 */
create or replace function public.desfazer_situacao_prospect(p_prospect uuid, p_situacao text, p_proximo date, p_toques int,
                                                  p_motivo text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare p public.prospects%rowtype;
begin
  if not public.tem_papel('admin', 'comercial') then raise exception 'sem_permissao'; end if;
  if p_situacao not in ('a_abordar', 'contatado', 'acompanhamento', 'respondeu', 'sem_interesse', 'nao_abordar') then raise exception 'situacao_invalida'; end if;
  select * into p from public.prospects where id = p_prospect for update;
  if not found then raise exception 'prospect_nao_encontrado'; end if;
  if p.situacao = 'interessado' then raise exception 'ja_virou_negocio'; end if;

  update public.prospects set
    situacao = p_situacao,
    proximo_contato = p_proximo,
    toques = greatest(coalesce(p_toques, toques), 0),
    encerrado_em = case when p_situacao in ('sem_interesse', 'nao_abordar') then coalesce(encerrado_em, now()) end,
    motivo_encerramento = case when p_situacao in ('sem_interesse', 'nao_abordar') then coalesce(p_motivo, motivo_encerramento) end
   where id = p_prospect
  returning * into p;

  insert into public.prospeccao_toques (prospect_id, resultado, anotacao, autor_id)
  values (p_prospect, 'reaberto', 'Desfeito', auth.uid());
  return jsonb_build_object('situacao', p.situacao, 'proximo_contato', p.proximo_contato, 'toques', p.toques);
end $$;

revoke execute on function public.desfazer_situacao_prospect(uuid, text, date, int, text) from public, anon;
grant execute on function public.desfazer_situacao_prospect(uuid, text, date, int, text) to authenticated;

/** Números do topo da aba. Semana começa na segunda (São Paulo). */
create or replace function public.prospeccao_indicadores() returns jsonb
language sql stable security invoker set search_path = public as $$
  with semana as (select date_trunc('week', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo' as ini),
  abordados as (   -- prospects com algum contato de fato nos últimos 30 dias; canal = o do 1º contato
    select p.id,
           coalesce((select t.canal from public.prospeccao_toques t
                      where t.prospect_id = p.id and t.resultado in ('enviada', 'respondeu', 'depois', 'sem_interesse', 'interessado') and t.canal is not null
                      order by t.ocorreu_em limit 1), p.canal) as canal,
           exists (select 1 from public.prospeccao_toques t where t.prospect_id = p.id and t.resultado in ('respondeu', 'interessado', 'depois')) as respondeu
      from public.prospects p
     where exists (select 1 from public.prospeccao_toques t
                    where t.prospect_id = p.id and t.resultado in ('enviada', 'respondeu', 'depois', 'sem_interesse', 'interessado')
                      and t.ocorreu_em > now() - interval '30 days')
  )
  select jsonb_build_object(
    'hoje', (select count(*) from public.prospects where situacao in ('a_abordar', 'contatado', 'acompanhamento', 'respondeu') and proximo_contato <= public.hoje_sp()),
    'atrasados', (select count(*) from public.prospects where situacao in ('a_abordar', 'contatado', 'acompanhamento', 'respondeu') and proximo_contato < public.hoje_sp()),
    'a_abordar', (select count(*) from public.prospects where situacao = 'a_abordar'),
    'contatos_semana', (select count(*) from public.prospeccao_toques, semana where resultado = 'enviada' and ocorreu_em >= semana.ini),
    'meta_semana', (select nullif((valor #>> '{}')::int, 0) from public.app_config where chave = 'prospeccao_meta_semana' and jsonb_typeof(valor) = 'number'),
    'resposta_pct', (select round(100.0 * count(*) filter (where respondeu) / nullif(count(*), 0)) from abordados),
    'por_canal', (select coalesce(jsonb_agg(jsonb_build_object('canal', canal, 'n', n, 'pct', pct) order by pct desc nulls last), '[]')
                    from (select canal, count(*) n, round(100.0 * count(*) filter (where respondeu) / nullif(count(*), 0)) pct
                            from abordados group by canal) x),
    'viraram_negocio', (select count(*) from public.prospects where situacao = 'interessado' and encerrado_em > now() - interval '30 days'),
    'valor_no_funil', (select coalesce(sum(n.valor_estimado), 0) from public.prospects p join public.negocios n on n.id = p.negocio_id
                        where p.situacao = 'interessado' and n.etapa not in ('ganho', 'perdido'))
  )
$$;

/** Mudar a situação à mão. Reabrir quem fechou depois de N contatos dá mais um ciclo (não fecha no próximo "Mandei"). */
create or replace function public.mudar_situacao_prospect(p_prospect uuid, p_situacao text, p_motivo text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p public.prospects%rowtype;
  v_hoje date := public.hoje_sp();
  v_max int := coalesce((select jsonb_array_length(valor) from public.app_config where chave = 'prospeccao_ritmo'), 2) + 1;
begin
  if not public.tem_papel('admin', 'comercial') then raise exception 'sem_permissao'; end if;
  if p_situacao not in ('a_abordar', 'contatado', 'acompanhamento', 'respondeu', 'sem_interesse', 'nao_abordar') then raise exception 'situacao_invalida'; end if;
  select * into p from public.prospects where id = p_prospect for update;
  if not found then raise exception 'prospect_nao_encontrado'; end if;
  if p.situacao = 'interessado' then raise exception 'ja_virou_negocio'; end if;
  if p.situacao = p_situacao then return jsonb_build_object('situacao', p.situacao, 'proximo_contato', p.proximo_contato); end if;

  update public.prospects set
    situacao = p_situacao,
    proximo_contato = case when p_situacao in ('sem_interesse', 'nao_abordar') then null
                           when p.situacao in ('sem_interesse', 'nao_abordar') or p.proximo_contato is null then v_hoje
                           else p.proximo_contato end,
    toques = case when p_situacao = 'a_abordar' then 0
                  when p.situacao in ('sem_interesse', 'nao_abordar') then least(toques, v_max - 1)
                  else toques end,
    encerrado_em = case when p_situacao in ('sem_interesse', 'nao_abordar') then now() end,
    motivo_encerramento = case when p_situacao in ('sem_interesse', 'nao_abordar') then coalesce(nullif(btrim(p_motivo), ''), motivo_encerramento) end
   where id = p_prospect
  returning * into p;

  insert into public.prospeccao_toques (prospect_id, resultado, anotacao, autor_id)
  values (p_prospect,
          case p_situacao when 'nao_abordar' then 'nao_abordar' when 'sem_interesse' then 'sem_interesse' else 'reaberto' end,
          coalesce(nullif(btrim(p_motivo), ''), 'Situação mudada para ' || p_situacao), auth.uid());
  return jsonb_build_object('situacao', p.situacao, 'proximo_contato', p.proximo_contato, 'toques', p.toques);
end $$;
