-- Painel Stark — 0012: mover o card não apaga a probabilidade ajustada à mão.
-- A padrão da nova etapa só entra se a atual ainda era a padrão da etapa anterior.
-- Ganho e Perdido continuam 100% e 0%. (só create or replace: nada é removido)

create or replace function public.negocios_mudanca_etapa() returns trigger language plpgsql
security definer set search_path = public as $$
begin
  if new.etapa is distinct from old.etapa then
    new.etapa_desde := now();
    new.ganho_em := case when new.etapa = 'ganho' then now() end;
    new.perdido_em := case when new.etapa = 'perdido' then now() end;
    if new.etapa in ('ganho', 'perdido')
       or (new.probabilidade = old.probabilidade
           and old.probabilidade = (select probabilidade_padrao from public.etapas_config where etapa = old.etapa)) then
      new.probabilidade := (select probabilidade_padrao from public.etapas_config where etapa = new.etapa);
    end if;
    insert into public.atividades (tipo, canal, direcao, contato_id, negocio_id, autor_id, titulo, meta)
    values ('mudanca_etapa', 'sistema', 'interna', new.contato_id, new.id, auth.uid(),
            format('Etapa: %s → %s',
                   (select rotulo from public.etapas_config where etapa = old.etapa),
                   (select rotulo from public.etapas_config where etapa = new.etapa)),
            jsonb_build_object('de', old.etapa, 'para', new.etapa, 'motivo_perda', new.motivo_perda));
  end if;
  return new;
end $$;
