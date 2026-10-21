-- Painel Stark — 0013: um só vocabulário. "Prazo" (de 1 dia útil) em vez de "SLA" no que a equipe lê:
-- notificações, e-mails de alerta e nomes das automações. Negócio ganho/perdido não gera alerta de prazo. (só create or replace / update: nada é removido)

create or replace function public.verificar_sla() returns int
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_exec uuid;
  v_n int := 0;
  v_alerta interval := make_interval(hours => coalesce((select (valor #>> '{}')::int from public.app_config where chave = 'sla_alerta_horas'), 4));
  v_admins uuid[] := public.ids_equipe(array['admin']::public.papel_equipe[]);
  v_comercial uuid[] := public.ids_equipe(array['admin', 'comercial']::public.papel_equipe[]);
  v_painel text := coalesce((select valor #>> '{}' from public.app_config where chave = 'painel_url'), '');
  v_destinos uuid[];
  v_estagio text;
  v_titulo text;
  v_texto text;
begin
  for r in
    select l.id, l.protocolo, l.sla_vence_em, l.nome_informado, l.sla_vence_em - now() as falta,
           case when exists (select 1 from public.profiles p where p.id = l.responsavel_id and p.ativo) then l.responsavel_id end as resp
      from public.leads l
     where l.primeira_resposta_em is null
       and l.status in ('novo', 'em_atendimento')
       and l.sla_vence_em - now() <= v_alerta
       and not exists (select 1 from public.demo_registros d where d.tabela = 'leads' and d.id = l.id)
       and not exists (select 1 from public.negocios n where n.id = l.negocio_id and n.etapa in ('ganho', 'perdido'))
  loop
    v_estagio := case when r.falta < interval '0' then 'estourado' when r.falta <= interval '1 hour' then '1h' else '4h' end;
    v_exec := public.iniciar_execucao('sla_alerta', 'lead', r.id, v_estagio);
    if v_exec is null then continue; end if;

    -- estágios menos graves que ficaram para trás não disparam depois
    if v_estagio in ('1h', 'estourado') then perform public.iniciar_execucao('sla_alerta', 'lead', r.id, '4h'); end if;
    if v_estagio = 'estourado' then perform public.iniciar_execucao('sla_alerta', 'lead', r.id, '1h'); end if;
    update public.automacoes_execucoes set status = 'ignorada', finalizada_em = now(), resultado = jsonb_build_object('motivo', 'estagio_mais_grave_ja_alertado')
     where entidade_id = r.id and status = 'executando' and id <> v_exec
       and chave_idempotencia like 'sla_alerta:lead:%';

    v_destinos := case
      when v_estagio = '4h' then case when r.resp is null then v_comercial else array[r.resp] end
      when v_estagio = '1h' then array_remove(array[r.resp], null) || v_admins
      else array_remove(array[r.resp], null) || v_admins end;
    v_titulo := case v_estagio when '4h' then 'Prazo vencendo' when '1h' then 'Prazo vence em 1h' else 'Prazo estourado' end;
    v_texto := case v_estagio when '4h' then 'menos de 4h' when '1h' then 'menos de 1h' else 'prazo vencido' end;

    perform public.notificar(v_destinos, case v_estagio when '4h' then 'sla_vencendo' when '1h' then 'sla_critico' else 'sla_estourado' end,
      format('%s · %s %s', v_titulo, public.formatar_protocolo(r.protocolo), r.nome_informado),
      case v_estagio when 'estourado' then 'O prazo de 1 dia útil passou.' else 'Ninguém respondeu ainda: ' || v_texto || '.' end,
      '/leads?id=' || r.id);
    perform public.enfileirar_mensagem('email', 'equipe', pr.email, 'sla.alerta.equipe.email',
        jsonb_build_object('protocolo', public.formatar_protocolo(r.protocolo), 'nome_completo', r.nome_informado,
                           'faltam', v_texto, 'link', v_painel || '/leads?id=' || r.id),
        'sla_alerta:' || v_estagio || ':' || r.id || ':' || pr.id, v_exec, null, pr.id)
      from public.profiles pr where pr.ativo and pr.id = any (v_destinos);
    perform public.concluir_execucao(v_exec, jsonb_build_object('estagio', v_estagio));
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

update public.templates_mensagem
   set assunto = 'Prazo: {{faltam}} · pedido {{protocolo}}'
 where chave = 'sla.alerta.equipe.email';

update public.automacoes set nome = 'Alerta de prazo', descricao = 'Avisa quando o prazo de resposta está acabando: 4h antes, 1h antes e se estourar'
 where chave = 'sla_alerta';
update public.automacoes set descricao = 'Leads, prazo de resposta, funil, receita, gargalos'
 where chave = 'relatorio_semanal';
