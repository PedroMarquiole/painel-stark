import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const formatBRL = (v: number) => brl.format(v);

export const formatProtocolo = (n: number) => `#${String(n).padStart(4, "0")}`;

/** "+5511970002758" → "(11) 97000-2758". Números de fora do Brasil ficam como vieram. */
export function formatarTelefone(e164: string) {
  const d = e164.replace(/\D/g, "");
  const m = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(d);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

export function formatRelative(from: Date, now = new Date()) {
  const s = Math.round((now.getTime() - from.getTime()) / 1000);
  if (s < 60) return "agora";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h`;
  return `${Math.round(h / 24)} d`;
}
