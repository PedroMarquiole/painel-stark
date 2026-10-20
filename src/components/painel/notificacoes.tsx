"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as M from "@radix-ui/react-dropdown-menu";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabaseNavegador } from "@/lib/supabase/client";
import { cn, formatRelative } from "@/lib/utils";
import { marcarNotificacoesLidas } from "@/app/(painel)/acoes";
import type { Notificacao } from "@/lib/dados/tipos";
import { useNow } from "@/hooks/use-now";
import { usePainel } from "./contexto";

/** Sino com contador; notificação nova chega em tempo real e vira toast com "Abrir". */
export function Notificacoes({ iniciais }: { iniciais: Notificacao[] }) {
  const { perfil, offline } = usePainel();
  const router = useRouter();
  const [itens, setItens] = React.useState(iniciais);
  const naoLidas = itens.filter((n) => !n.lida_em).length;
  const agora = useNow();

  React.useEffect(() => {
    if (offline) return;
    const sb = supabaseNavegador();
    const canal = sb
      .channel(`notificacoes:${perfil.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notificacoes", filter: `profile_id=eq.${perfil.id}` }, (p) => {
        const n = p.new as Notificacao;
        setItens((xs) => [n, ...xs].slice(0, 30));
        toast(n.titulo, {
          description: n.corpo ?? undefined,
          action: n.link ? { label: "Abrir", onClick: () => router.push(n.link!) } : undefined,
          duration: 8000,
        });
        if (document.hidden && "Notification" in window && Notification.permission === "granted") {
          new Notification(n.titulo, { body: n.corpo ?? undefined, icon: "/logo-simbolo.svg" });
        }
      })
      .subscribe();
    return () => {
      sb.removeChannel(canal);
    };
  }, [offline, perfil.id, router]);

  return (
    <M.Root
      onOpenChange={(aberto) => {
        if (!aberto && naoLidas) {
          setItens((xs) => xs.map((n) => ({ ...n, lida_em: n.lida_em ?? new Date().toISOString() })));
          marcarNotificacoesLidas().catch(() => undefined);
        }
        if (aberto && "Notification" in window && Notification.permission === "default") Notification.requestPermission();
      }}
    >
      <M.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Notificações${naoLidas ? `: ${naoLidas} novas` : ""}`} className="relative">
          <Bell />
          {naoLidas > 0 && (
            <span className="num absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent-fill px-1 text-[10px] font-semibold leading-none text-accent-fg">
              {naoLidas}
            </span>
          )}
        </Button>
      </M.Trigger>
      <M.Portal>
        <M.Content align="end" sideOffset={6} className="z-50 w-80 overflow-hidden rounded-lg border border-border bg-raised shadow-pop data-[state=open]:animate-enter">
          <p className="border-b border-border px-3 py-2 text-xs font-medium text-fg-muted">Notificações</p>
          <div className="max-h-96 overflow-y-auto">
            {itens.length === 0 && <p className="px-3 py-6 text-center text-sm text-fg-muted">Tudo em dia.</p>}
            {itens.map((n) => (
              <M.Item key={n.id} asChild>
                <Link href={n.link ?? "#"} className="flex gap-2.5 border-b border-border px-3 py-2.5 outline-none last:border-0 data-[highlighted]:bg-overlay">
                  <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", n.lida_em ? "bg-transparent" : "bg-accent")} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{n.titulo}</span>
                    {n.corpo && <span className="block truncate text-xs text-fg-muted">{n.corpo}</span>}
                    <span className="num text-xs text-fg-subtle">{agora ? formatRelative(new Date(n.created_at), agora) : ""}</span>
                  </span>
                </Link>
              </M.Item>
            ))}
          </div>
        </M.Content>
      </M.Portal>
    </M.Root>
  );
}
