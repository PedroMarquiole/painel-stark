"use client";
import * as React from "react";
import type { Perfil } from "@/lib/dados/tipos";

interface Ctx {
  perfil: Perfil;
  equipe: Perfil[];
  nomeDe: (id: string | null | undefined) => string | null;
  abrirBusca: () => void;
  abrirNovoLead: () => void;
  abrirAtalhos: () => void;
  offline: boolean;
}

export const PainelCtx = React.createContext<Ctx | null>(null);
export function usePainel() {
  const c = React.useContext(PainelCtx);
  if (!c) throw new Error("usePainel fora do PainelCtx");
  return c;
}

/** Atalho de tecla simples, ignorado enquanto a pessoa digita. */
export function useTecla(tecla: string, fn: (e: KeyboardEvent) => void, ativo = true) {
  const ref = React.useRef(fn);
  ref.current = fn;
  React.useEffect(() => {
    if (!ativo) return;
    const h = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      if (alvo.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() === tecla.toLowerCase()) {
        e.preventDefault();
        ref.current(e);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [tecla, ativo]);
}
