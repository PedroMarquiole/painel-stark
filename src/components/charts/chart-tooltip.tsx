"use client";
type Fmt = (v: number) => string;

interface Props {
  active?: boolean;
  payload?: { dataKey?: string | number; name?: string | number; value?: number | string; color?: string }[];
  label?: string | number;
  format?: Fmt;
}

/** Tooltip único para todos os gráficos: superfície do tema, valor em mono, cor só no marcador. */
export function ChartTooltip({ active, payload, label, format = (v) => String(v) }: Props) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-36 rounded-md bg-overlay px-2.5 py-2 text-xs shadow-pop">
      <p className="mb-1 text-fg-muted">{label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="flex-1 text-fg-muted">{p.name}</span>
          <span className="num text-fg">{format(Number(p.value))}</span>
        </p>
      ))}
    </div>
  );
}

export const axisProps = {
  stroke: "var(--c-fg-subtle)",
  tick: { fill: "var(--c-fg-muted)", fontSize: 12 },
  tickLine: false,
  axisLine: false,
} as const;
