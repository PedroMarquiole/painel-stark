"use client";
import { CheckCircle2, AlertTriangle, Clock, Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { useNow } from "@/hooks/use-now";
import { formatCountdown, slaStatus, type SlaStatus } from "@/lib/sla";

const meta: Record<SlaStatus, { tone: "success" | "warning" | "danger" | "neutral"; label: string; Icon: typeof Clock }> = {
  no_prazo: { tone: "success", label: "No prazo", Icon: Clock },
  vencendo: { tone: "warning", label: "Vencendo", Icon: AlertTriangle },
  estourado: { tone: "danger", label: "Estourado", Icon: Flame },
  respondido: { tone: "neutral", label: "Respondido", Icon: CheckCircle2 },
};

const fmt = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/** Cronômetro ao vivo do "1 dia útil". Ícone + texto: status nunca só pela cor. */
export function SlaBadge({ deadline, respondedAt, extenso = false }: { deadline: Date; respondedAt?: Date | null; extenso?: boolean }) {
  const now = useNow();
  if (!now) return <Badge tone="neutral" className="num w-[104px]">—</Badge>;
  const status = slaStatus(deadline, now, respondedAt);
  const { tone, label, Icon } = meta[status];
  const ms = deadline.getTime() - now.getTime();
  const curto = formatCountdown(ms);
  // Por extenso (ficha): "Prazo vence em 2h 24min" / "Prazo estourado há 1h 18min"
  const text = status === "respondido" ? label : !extenso ? curto
    : ms < 0 ? `Prazo estourado há ${curto.replace(/^-/, "")}` : `Prazo vence em ${curto}`;
  return (
    <Tooltip content={<span>{label} · prazo {fmt.format(deadline)}</span>}>
      <span>
        <Badge tone={tone} className={extenso ? "justify-start" : "num w-[104px] justify-start"} aria-label={`Prazo: ${label}, ${text}`}>
          <Icon aria-hidden />
          {text}
        </Badge>
      </span>
    </Tooltip>
  );
}
