"use client";
// Peças da grade em blocos (Início e Relatórios): bloco, título, variação, período, indicador.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import { cn, formatBRL } from "@/lib/utils";

type Par = { atual: number | null; anterior: number | null };
export const variacao = (p: Par) => (p.atual == null || !p.anterior ? undefined : (p.atual - p.anterior) / p.anterior);

export const horas = (h: number | null) => {
  if (h == null) return "—";
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return hh >= 48 ? `${Math.round(hh / 24)} dias` : hh ? `${hh}h ${String(mm).padStart(2, "0")}min` : `${mm}min`;
};
export const mil = (v: number | null) => (v == null ? "—" : v >= 10000 ? `R$ ${Math.round(v / 1000)} mil` : formatBRL(v));
export const saudacao = () => {
  const h = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date()));
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
};
export const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Bloco da grade: flutua sobre o fundo (sombra, sem borda). */
export function Bloco({ className, href, children }: { className?: string; href?: string; children: React.ReactNode }) {
  const cls = cn("flex flex-col rounded-2xl bg-bloco p-5 shadow-bloco", href && "transition-transform duration-150 hover:-translate-y-px", className);
  return href ? <Link href={href} className={cls}>{children}</Link> : <section className={cls}>{children}</section>;
}

export function Titulo({ children, extra }: { children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-2">
      <h2 className="text-md font-medium">{children}</h2>
      {extra && <span className="text-xs text-fg-subtle">{extra}</span>}
    </div>
  );
}

/** Variação vs. período anterior. `bomQuando` diz se subir é bom (receita) ou ruim (tempo de resposta). */
export function Variacao({ delta, bomQuando = "sobe" }: { delta?: number; bomQuando?: "sobe" | "desce" }) {
  if (delta == null) return <span className="text-xs text-fg-subtle">sem base de comparação</span>;
  const dir = Math.abs(delta) < 0.005 ? 0 : delta > 0 ? 1 : -1;
  const bom = dir === 0 ? null : (dir > 0) === (bomQuando === "sobe");
  const Icone = dir > 0 ? ArrowUpRight : dir < 0 ? ArrowDownRight : Minus;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-fg-subtle">
      <span className={cn("num inline-flex items-center gap-0.5 rounded-full px-1.5 py-px",
        bom === null ? "bg-overlay text-fg-muted" : bom ? "bg-success/12 text-success" : "bg-danger/12 text-danger")}>
        <Icone className="size-3" aria-hidden />{Math.abs(delta * 100).toFixed(0)}%
      </span>
      vs. anterior
    </span>
  );
}

/** Mini barras por semana; a semana atual em destaque. */
export function MiniBarras({ valores }: { valores: (number | null)[] }) {
  const max = Math.max(1, ...valores.map((v) => v ?? 0));
  return (
    <svg viewBox={`0 0 ${valores.length * 8} 40`} className="h-10 w-[72px]" aria-hidden preserveAspectRatio="none">
      {valores.map((v, i) => {
        const h = Math.max(3, ((v ?? 0) / max) * 40);
        return <rect key={i} x={i * 8 + 1.5} y={40 - h} width={5} height={h} rx={2.5}
          fill={i === valores.length - 1 ? "var(--c-accent-fill)" : "var(--c-fg-subtle)"} opacity={i === valores.length - 1 ? 1 : 0.45} />;
      })}
    </svg>
  );
}

export function Indicador({ Icone, rotulo, valor, delta, bomQuando, href, grafico }: {
  Icone: LucideIcon; rotulo: string; valor: string; delta?: number; bomQuando?: "sobe" | "desce"; href: string; grafico?: React.ReactNode;
}) {
  return (
    <Bloco href={href} className="gap-4">
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 place-items-center rounded-full bg-bloco-inset text-fg-muted [&_svg]:size-4"><Icone aria-hidden /></span>
        <span className="text-sm text-fg-muted">{rotulo}</span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="num whitespace-nowrap text-xl font-medium">{valor}</div>
          <div className="mt-1.5"><Variacao delta={delta} bomQuando={bomQuando} /></div>
        </div>
        {grafico && <div className="h-10 w-[72px] shrink-0" aria-hidden>{grafico}</div>}
      </div>
    </Bloco>
  );
}

export function Periodo({ dias, base = "/" }: { dias: number; base?: string }) {
  const router = useRouter();
  return (
    <div role="group" aria-label="Período" className="inline-flex h-10 items-center gap-0.5 rounded-full bg-bloco p-1 shadow-bloco">
      {[7, 30, 90].map((d) => (
        <button key={d} aria-pressed={dias === d} onClick={() => router.push(`${base}?dias=${d}`)}
          className={cn("h-full rounded-full px-3.5 text-xs font-medium transition-colors",
            dias === d ? "bg-invert text-invert-fg" : "text-fg-muted hover:text-fg")}>
          {d} dias
        </button>
      ))}
    </div>
  );
}

