"use client";
import { CalendarClock, MessageCircle } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn, formatBRL, formatProtocolo } from "@/lib/utils";

export interface DealCardData {
  id: string;
  protocolo: number;
  titulo: string;
  empresa: string;
  valor: number;
  probabilidade: number;
  servico: string;
  diasNaEtapa: number;
  limiteParado: number;
  responsavel: string;
  proximo?: string;
}

/** Card do funil. Parado além do limite da etapa → borda e selo âmbar (com texto). */
export function KanbanCard({ deal, dragging }: { deal: DealCardData; dragging?: boolean }) {
  const parado = deal.diasNaEtapa > deal.limiteParado;
  return (
    <article
      tabIndex={0}
      className={cn(
        "group cursor-grab rounded-lg border border-border bg-raised p-3 transition-[border-color,box-shadow,transform] duration-150 ease-out hover:border-border-strong",
        parado && "border-warning/40",
        dragging && "rotate-[1.5deg] cursor-grabbing shadow-pop",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="num text-xs text-fg-subtle">{formatProtocolo(deal.protocolo)}</span>
        {parado && (
          <Badge tone="warning">
            <CalendarClock aria-hidden />
            parado {deal.diasNaEtapa}d
          </Badge>
        )}
      </div>
      <h4 className="mt-1.5 line-clamp-2 text-sm font-medium">{deal.titulo}</h4>
      <p className="truncate text-xs text-fg-muted">{deal.empresa}</p>
      <div className="mt-3 flex items-center gap-2">
        <span className="num text-sm">{formatBRL(deal.valor)}</span>
        <span className="num text-xs text-fg-subtle">· {deal.probabilidade}%</span>
        <span className="flex-1" />
        <Avatar name={deal.responsavel} size={20} />
      </div>
      {deal.proximo && (
        <p className="mt-2 flex items-center gap-1.5 border-t border-border pt-2 text-xs text-fg-muted">
          <MessageCircle className="size-3.5" aria-hidden />
          {deal.proximo}
        </p>
      )}
    </article>
  );
}
