-- ════════════════════════════════════════════════════════════════════════════
-- Painel Stark · 0017 · Prospecção: enviar e-mail com 1 clique, mensagens novas,
-- falha de envio explicada
--
-- 1. enviar_email_prospect: põe o e-mail na fila (o outbox-sender envia pelo Resend)
--    e registra o contato ("Mandei") na mesma hora.
-- 2. Modelos com assunto (e-mail) e textos novos.
-- 3. Erro que não adianta repetir (Resend em modo de teste, chave inválida) para
--    na hora e o aviso diz o que fazer.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.prospeccao_modelos add column if not exists assunto text check (char_length(assunto) <= 150);

insert into public.prospeccao_modelos (canal, toque, assunto, texto) values
  ('email', 1, E'{{empresa}}: uma pergunta rápida', E'Olá, {{pessoa}}!\n\nSou {{seu_nome}}, da Stark. Ajudamos empresas como a {{empresa}} a trocar planilhas, retrabalho e controles no WhatsApp por um sistema feito sob medida para o jeito que vocês já trabalham.\n\nUma pergunta rápida: hoje, qual processo aí toma mais tempo da equipe do que deveria?\n\nSe fizer sentido, te mostro em 20 minutos como resolveríamos isso, sem compromisso.\n\nAbraço,\n{{seu_nome}}\nStark · Software sob medida'),
  ('email', 2, E'Re: {{empresa}}: uma pergunta rápida', E'Oi, {{pessoa}}, tudo bem?\n\nVolto rapidinho ao meu e-mail anterior. Em empresas parecidas com a {{empresa}}, o que mais vemos é informação espalhada: pedido num lugar, cliente em outro e relatório montado na mão no fim do mês.\n\nQuando isso vira um sistema único, a equipe ganha horas por semana e para de depender de quem "sabe onde está tudo".\n\nVale uma conversa de 20 minutos esta semana? Me diga um horário e eu me encaixo.\n\n{{seu_nome}}\nStark · Software sob medida'),
  ('email', 3, E'Posso encerrar por aqui?', E'Oi, {{pessoa}}!\n\nNão quero lotar sua caixa de entrada, então este é meu último e-mail.\n\nSe em algum momento a {{empresa}} quiser organizar processos, automatizar tarefas repetitivas ou ter um painel com os números do negócio, é só responder esta mensagem.\n\nSucesso por aí!\n{{seu_nome}}\nStark · Software sob medida'),
  ('whatsapp', 1, null, E'Oi, {{pessoa}}! Tudo bem? Aqui é {{seu_nome}}, da Stark 👋\n\nA gente cria sistemas sob medida para empresas que ainda dependem de planilha e WhatsApp para controlar pedidos, clientes e equipe.\n\nPosso te fazer uma pergunta rápida sobre a {{empresa}}?'),
  ('whatsapp', 2, null, E'Oi, {{pessoa}}! Só retomando 🙂\n\nQual processo aí na {{empresa}} mais toma tempo hoje? Muitas vezes uma ferramenta simples resolve, e eu te mostro em 15 minutos como ficaria.'),
  ('whatsapp', 3, null, E'{{pessoa}}, última mensagem para não incomodar.\n\nSe um dia quiserem organizar a operação da {{empresa}} com um sistema próprio, é só me chamar aqui. Sucesso! 🚀'),
  ('linkedin', 1, null, E'Oi, {{pessoa}}! Sou {{seu_nome}}, da Stark. Criamos sistemas sob medida para tirar a operação de planilhas e processos manuais.\n\nFiquei curioso: como a {{empresa}} controla pedidos e clientes hoje?'),
  ('linkedin', 2, null, E'Oi, {{pessoa}}! Retomando: em empresas como a {{empresa}}, costumamos encontrar horas perdidas toda semana em controles manuais.\n\nSe fizer sentido, te mostro em 20 minutos um exemplo do que construímos. Que tal?'),
  ('linkedin', 3, null, E'{{pessoa}}, passando uma última vez. Se em algum momento quiserem automatizar algo na {{empresa}}, fico à disposição por aqui. Abraço!'),
  ('instagram', 1, null, E'Oi! Aqui é {{seu_nome}}, da Stark 👋 Curti o trabalho da {{empresa}}.\n\nA gente cria sistemas sob medida para organizar pedidos, clientes e agenda sem planilha. Posso te mostrar uma ideia rápida?'),
  ('instagram', 2, null, E'Oi de novo! Só retomando: se a {{empresa}} ainda controla pedidos ou clientes na mão, consigo te mostrar em 15 minutos como deixar isso automático. Bora?'),
  ('instagram', 3, null, E'Última mensagem para não incomodar 🙂 Se um dia quiserem uma ferramenta própria para a {{empresa}}, é só chamar. Sucesso!')
on conflict (canal, toque) do update set assunto = excluded.assunto, texto = excluded.texto, updated_at = now();

