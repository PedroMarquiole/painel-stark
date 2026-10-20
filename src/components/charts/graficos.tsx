"use client";
import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip, axisProps } from "./chart-tooltip";

/** Linha = tendência. Uma série: o título do card nomeia (sem legenda). */
export function LinhaSemanal({ dados, chave, nome, formato = (v: number) => String(v), cor = "var(--c-series-1)" }: {
  dados: Record<string, unknown>[]; chave: string; nome: string; formato?: (v: number) => string; cor?: string;
}) {
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="var(--c-grid)" vertical={false} />
          <XAxis dataKey="semana" {...axisProps} />
          <YAxis {...axisProps} allowDecimals={false} />
          <Tooltip content={<ChartTooltip format={formato} />} cursor={{ stroke: "var(--c-border-strong)" }} />
          <Line name={nome} dataKey={chave} stroke={cor} strokeWidth={2} dot={false} connectNulls
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--c-raised)" }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Barra = comparação. Clique numa barra abre a lista filtrada. */
export function BarrasHorizontais({ dados, nome, href, cor = "var(--c-series-1)", altura }: {
  dados: { rotulo: string; n: number; chave: string }[]; nome: string; href?: (chave: string) => string; cor?: string; altura?: number;
}) {
  const router = useRouter();
  if (!dados.length) return <p className="py-10 text-center text-sm text-fg-muted">Sem dados no período.</p>;
  return (
    <div style={{ height: altura ?? Math.max(120, dados.length * 30 + 12) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} layout="vertical" margin={{ top: 0, right: 28, bottom: 0, left: 4 }} barCategoryGap={6}>
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis type="category" dataKey="rotulo" {...axisProps} width={128} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--c-overlay)" }} />
          <Bar name={nome} dataKey="n" fill={cor} radius={[0, 4, 4, 0]} isAnimationActive={false}
            className={href ? "cursor-pointer" : undefined}
            onClick={(d) => href && router.push(href((d as unknown as { chave: string }).chave))}
            label={{ position: "right", fill: "var(--c-fg-muted)", fontSize: 12 }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Funil como barras alinhadas, com a conversão entre etapas. */
export function Funil({ etapas }: { etapas: { rotulo: string; n: number }[] }) {
  const max = Math.max(1, ...etapas.map((e) => e.n));
  return (
    <ol className="flex flex-col gap-1.5">
      {etapas.map((f, i) => (
        <li key={f.rotulo} className="grid grid-cols-[minmax(92px,140px)_1fr_76px] items-center gap-3 text-sm">
          <span className="truncate text-fg-muted">{f.rotulo}</span>
          <span className="h-5 rounded-sm bg-overlay">
            <span className="block h-full rounded-sm bg-series-1 transition-[width] duration-300" style={{ width: `${(f.n / max) * 100}%` }} />
          </span>
          <span className="num text-right text-xs">
            {f.n}
            {i > 0 && etapas[i - 1].n > 0 && <span className="ml-1.5 text-fg-subtle">{Math.round((f.n / etapas[i - 1].n) * 100)}%</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
