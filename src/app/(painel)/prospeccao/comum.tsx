"use client";
// Peças pequenas da Prospecção: ícone do canal, selo da situação e os pontinhos de "contato 2 de 3".
import { AtSign, Camera, Mail, MessageCircle, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CANAIS_PROSPECT, ROTULO_SITUACAO_PROSPECT, type CanalProspect, type SituacaoProspect } from "@/lib/rotulos";
import type { Prospect } from "@/lib/dados/tipos";
import { atrasado, diasEntre, rotuloDia } from "@/lib/prospeccao";

/** LinkedIn não tem ícone na biblioteca (marca): um "in" no lugar. */
function In(props: { "aria-hidden"?: boolean }) {
  return <span {...props} className="text-[11px] font-bold leading-none">in</span>;
}
const ICONES: Record<CanalProspect, { Icone: typeof Mail | typeof In; cor: string }> = {
  linkedin: { Icone: In, cor: "text-series-2" },
  whatsapp: { Icone: MessageCircle, cor: "text-success" },
  email: { Icone: Mail, cor: "text-warning" },
  instagram: { Icone: Camera, cor: "text-series-6" },
  telefone: { Icone: Phone, cor: "text-fg-muted" },
};

export function IconeCanal({ canal, className }: { canal: CanalProspect; className?: string }) {
  const { Icone, cor } = ICONES[canal] ?? { Icone: AtSign, cor: "text-fg-muted" };
  return (
    <span title={CANAIS_PROSPECT[canal]} className={cn("relative grid size-8 shrink-0 place-items-center rounded-full bg-bloco [&_svg]:size-4", cor, className)}>
      <Icone aria-hidden /><span className="sr-only">{CANAIS_PROSPECT[canal]}</span>
    </span>
  );
}

const TOM: Record<SituacaoProspect, "neutral" | "info" | "success" | "accent" | "danger" | "outline"> = {
  a_abordar: "outline", contatado: "neutral", acompanhamento: "info", respondeu: "success", interessado: "accent", sem_interesse: "neutral", nao_abordar: "danger",
};
export function SeloSituacao({ situacao, className }: { situacao: SituacaoProspect; className?: string }) {
  return <Badge tone={TOM[situacao]} dot className={className}>{ROTULO_SITUACAO_PROSPECT[situacao]}</Badge>;
}

/** Contatos feitos do total do ritmo (ex.: ●●○ = 2 de 3). */
export function Pontos({ feitos, total }: { feitos: number; total: number }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${Math.min(feitos, total)} de ${total} contatos`} title={`${Math.min(feitos, total)} de ${total} contatos`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cn("size-2 rounded-full", i < feitos ? "bg-accent-fill" : "bg-border-strong")} />
      ))}
    </span>
  );
}

/** "atrasado 2 dias", "hoje", "qui, 24/10". */
export function Proximo({ p, hoje, className }: { p: Prospect; hoje: string; className?: string }) {
  if (!p.proximo_contato) return null;
  if (atrasado(p, hoje)) {
    const n = diasEntre(p.proximo_contato, hoje);
    return <span className={cn("text-xs text-danger", className)}>atrasado {n === 1 ? "1 dia" : `${n} dias`}</span>;
  }
  return <span className={cn("text-xs text-fg-muted", className)}>{rotuloDia(p.proximo_contato, hoje)}</span>;
}
