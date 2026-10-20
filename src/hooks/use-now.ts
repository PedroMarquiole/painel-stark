"use client";
import { useEffect, useState } from "react";

/** Relógio compartilhado: um único intervalo para todos os cronômetros da tela. */
const subs = new Set<(d: Date) => void>();
let timer: ReturnType<typeof setInterval> | null = null;

export function useNow(): Date | null {
  // null no SSR/primeiro render evita divergência de hidratação.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    subs.add(setNow);
    timer ??= setInterval(() => {
      const d = new Date();
      subs.forEach((f) => f(d));
    }, 1000);
    return () => {
      subs.delete(setNow);
      if (!subs.size && timer) {
        clearInterval(timer);
        timer = null;
      }
    };
  }, []);
  return now;
}

/** Relógio de baixa frequência (a cada 30s) para listas: contadores de SLA mudam sem recarregar. */
export function useRelogio(intervaloMs = 30_000): number {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), intervaloMs);
    return () => clearInterval(t);
  }, [intervaloMs]);
  return agora;
}
