"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as M from "@radix-ui/react-dropdown-menu";
import { BarChart3, Bot, Columns3, Crosshair, Home, Inbox, LayoutTemplate, LogOut, Menu, MoreHorizontal, Plus, Search } from "lucide-react";
import { AppearanceControls } from "@/components/layout/appearance-controls";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PAPEIS } from "@/lib/rotulos";
import type { Notificacao, Perfil } from "@/lib/dados/tipos";
import { sair } from "@/app/(auth)/acoes";
import { Atalhos } from "./atalhos";
import { Busca } from "./busca";
import { PainelCtx } from "./contexto";
import { Notificacoes } from "./notificacoes";
import { NovoLead } from "./novo-lead";

/** Barra de baixo do celular: 4 telas do dia a dia + "Mais" (abre a gaveta). */
const NAV_CELULAR = ["/", "/leads", "/funil", "/prospeccao"];
const NAV = [
  { href: "/", rotulo: "Início", Icone: Home, tecla: "H" },
  { href: "/leads", rotulo: "Caixa de entrada", Icone: Inbox, tecla: "I" },
  { href: "/funil", rotulo: "Funil", Icone: Columns3, tecla: "F" },
  { href: "/prospeccao", rotulo: "Prospecção", Icone: Crosshair, tecla: "P" },
  { href: "/relatorios", rotulo: "Relatórios", Icone: BarChart3, tecla: "R" },
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
  const formSair = React.useRef<HTMLFormElement>(null);
  // Gaveta do celular: Esc fecha
  React.useEffect(() => {
    if (!menuMobile) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && setMenuMobile(false);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [menuMobile]);

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

  // Menu com texto: gaveta do celular
  const navegacao = (
    <nav aria-label="Principal" className="flex flex-col gap-0.5">
      {NAV.map(({ href, rotulo, Icone }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setMenuMobile(false)}
          aria-current={ativo(href) ? "page" : undefined}
          className={cn(
            "flex h-10 items-center gap-3 rounded-full px-3.5 text-sm text-fg-muted transition-colors hover:bg-overlay hover:text-fg [&_svg]:size-4",
            ativo(href) && "bg-invert text-invert-fg hover:bg-invert hover:text-invert-fg",
          )}
        >
          <Icone aria-hidden />
          <span className="flex-1">{rotulo}</span>
          {href === "/leads" && abertos > 0 && <span className="num text-xs">{abertos}</span>}
        </Link>
      ))}
    </nav>
  );

  const menuConta = (
    <M.Root>
      <M.Trigger aria-label={`Conta: ${perfil.nome}`} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <Avatar name={perfil.nome} size={36} />
      </M.Trigger>
      <M.Portal>
        <M.Content side="right" align="end" sideOffset={10} className="z-50 w-72 rounded-xl border border-border bg-raised p-3 shadow-pop data-[state=open]:animate-enter">
          <p className="text-sm">{perfil.nome}</p>
          <p className="truncate text-xs text-fg-muted">{perfil.email}</p>
          <p className="text-xs text-fg-subtle">{PAPEIS[perfil.papel]}</p>
          <div className="mt-3"><AppearanceControls /></div>
          <M.Separator className="my-3 h-px bg-border" />
          <M.Item onSelect={() => setAtalhos(true)} className="flex h-8 cursor-default items-center justify-between rounded-md px-2 text-sm text-fg-muted outline-none data-[highlighted]:bg-overlay data-[highlighted]:text-fg">
            Atalhos de teclado <Kbd>?</Kbd>
          </M.Item>
          {perfil.papel === "admin" && (
            <M.Item asChild className="flex h-8 cursor-default items-center gap-2 rounded-md px-2 text-sm text-fg-muted outline-none data-[highlighted]:bg-overlay data-[highlighted]:text-fg [&_svg]:size-4">
              <Link href="/design"><LayoutTemplate aria-hidden /> Design system</Link>
            </M.Item>
          )}
          <form ref={formSair} action={sair} />
          <M.Item onSelect={() => formSair.current?.requestSubmit()} className="flex h-8 cursor-default items-center gap-2 rounded-md px-2 text-sm text-fg-muted outline-none data-[highlighted]:bg-overlay data-[highlighted]:text-fg [&_svg]:size-4">
            <LogOut aria-hidden /> Sair
          </M.Item>
        </M.Content>
      </M.Portal>
    </M.Root>
  );

  return (
    <PainelCtx.Provider value={ctx}>
      <div className="flex min-h-dvh">
        {/* Trilho de ícones (desktop) */}
        <aside className="sticky top-0 hidden h-dvh w-[76px] shrink-0 flex-col items-center gap-6 py-5 lg:flex">
          <Link href="/" aria-label="Painel Stark — início" className="grid size-10 place-items-center">
            <img src="/logo-simbolo.svg" alt="" className="size-7" />
          </Link>
          <nav aria-label="Principal" className="flex flex-col items-center gap-2 rounded-full bg-bloco p-1.5 shadow-bloco">
            {NAV.map(({ href, rotulo, Icone, tecla }) => (
              <Tooltip key={href} side="right" content={<>{rotulo} <span className="flex gap-0.5"><Kbd>G</Kbd><Kbd>{tecla}</Kbd></span></>}>
                <Link
                  href={href}
                  aria-label={rotulo}
                  aria-current={ativo(href) ? "page" : undefined}
                  className={cn(
                    "relative grid size-10 place-items-center rounded-full text-fg-muted transition-colors hover:bg-overlay hover:text-fg [&_svg]:size-[18px]",
                    ativo(href) && "bg-invert text-invert-fg hover:bg-invert hover:text-invert-fg",
                  )}
                >
                  <Icone aria-hidden />
                  {href === "/leads" && abertos > 0 && (
                    <span className="num absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent-fill px-1 text-[10px] font-semibold leading-none text-accent-fg">
                      {abertos}
                    </span>
                  )}
                </Link>
              </Tooltip>
            ))}
          </nav>
          <div className="mt-auto flex flex-col items-center gap-3">
            {offline && <span className="rounded-full bg-warning/15 px-1.5 text-[10px] font-medium text-warning">offline</span>}
            {menuConta}
          </div>
        </aside>

        {/* Gaveta (celular) */}
        <aside
          aria-label="Menu"
          // Fechada: fora do foco do teclado e dos leitores de tela
          inert={!menuMobile}
          className={cn(
            "fixed inset-y-0 left-0 z-40 flex w-64 flex-col gap-4 bg-surface p-4 transition-transform duration-200 ease-out lg:hidden",
            menuMobile ? "translate-x-0 shadow-pop" : "-translate-x-full",
          )}>
          <Link href="/" onClick={() => setMenuMobile(false)} className="flex items-center gap-2.5 px-1">
            <img src="/logo-simbolo.svg" alt="" className="size-6" />
            <span className="font-[family-name:var(--font-display)] text-sm font-semibold">Painel Stark</span>
            {offline && <span className="ml-auto rounded-sm bg-warning/15 px-1.5 text-[11px] font-medium text-warning">offline</span>}
          </Link>
          {navegacao}
          <div className="mt-auto flex items-center gap-3">
            {menuConta}
            <span className="min-w-0">
              <span className="block truncate text-sm">{perfil.nome}</span>
              <span className="block text-xs text-fg-subtle">{PAPEIS[perfil.papel]}</span>
            </span>
          </div>
        </aside>
        {menuMobile && <div aria-hidden className="fixed inset-0 z-30 bg-canvas/50 lg:hidden" onClick={() => setMenuMobile(false)} />}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-16 items-center gap-2 bg-canvas/85 px-3 backdrop-blur sm:px-5 lg:pl-1">
            <Button variant="ghost" size="icon" className="rounded-full lg:hidden" aria-label="Menu" onClick={() => setMenuMobile(true)}><Menu /></Button>
            <span className="flex-1" />
            <button
              onClick={() => setBusca(true)}
              aria-label="Buscar"
              className="flex h-10 items-center gap-2 rounded-full bg-bloco pl-4 pr-1.5 text-sm text-fg-subtle shadow-bloco transition-colors hover:text-fg-muted max-sm:w-10 max-sm:justify-center max-sm:px-0 sm:w-80"
            >
              <span className="flex-1 text-left max-sm:hidden">Buscar lead, cliente ou #protocolo</span>
              <Kbd className="max-sm:hidden">⌘K</Kbd>
              <span className="grid size-7 place-items-center rounded-full bg-invert text-invert-fg max-sm:bg-transparent max-sm:text-fg-muted"><Search className="size-3.5" aria-hidden /></span>
            </button>
            <div className="grid size-10 place-items-center rounded-full bg-bloco shadow-bloco [&_button]:rounded-full">
              <Notificacoes iniciais={notificacoes} />
            </div>
            <Button variant="primary" onClick={() => setNovo(true)} className="h-10 rounded-full px-4 max-sm:w-10 max-sm:px-0" aria-label="Novo lead">
              <Plus /> <span className="hidden sm:inline">Novo lead</span> <Kbd className="ml-0.5 hidden border-accent-fg/20 bg-transparent text-accent-fg/80 sm:inline-flex">N</Kbd>
            </Button>
          </header>
          <main className="flex-1 pb-16 lg:pb-0">{children}</main>
        </div>

        {/* Navegação de baixo (celular) */}
        <nav aria-label="Atalhos" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-surface/95 backdrop-blur lg:hidden">
          {NAV.filter((n) => NAV_CELULAR.includes(n.href)).map(({ href, rotulo, Icone }) => (
            <Link key={href} href={href} aria-current={ativo(href) ? "page" : undefined}
              className={cn("relative flex flex-col items-center gap-0.5 py-2 text-[11px] text-fg-muted [&_svg]:size-5", ativo(href) && "text-accent")}>
              <Icone aria-hidden />
              {href === "/leads" ? "Caixa" : rotulo.split(" ")[0]}
              {href === "/leads" && abertos > 0 && (
                <span className="num absolute left-1/2 top-1 ml-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent-fill px-1 text-[10px] font-semibold leading-none text-accent-fg">
                  {abertos}<span className="sr-only"> sem resposta</span>
                </span>
              )}
            </Link>
          ))}
          <button type="button" onClick={() => setMenuMobile(true)} aria-label="Mais telas"
            className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] text-fg-muted [&_svg]:size-5", NAV.some((n) => !NAV_CELULAR.includes(n.href) && ativo(n.href)) && "text-accent")}>
            <MoreHorizontal aria-hidden />
            Mais
          </button>
        </nav>
      </div>

      <Busca aberto={busca} setAberto={setBusca} novoLead={() => setNovo(true)} />
      <NovoLead aberto={novo} setAberto={setNovo} />
      <Atalhos aberto={atalhos} setAberto={setAtalhos} />
    </PainelCtx.Provider>
  );
}
