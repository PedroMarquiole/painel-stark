"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import * as D from "@radix-ui/react-dialog";
import { useTheme } from "next-themes";
import { BarChart3, Bot, Columns3, Home, Inbox, LayoutTemplate, Moon, Plus, Search, Sun, User } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { buscarGlobal } from "@/app/(painel)/acoes";
import { usePainel } from "./contexto";
import type { ResultadoBusca } from "@/lib/dados/tipos";

const item =
  "flex h-9 cursor-default items-center gap-2.5 rounded-lg px-2.5 text-sm text-fg-muted data-[selected=true]:bg-overlay data-[selected=true]:text-fg [&_svg]:size-4";

export function Busca({ aberto, setAberto, novoLead }: { aberto: boolean; setAberto: (v: boolean) => void; novoLead: () => void }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [termo, setTermo] = React.useState("");
  const [res, setRes] = React.useState<ResultadoBusca[]>([]);
  const [carregando, setCarregando] = React.useState(false);

  React.useEffect(() => {
    if (!aberto) setTermo("");
  }, [aberto]);

  React.useEffect(() => {
    if (termo.trim().length < 2) return setRes([]);
    setCarregando(true);
    const t = setTimeout(async () => {
      setRes(await buscarGlobal(termo));
      setCarregando(false);
    }, 180);
    return () => clearTimeout(t);
  }, [termo]);

  const ir = (href: string) => {
    setAberto(false);
    router.push(href);
  };

  // Comandos ficam sempre disponíveis: sem termo, todos; com termo, os que batem com o que foi digitado
  const { perfil } = usePainel();
  const sem = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const comandos = [
    { id: "inicio", rotulo: "Início", Icone: Home, teclas: ["G", "H"], fazer: () => ir("/") },
    { id: "leads", rotulo: "Caixa de entrada", Icone: Inbox, teclas: ["G", "I"], fazer: () => ir("/leads") },
    { id: "funil", rotulo: "Funil", Icone: Columns3, teclas: ["G", "F"], fazer: () => ir("/funil") },
    { id: "relatorios", rotulo: "Relatórios", Icone: BarChart3, teclas: ["G", "R"], fazer: () => ir("/relatorios") },
    { id: "automacoes", rotulo: "Automações", Icone: Bot, teclas: ["G", "A"], fazer: () => ir("/automacoes") },
    { id: "novo", rotulo: "Novo lead", Icone: Plus, teclas: ["N"], fazer: () => { setAberto(false); novoLead(); } },
    { id: "tema", rotulo: resolvedTheme === "dark" ? "Tema claro" : "Tema escuro", Icone: resolvedTheme === "dark" ? Sun : Moon, teclas: null,
      fazer: () => { setTheme(resolvedTheme === "dark" ? "light" : "dark"); setAberto(false); } },
    ...(perfil.papel === "admin" ? [{ id: "design", rotulo: "Design system", Icone: LayoutTemplate, teclas: null, fazer: () => ir("/design") }] : []),
  ];
  const curto = termo.trim().length < 2;
  const comandosVisiveis = curto ? comandos : comandos.filter((c) => sem(c.rotulo).includes(sem(termo.trim())));

  return (
    <D.Root open={aberto} onOpenChange={setAberto}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-canvas/60 backdrop-blur-[2px]" />
        <D.Content className="fixed left-1/2 top-[14vh] z-50 w-[calc(100%-32px)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-raised shadow-pop data-[state=open]:animate-enter">
          <D.Title className="sr-only">Buscar</D.Title>
          <Command shouldFilter={false} loop label="Busca e comandos">
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search className="size-4 text-fg-subtle" aria-hidden />
              <Command.Input
                value={termo}
                onValueChange={setTermo}
                placeholder="Buscar lead, cliente, empresa ou #protocolo, ou ir para uma tela"
                className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-fg-subtle"
              />
              <Kbd>Esc</Kbd>
            </div>
            <Command.List className="max-h-[50vh] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-6 text-center text-sm text-fg-muted">
                {carregando ? "Buscando…" : "Nada encontrado."}
              </Command.Empty>
              {res.length > 0 && (
                <Command.Group heading="Resultados" className="mb-1 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-fg-subtle">
                  {res.map((r) => (
                    <Command.Item key={`${r.tipo}-${r.id}`} value={`${r.tipo}-${r.id}`} onSelect={() => ir(r.href)} className={item}>
                      {r.tipo === "contato" ? <User /> : r.tipo === "negocio" ? <Columns3 /> : <Inbox />}
                      <span className="truncate text-fg">{r.titulo}</span>
                      <span className="truncate text-xs text-fg-subtle">{r.subtitulo}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {comandosVisiveis.length > 0 && (
                <Command.Group heading={curto ? "Ir para" : "Comandos"} className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-fg-subtle">
                  {comandosVisiveis.map((c) => (
                    <Command.Item key={c.id} value={`cmd-${c.id}`} onSelect={c.fazer} className={item}>
                      <c.Icone /> {c.rotulo}
                      {c.teclas && <span className="ml-auto flex gap-1">{c.teclas.map((t) => <Kbd key={t}>{t}</Kbd>)}</span>}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
