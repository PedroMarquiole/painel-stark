"use client";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { ChartTooltip, axisProps } from "@/components/charts/chart-tooltip";
import { leadsPorSemana, leadsPorServico } from "@/lib/design/mock";

/** Linha = tendência · Barra = comparação. Clique abre a lista filtrada (aqui: toast). */
export function LeadsTrend() {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={leadsPorSemana} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}
          onClick={(e) => e?.activeLabel && toast(`Abrir leads da semana ${e.activeLabel}`)}>
          <CartesianGrid stroke="var(--c-grid)" vertical={false} />
          <XAxis dataKey="semana" {...axisProps} />
          <YAxis {...axisProps} allowDecimals={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--c-border-strong)" }} />
          <Line name="Site" dataKey="site" stroke="var(--c-series-1)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--c-raised)" }} />
          <Line name="Indicação" dataKey="indicacao" stroke="var(--c-series-2)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--c-raised)" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LeadsByService() {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={leadsPorServico} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }} barCategoryGap={6}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="servico" {...axisProps} width={104} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--c-overlay)" }} />
          <Bar name="Leads" dataKey="leads" fill="var(--c-series-1)" radius={[0, 4, 4, 0]} className="cursor-pointer"
            onClick={(d) => toast(`Abrir leads de ${(d as unknown as { servico: string }).servico}`)}
            label={{ position: "right", fill: "var(--c-fg-muted)", fontSize: 12, className: "num" }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const funil = [
  { etapa: "Leads", n: 132 },
  { etapa: "Triagem", n: 98 },
  { etapa: "Diagnóstico", n: 54 },
  { etapa: "Descoberta", n: 38 },
  { etapa: "Proposta", n: 26 },
  { etapa: "Ganho", n: 11 },
];

/** Funil como barras horizontais alinhadas: lê melhor que trapézios e mostra a conversão entre etapas. */
export function Funnel() {
  const max = funil[0].n;
  return (
    <ol className="flex flex-col gap-1.5">
      {funil.map((f, i) => (
        <li key={f.etapa} className="grid grid-cols-[88px_1fr_88px] items-center gap-3 text-sm">
          <span className="text-fg-muted">{f.etapa}</span>
          <span className="h-5 rounded-sm bg-overlay">
            <span className="block h-full rounded-sm bg-series-1" style={{ width: `${(f.n / max) * 100}%` }} />
          </span>
          <span className="num text-right text-xs">
            {f.n}
            {i > 0 && <span className="ml-1.5 text-fg-subtle">{Math.round((f.n / funil[i - 1].n) * 100)}%</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
