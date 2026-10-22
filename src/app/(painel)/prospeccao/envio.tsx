"use client";
import * as React from "react";
import { toast } from "sonner";
import { chamar } from "@/lib/chamar";
import { CANAIS_PROSPECT, type CanalProspect } from "@/lib/rotulos";
import type { ConfigProspeccao, Prospect } from "@/lib/dados/tipos";
import { hojeSp, linkInstagram, linkLinkedin, linkWhatsapp, rotuloDia, simularToque } from "@/lib/prospeccao";
import { cancelarEnvio, desfazerSituacao, enviarEmail, registrarToque } from "./acoes";

/** Dá para enviar com 1 clique por este canal? (telefone não: ligação se registra à mão) */
export function podeEnviar(p: Prospect, canal: CanalProspect) {
  if (canal === "email") return Boolean(p.email);
  if (canal === "whatsapp") return Boolean(p.whatsapp);
  if (canal === "linkedin") return Boolean(p.linkedin);
  if (canal === "instagram") return Boolean(p.instagram);
  return false;
}

export const rotuloEnviar = (canal: CanalProspect) =>
  canal === "email" ? "Enviar e-mail" : canal === "whatsapp" ? "Enviar no WhatsApp" : `Copiar e abrir ${CANAIS_PROSPECT[canal]}`;

/**
 * Envio com 1 clique.
 * - E-mail: o painel envia (fila → Resend) e registra o contato.
 * - WhatsApp: abre a conversa com a mensagem escrita (é só apertar enviar) e registra.
 * - LinkedIn/Instagram: copia a mensagem, abre o perfil e registra.
 * Sempre com "Desfazer" no aviso.
 */
export function useEnvio({ config, onAtualizar }: { config: ConfigProspeccao; onAtualizar: (id: string, patch: Partial<Prospect>) => void }) {
  const ocupado = React.useRef(new Set<string>());

  return React.useCallback(async (p: Prospect, canal: CanalProspect, msg: { texto: string; assunto?: string }) => {
    if (ocupado.current.has(p.id)) return false;
    if (!msg.texto.trim()) return void toast.error("Escreva a mensagem."), false;
    // Abrir janela precisa acontecer já no clique (senão o navegador bloqueia)
    if (canal === "whatsapp" && p.whatsapp) window.open(linkWhatsapp(p.whatsapp, msg.texto), "_blank", "noopener");
    if (canal === "linkedin" || canal === "instagram") {
      navigator.clipboard?.writeText(msg.texto).catch(() => {});
      const url = canal === "linkedin" ? p.linkedin && linkLinkedin(p.linkedin) : p.instagram && linkInstagram(p.instagram);
      if (url) window.open(url, "_blank", "noopener");
    }

    ocupado.current.add(p.id);
    const hoje = hojeSp();
    const antes = { situacao: p.situacao, proximo_contato: p.proximo_contato, toques: p.toques, motivo_encerramento: p.motivo_encerramento, canal: p.canal };
    onAtualizar(p.id, { ...simularToque(p, "enviada", config.ritmo, hoje), canal });
    try {
      const r = canal === "email"
        ? await chamar(enviarEmail(p.id, msg.assunto || `Stark · ${p.empresa}`, msg.texto))
        : await chamar(registrarToque(p.id, canal, "enviada", canal === "whatsapp" ? "Mensagem pelo WhatsApp" : `Mensagem pelo ${CANAIS_PROSPECT[canal]}`, null));
      if (!r.ok) { onAtualizar(p.id, antes); toast.error(r.erro); return false; }
      const d = r.dados as { situacao?: Prospect["situacao"]; proximo_contato?: string | null; toques?: number; mensagem_id?: string } | undefined;
      if (d?.situacao) onAtualizar(p.id, { situacao: d.situacao, proximo_contato: d.proximo_contato ?? null, toques: d.toques ?? p.toques + 1 });
      const prox = d?.proximo_contato ?? simularToque(p, "enviada", config.ritmo, hoje).proximo_contato;
      const titulo = canal === "email" ? `E-mail enviado para ${p.empresa}`
        : canal === "whatsapp" ? `WhatsApp aberto com a mensagem para ${p.empresa}`
        : `Mensagem copiada: cole no ${CANAIS_PROSPECT[canal]} de ${p.empresa}`;
      toast.success(titulo, {
        id: `envio-${p.id}`,
        description: prox ? `Contato registrado. Próximo: ${rotuloDia(prox, hoje)}.` : "Contato registrado.",
        duration: 8000,
        action: {
          label: "Desfazer",
          onClick: async () => {
            if (d?.mensagem_id) {
              const c = await chamar(cancelarEnvio(d.mensagem_id));
              if (c.ok && c.dados === false) toast.warning("O e-mail já tinha saído. Desfiz só o registro.");
            }
            onAtualizar(p.id, antes);
            const u = await chamar(desfazerSituacao(p.id, antes));
            if (!u.ok) toast.error(u.erro);
          },
        },
      });
      return true;
    } finally {
      ocupado.current.delete(p.id);
    }
  }, [config.ritmo, onAtualizar]);
}
