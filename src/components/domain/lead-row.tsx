"use client";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { HoverCard } from "@/components/ui/hover-card";
import { SlaBadge } from "./sla-badge";
import { cn, formatProtocolo, formatRelative } from "@/lib/utils";
import { useNow } from "@/hooks/use-now";

export interface LeadRowData {
  id: string;
  protocolo: number;
  nome: string;
  empresa?: string;
  email: string;
  whatsapp: string;
  servicos: string[];
  situacao?: string;
  dor: string;
  origem: string;
  createdAt: Date;
  slaDeadline: Date;
  respondedAt?: Date | null;
  responsavel?: string;
  score?: number;
  isNew?: boolean;
}

export const LEAD_GRID =
  "grid grid-cols-[64px_minmax(160px,1.1fr)_minmax(140px,1fr)_minmax(200px,2fr)_96px_56px_112px_28px] items-center gap-3";

/** Linha da caixa de entrada. Densidade via --row-h. Selecionada = barra de acento à esquerda. */
export function LeadRow({ lead, selected, onOpen }: { lead: LeadRowData; selected?: boolean; onOpen?: () => void }) {
  const now = useNow();
  return (
    <div
      role="row"
      tabIndex={0}
      aria-selected={selected}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen?.()}
      style={{ minHeight: "var(--row-h)" }}
      className={cn(
        LEAD_GRID,
        "relative cursor-default border-b border-border px-4 text-sm transition-colors duration-100 hover:bg-overlay/50 focus-visible:outline-none focus-visible:bg-overlay/60",
        selected && "bg-overlay/60 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-accent",
        lead.isNew && "animate-[enter_200ms_ease-out,highlight_2.4s_ease-out]",
      )}
    >
      <span className="num text-xs text-fg-muted">{formatProtocolo(lead.protocolo)}</span>
      <span className="flex min-w-0 items-center gap-2">
        <HoverCard
          trigger={<span className="truncate font-medium hover:underline hover:decoration-fg-subtle hover:underline-offset-4">{lead.nome}</span>}
        >
          <p className="text-sm font-medium">{lead.nome}</p>
          <p className="text-xs text-fg-muted">{lead.empresa ?? "Sem empresa"}</p>
          <dl className="mt-3 grid grid-cols-[72px_1fr] gap-y-1 text-xs">
            <dt className="text-fg-subtle">E-mail</dt>
            <dd className="truncate">{lead.email}</dd>
            <dt className="text-fg-subtle">WhatsApp</dt>
            <dd className="num">{lead.whatsapp}</dd>
            <dt className="text-fg-subtle">Situação</dt>
            <dd>{lead.situacao ?? "—"}</dd>
            <dt className="text-fg-subtle">Score</dt>
            <dd className="num">{lead.score ?? "—"}</dd>
          </dl>
        </HoverCard>
        {lead.isNew && <Badge tone="accent">novo</Badge>}
      </span>
      <span className="flex min-w-0 gap-1 overflow-hidden">
        {lead.servicos.slice(0, 2).map((s) => (
          <Badge key={s} tone="outline" className="shrink-0">{s}</Badge>
        ))}
        {lead.servicos.length > 2 && <Badge tone="outline">+{lead.servicos.length - 2}</Badge>}
      </span>
      <span className="truncate text-fg-muted">{lead.dor}</span>
      <span className="truncate text-xs text-fg-muted">{lead.origem}</span>
      <span className="num text-xs text-fg-muted">{now ? formatRelative(lead.createdAt, now) : ""}</span>
      <SlaBadge deadline={lead.slaDeadline} respondedAt={lead.respondedAt} />
      {lead.responsavel ? <Avatar name={lead.responsavel} size={22} /> : <span className="size-[22px] rounded-full border border-dashed border-border-strong" title="Sem responsável" />}
    </div>
  );
}
