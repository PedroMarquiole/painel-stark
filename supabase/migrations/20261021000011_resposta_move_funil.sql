-- Painel Stark — 0011: a 1ª resposta ao cliente também anda o funil (Novo → Em triagem).
-- Respondeu = já está em conversa; o card não fica parado em "Novo" sem ninguém mexer.
-- (só create or replace / update: nada é removido)

create or replace function public.atividades_fecha_sla() returns trigger language plpgsql
security definer set search_path = public as $$
begin
  if new.direcao = 'saida' and not new.automatica
     and new.canal in ('email', 'whatsapp', 'ligacao', 'reuniao')
     and new.contato_id is not null then
    with respondidos as (
      update public.leads
         set primeira_resposta_em = new.ocorreu_em,
             primeira_resposta_por = new.autor_id,
             status = case when status = 'novo' then 'em_atendimento' else status end
       where contato_id = new.contato_id
         and primeira_resposta_em is null
         and created_at <= new.ocorreu_em
      returning negocio_id
    )
    -- O gatilho de etapa registra "Etapa: Novo → Em triagem" na linha do tempo
    update public.negocios n
       set etapa = 'triagem'
     where n.id in (select negocio_id from respondidos where negocio_id is not null)
       and n.etapa = 'novo';
  end if;
  return new;
end $$;

-- Quem já foi respondido antes desta regra também sai de "Novo"
update public.negocios n
   set etapa = 'triagem'
 where n.etapa = 'novo'
   and exists (select 1 from public.leads l where l.negocio_id = n.id and l.primeira_resposta_em is not null);
