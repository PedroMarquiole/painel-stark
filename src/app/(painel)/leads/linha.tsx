"use client";
import * as React from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { HoverCard } from "@/components/ui/hover-card";
import { SlaBadge } from "@/components/domain/sla-badge";
import { useNow } from "@/hooks/use-now";
import { cn, formatProtocolo, formatRelative } from "@/lib/utils";
import { SERVICOS, SITUACOES, rotuloOrigem } from "@/lib/rotulos";
import type { LeadInbox } from "@/lib/dados/tipos";

export const GRADE =
  "md:grid md:grid-cols-[60px_minmax(150px,1.2fr)_minmax(130px,1fr)_minmax(180px,2.2fr)_92px_52px_112px_24px] md:items-center md:gap-3";

/** Linha da caixa de entrada: tabela no desktop, cartão no celular. */
export const LinhaLead = React.memo(function LinhaLead({
  lead, selecionado, novo, responsavel, onAbrir,
}: {
  lead: LeadInbox; selecionado: boolean; novo: boolean; responsavel: string | null; onAbrir: () => void;
}) {
  const now = useNow();
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (selecionado) ref.current?.scrollIntoView({ block: "nearest" });
  }, [selecionado]);

  return (
    <div
      ref={ref}
      role="row"
      tabIndex={-1}
      aria-selected={selecionado}
      data-id={lead.id}
      onClick={onAbrir}
      style={{ minHeight: "var(--row-h)" }}
      className={cn(
        GRADE,
        "relative flex cursor-default flex-col gap-1.5 border-b border-border px-4 py-3 text-sm transition-colors duration-100 hover:bg-overlay/50 md:py-0",
        selecionado && "bg-overlay/70 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-accent",
        novo && "animate-[enter_200ms_ease-out,highlight_2.4s_ease-out]",
        lead.status === "descartado" && "opacity-60",
      )}
    >
      <span className="num hidden text-xs text-fg-muted md:block">{formatProtocolo(lead.protocolo)}</span>
      <span className="flex min-w-0 items-center gap-2">
        <HoverCard trigger={<span className="truncate font-medium hover:underline hover:decoration-fg-subtle hover:underline-offset-4">{lead.nome}</span>}>
          <p className="text-sm font-medium">{lead.nome}</p>
          <p className="text-xs text-fg-muted">{lead.empresa ?? "Sem empresa"}</p>
          <dl className="mt-3 grid grid-cols-[76px_1fr] gap-y-1 text-xs">
            <dt className="text-fg-subtle">E-mail</dt><dd className="truncate">{lead.email ?? "—"}</dd>
            <dt className="text-fg-subtle">WhatsApp</dt><dd className="num">{lead.whatsapp ?? "—"}</dd>
            <dt className="text-fg-subtle">Hoje</dt><dd>{lead.situacao_atual ? SITUACOES[lead.situacao_atual] : "—"}</dd>
            <dt className="text-fg-subtle">Origem</dt><dd>{rotuloOrigem(lead.origem)}</dd>
          </dl>
        </HoverCard>
        {novo && <Badge tone="accent">novo</Badge>}
        <span className="num ml-auto text-xs text-fg-subtle md:hidden">{formatProtocolo(lead.protocolo)}</span>
      </span>
      <span className="flex min-w-0 flex-wrap gap-1 md:flex-nowrap md:overflow-hidden">
        {lead.servicos.slice(0, 2).map((s) => <Badge key={s} tone="outline" className="shrink-0">{SERVICOS[s]}</Badge>)}
        {lead.servicos.length > 2 && <Badge tone="outline">+{lead.servicos.length - 2}</Badge>}
      </span>
      <span className="line-clamp-2 text-fg-muted md:truncate">{lead.dor}</span>
      <span className="hidden truncate text-xs text-fg-muted md:block">{rotuloOrigem(lead.origem)}</span>
      <span className="num hidden text-xs text-fg-muted md:block">{now ? formatRelative(new Date(lead.created_at), now) : ""}</span>
      <span className="flex items-center gap-2 md:contents">
        <SlaBadge deadline={new Date(lead.sla_vence_em)} respondedAt={lead.primeira_resposta_em ? new Date(lead.primeira_resposta_em) : null} />
        <span className="num text-xs text-fg-subtle md:hidden">{rotuloOrigem(lead.origem)} · {now ? formatRelative(new Date(lead.created_at), now) : ""}</span>
        <span className="ml-auto md:ml-0">
          {responsavel ? <Avatar name={responsavel} size={22} /> : <span title="Sem responsável" className="block size-[22px] rounded-full border border-dashed border-border-strong" />}
        </span>
      </span>
    </div>
  );
});
