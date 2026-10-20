"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as M from "@radix-ui/react-dropdown-menu";
import { Bot, Columns3, Home, Inbox, LayoutTemplate, LogOut, Menu, Plus, Search } from "lucide-react";
import { AppearanceControls } from "@/components/layout/appearance-controls";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import { PAPEIS } from "@/lib/rotulos";
import type { Notificacao, Perfil } from "@/lib/dados/tipos";
import { sair } from "@/app/(auth)/acoes";
import { Atalhos } from "./atalhos";
import { Busca } from "./busca";
import { PainelCtx } from "./contexto";
import { Notificacoes } from "./notificacoes";
import { NovoLead } from "./novo-lead";

const NAV = [
  { href: "/", rotulo: "Início", Icone: Home, tecla: "H" },
  { href: "/leads", rotulo: "Caixa de entrada", Icone: Inbox, tecla: "I" },
  { href: "/funil", rotulo: "Funil", Icone: Columns3, tecla: "F" },
  { href: "/automacoes", rotulo: "Automações", Icone: Bot, tecla: "A" },
];

export function Shell({
  perfil, equipe, notificacoes, abertos, offline, children,
}: {
  perfil: Perfil; equipe: Perfil[]; notificacoes: Notificacao[]; abertos: number; offline: boolean; children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [busca, setBusca] = React.useState(false);
  const [novo, setNovo] = React.useState(false);
  const [atalhos, setAtalhos] = React.useState(false);
  const [menuMobile, setMenuMobile] = React.useState(false);

  const nomes = React.useMemo(() => new Map(equipe.map((p) => [p.id, p.nome])), [equipe]);
  const ctx = React.useMemo(
    () => ({
      perfil, equipe, offline,
      nomeDe: (id: string | null | undefined) => (id ? (nomes.get(id) ?? null) : null),
      abrirBusca: () => setBusca(true), abrirNovoLead: () => setNovo(true), abrirAtalhos: () => setAtalhos(true),
    }),
    [perfil, equipe, offline, nomes],
  );

  // ⌘K, N, ?, G + letra
  React.useEffect(() => {
    let g = 0;
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setBusca((v) => !v);
        return;
      }
      const alvo = e.target as HTMLElement;
      if (alvo.closest("input, textarea, select, [contenteditable=true], [role=dialog], [role=menu]")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (Date.now() - g < 900) {
        const destino = NAV.find((n) => n.tecla.toLowerCase() === k);
        g = 0;
        if (destino) {
          e.preventDefault();
          router.push(destino.href);
        }
        return;
      }
      if (k === "g") g = Date.now();
      else if (k === "n") { e.preventDefault(); setNovo(true); }
      else if (e.key === "?") { e.preventDefault(); setAtalhos(true); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [router]);

  const ativo = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const navegacao = (
    <nav aria-label="Principal" className="flex flex-col gap-0.5">
      {NAV.map(({ href, rotulo, Icone, tecla }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setMenuMobile(false)}
          aria-current={ativo(href) ? "page" : undefined}
          className={cn(
            "group flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm text-fg-muted transition-colors hover:bg-overlay hover:text-fg [&_svg]:size-4",
            ativo(href) && "bg-overlay text-fg",
          )}
        >
          <Icone aria-hidden />
          <span className="flex-1">{rotulo}</span>
          {href === "/leads" && abertos > 0 && <span className="num rounded-sm bg-accent-soft px-1.5 text-xs text-accent">{abertos}</span>}
          <span className="hidden gap-0.5 lg:group-hover:flex"><Kbd>G</Kbd><Kbd>{tecla}</Kbd></span>
        </Link>
      ))}
    </nav>
  );

  return (
    <PainelCtx.Provider value={ctx}>
      <div className="flex min-h-dvh">
        {/* Barra lateral (desktop) */}
        <aside className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-border bg-surface px-3 py-3 transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0",
          menuMobile ? "translate-x-0 shadow-pop" : "-translate-x-full",
        )}>
          <Link href="/" className="mb-4 flex items-center gap-2.5 px-2 py-1">
            <img src="/logo-simbolo.svg" alt="" className="size-6" />
            <span className="font-[family-name:var(--font-display)] text-sm font-semibold">Painel Stark</span>
            {offline && <span className="ml-auto rounded-sm bg-warning/15 px-1.5 text-[11px] font-medium text-warning">offline</span>}
          </Link>
          <button
            onClick={() => setBusca(true)}
            className="mb-3 flex h-8 items-center gap-2 rounded-md border border-border bg-canvas/50 px-2.5 text-sm text-fg-subtle transition-colors hover:border-border-strong"
          >
            <Search className="size-4" aria-hidden /> <span className="flex-1 text-left">Buscar…</span> <Kbd>⌘K</Kbd>
          </button>
          {navegacao}
          <div className="mt-auto flex flex-col gap-0.5">
            <Link href="/design" className="flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm text-fg-subtle hover:bg-overlay hover:text-fg [&_svg]:size-4">
              <LayoutTemplate aria-hidden /> Design system
            </Link>
            <M.Root>
              <M.Trigger className="flex items-center gap-2.5 rounded-md px-2 py-2 text-left outline-none hover:bg-overlay focus-visible:bg-overlay">
                <Avatar name={perfil.nome} size={26} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{perfil.nome}</span>
                  <span className="block text-xs text-fg-subtle">{PAPEIS[perfil.papel]}</span>
                </span>
              </M.Trigger>
              <M.Portal>
                <M.Content side="top" align="start" sideOffset={6} className="z-50 w-72 rounded-lg border border-border bg-raised p-3 shadow-pop data-[state=open]:animate-enter">
                  <p className="text-sm">{perfil.nome}</p>
                  <p className="mb-3 truncate text-xs text-fg-muted">{perfil.email}</p>
                  <AppearanceControls />
                  <M.Separator className="my-3 h-px bg-border" />
                  <M.Item onSelect={() => setAtalhos(true)} className="flex h-8 cursor-default items-center justify-between rounded-md px-2 text-sm text-fg-muted outline-none data-[highlighted]:bg-overlay data-[highlighted]:text-fg">
                    Atalhos de teclado <Kbd>?</Kbd>
                  </M.Item>
                  <form action={sair}>
                    <button className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm text-fg-muted hover:bg-overlay hover:text-fg [&_svg]:size-4">
                      <LogOut aria-hidden /> Sair
                    </button>
                  </form>
                </M.Content>
              </M.Portal>
            </M.Root>
          </div>
        </aside>
        {menuMobile && <div className="fixed inset-0 z-30 bg-canvas/50 lg:hidden" onClick={() => setMenuMobile(false)} />}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b border-border bg-canvas/85 px-3 backdrop-blur sm:px-5">
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Menu" onClick={() => setMenuMobile(true)}><Menu /></Button>
            <span className="flex-1" />
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Buscar" onClick={() => setBusca(true)}><Search /></Button>
            <Notificacoes iniciais={notificacoes} />
            <Button variant="primary" size="sm" onClick={() => setNovo(true)}>
              <Plus /> <span className="hidden sm:inline">Novo lead</span> <Kbd className="ml-0.5 hidden border-accent-fg/20 bg-transparent text-accent-fg/80 sm:inline-flex">N</Kbd>
            </Button>
          </header>
          <main className="flex-1 pb-16 lg:pb-0">{children}</main>
        </div>

        {/* Navegação de baixo (celular) */}
        <nav aria-label="Atalhos" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-border bg-surface/95 backdrop-blur lg:hidden">
          {NAV.map(({ href, rotulo, Icone }) => (
            <Link key={href} href={href} className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] text-fg-muted [&_svg]:size-5", ativo(href) && "text-accent")}>
              <Icone aria-hidden />
              {rotulo.split(" ")[0]}
            </Link>
          ))}
        </nav>
      </div>

      <Busca aberto={busca} setAberto={setBusca} novoLead={() => setNovo(true)} />
      <NovoLead aberto={novo} setAberto={setNovo} />
      <Atalhos aberto={atalhos} setAberto={setAtalhos} />
    </PainelCtx.Provider>
  );
}
