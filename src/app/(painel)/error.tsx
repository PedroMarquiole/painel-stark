"use client";
import { useEffect } from "react";
import { RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/** Falha ao carregar uma tela do painel: explica e deixa tentar de novo (sem derrubar o resto). */
export default function ErroPainel({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error("tela", error), [error]);
  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <EmptyState
        icon={<WifiOff />}
        title="Não foi possível carregar esta tela"
        description="Pode ser a conexão ou o banco de dados demorando. Seus dados estão seguros."
        action={<Button size="sm" onClick={reset}><RefreshCw /> Tentar de novo</Button>}
      />
    </div>
  );
}
