"use client";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { useId } from "react";

/** Mini tendência para cartões de KPI. Sem eixo, sem tooltip: o número grande é a informação. */
export function Sparkline({ data, color = "var(--c-series-1)" }: { data: number[]; color?: string }) {
  const id = useId().replace(/:/g, "");
  const points = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`sg-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#sg-${id})`} isAnimationActive={false} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
