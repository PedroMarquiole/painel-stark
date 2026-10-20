import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Sparkline } from "@/components/charts/sparkline";
import { cn } from "@/lib/utils";

/**
 * Valor grande + variação vs. período anterior + mini tendência.
 * `goodWhen` diz se subir é bom (receita) ou ruim (tempo de resposta).
 * Clicável: leva à lista que compõe o número.
 */
export function KpiCard({
  label,
  value,
  delta,
  goodWhen = "up",
  trend,
  hint,
  href,
  color,
}: {
  label: string;
  value: string;
  delta?: number; // fração: 0.12 = +12%
  goodWhen?: "up" | "down";
  trend?: number[];
  hint?: string;
  href?: string;
  color?: string;
}) {
  const dir = delta == null || Math.abs(delta) < 0.005 ? 0 : delta > 0 ? 1 : -1;
  const good = dir === 0 ? null : (dir > 0) === (goodWhen === "up");
  const Icon = dir > 0 ? ArrowUpRight : dir < 0 ? ArrowDownRight : Minus;
  const Comp = href ? "a" : "div";
  return (
    <Comp
      href={href}
      className={cn(
        "group flex flex-col gap-2 rounded-lg border border-border bg-raised p-card transition-colors duration-150",
        href && "hover:border-border-strong hover:bg-overlay/40",
      )}
    >
      <span className="text-sm text-fg-muted">{label}</span>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="num whitespace-nowrap text-xl font-medium">{value}</div>
          {delta != null && (
            <div
              className={cn(
                "num mt-1 inline-flex items-center gap-0.5 text-xs",
                good === null ? "text-fg-muted" : good ? "text-success" : "text-danger",
              )}
            >
              <Icon className="size-3.5" aria-hidden />
              {Math.abs(delta * 100).toFixed(0)}%
              <span className="ml-1 font-sans text-fg-subtle">{hint ?? "vs. anterior"}</span>
            </div>
          )}
        </div>
        {trend && (
          <div className="h-10 w-20 shrink-0" aria-hidden>
            <Sparkline data={trend} color={color} />
          </div>
        )}
      </div>
    </Comp>
  );
}
