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