create or replace function public.enviar_email_prospect(p_prospect uuid, p_assunto text, p_corpo text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare p public.prospects%rowtype; r jsonb; v_msg uuid;
begin
  if not public.tem_papel('admin', 'comercial') then raise exception 'sem_permissao'; end if;
  select * into p from public.prospects where id = p_prospect;
  if not found then raise exception 'prospect_nao_encontrado'; end if;
  if p.situacao in ('nao_abordar', 'interessado') then raise exception 'nao_abordar'; end if;
  if coalesce(p.email, '') = '' then raise exception 'sem_email'; end if;
  if coalesce(btrim(p_assunto), '') = '' or coalesce(btrim(p_corpo), '') = '' then raise exception 'mensagem_vazia'; end if;

  insert into public.mensagens_saida (canal, destino_tipo, destinatario, profile_id, assunto, corpo, chave_idempotencia)
  values ('email', 'cliente', p.email, auth.uid(), left(btrim(p_assunto), 150), left(p_corpo, 5000),
          format('prospect:%s:%s', p.id, gen_random_uuid()))
  returning id into v_msg;

  r := public.registrar_toque_prospect(p_prospect, 'email', 'enviada', 'E-mail: ' || left(btrim(p_assunto), 150), null);
  return r || jsonb_build_object('mensagem_id', v_msg);
end $$;

revoke execute on function public.enviar_email_prospect(uuid, text, text) from public, anon;
grant execute on function public.enviar_email_prospect(uuid, text, text) to authenticated;

/** Desfazer logo depois de enviar: cancela o e-mail se ainda está na fila. */
create or replace function public.cancelar_envio_prospect(p_mensagem uuid)
returns boolean
language sql security definer set search_path = public as $$
  with c as (
    update public.mensagens_saida set status = 'cancelada'
     where id = p_mensagem and status = 'pendente' and profile_id = auth.uid() and chave_idempotencia like 'prospect:%'
    returning 1)
  select exists (select 1 from c)
$$;
revoke execute on function public.cancelar_envio_prospect(uuid) from public, anon;
grant execute on function public.cancelar_envio_prospect(uuid) to authenticated;

/** Envios que falharam nos últimos 7 dias (para o aviso no painel). */
create or replace function public.envios_com_falha()
returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not public.is_equipe() then '[]'::jsonb else coalesce((
    select jsonb_agg(jsonb_build_object('erro', erro, 'n', n, 'ultimo', ultimo) order by ultimo desc)
      from (select left(erro, 300) as erro, count(*) as n, max(created_at) as ultimo
              from public.mensagens_saida
             where status = 'erro' and tentativas >= max_tentativas and created_at > now() - interval '7 days'
             group by left(erro, 300)) x), '[]'::jsonb) end
$$;
revoke execute on function public.envios_com_falha() from public, anon;
grant execute on function public.envios_com_falha() to authenticated;

create or replace function public.concluir_mensagem(p_id uuid, p_ok boolean, p_provider text default null,
                                                    p_provider_id text default null, p_erro text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare m public.mensagens_saida%rowtype;
begin
  if p_ok then
    update public.mensagens_saida
       set status = 'enviada', enviada_em = now(), provider = p_provider, provider_message_id = p_provider_id, erro = null
     where id = p_id
    returning * into m;
    if m.destino_tipo = 'cliente' and m.execucao_id is not null then
      insert into public.atividades (tipo, canal, direcao, automatica, contato_id, lead_id, titulo, corpo, meta)
      select 'mensagem', m.canal::public.canal, 'saida', true, m.contato_id,
             (select e.entidade_id from public.automacoes_execucoes e where e.id = m.execucao_id and e.entidade_tipo = 'lead'),
             coalesce(m.assunto, 'Mensagem automática'), m.corpo, jsonb_build_object('mensagem_id', m.id)
      where m.canal in ('email', 'whatsapp');
    end if;
  else
    update public.mensagens_saida
       set status = 'erro', erro = left(p_erro, 1000),
           agendada_para = now() + make_interval(mins => power(2, greatest(tentativas - 1, 0))::int),
           -- erro que não se resolve tentando de novo (conta/domínio do Resend): para já e avisa
           tentativas = case when p_erro ~* '(verify a domain|validation_error|own email address|api key is invalid)' then max_tentativas else tentativas end
     where id = p_id
    returning * into m;
    -- Última tentativa (ou erro definitivo): marca a execução como erro e avisa os admins (falha não fica invisível)
    if m.tentativas >= m.max_tentativas then
      if m.execucao_id is not null then
        update public.automacoes_execucoes set status = 'erro', erro = left(p_erro, 500), finalizada_em = now() where id = m.execucao_id;
      end if;
      perform public.notificar(public.ids_equipe(array['admin']::public.papel_equipe[]), 'envio_falhou',
        format('Falha ao enviar %s para %s', case m.canal when 'email' then 'e-mail' else m.canal end, m.destinatario),
        case when p_erro ~* '(verify a domain|own email address)'
             then 'O Resend ainda está em modo de teste: verifique o domínio da Stark em resend.com/domains para os e-mails chegarem aos clientes.'
             else left(p_erro, 160) end,
        '/automacoes');
    end if;
  end if;
end $$;
