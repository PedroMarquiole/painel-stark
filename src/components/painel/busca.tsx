"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import * as D from "@radix-ui/react-dialog";
import { useTheme } from "next-themes";
import { BarChart3, Bot, Building2, Columns3, Home, Inbox, LayoutTemplate, Moon, Plus, Search, Sun, User } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { buscarGlobal } from "@/app/(painel)/acoes";
import type { ResultadoBusca } from "@/lib/dados/tipos";

const item =
  "flex h-9 cursor-default items-center gap-2.5 rounded-md px-2.5 text-sm text-fg-muted data-[selected=true]:bg-overlay data-[selected=true]:text-fg [&_svg]:size-4";

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

  return (
    <D.Root open={aberto} onOpenChange={setAberto}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-canvas/60 backdrop-blur-[2px]" />
        <D.Content className="fixed left-1/2 top-[14vh] z-50 w-[calc(100%-32px)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-raised shadow-pop data-[state=open]:animate-enter">
          <D.Title className="sr-only">Buscar</D.Title>
          <Command shouldFilter={false} loop label="Busca e comandos">
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search className="size-4 text-fg-subtle" aria-hidden />
              <Command.Input
                value={termo}
                onValueChange={setTermo}
                placeholder="Buscar cliente, empresa, #protocolo… ou digite um comando"
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
              {termo.trim().length < 2 && (
                <Command.Group heading="Ir para" className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-fg-subtle">
                  <Command.Item value="inicio" onSelect={() => ir("/")} className={item}><Home /> Início <span className="ml-auto flex gap-1"><Kbd>G</Kbd><Kbd>H</Kbd></span></Command.Item>
                  <Command.Item value="leads" onSelect={() => ir("/leads")} className={item}><Inbox /> Caixa de entrada <span className="ml-auto flex gap-1"><Kbd>G</Kbd><Kbd>I</Kbd></span></Command.Item>
                  <Command.Item value="funil" onSelect={() => ir("/funil")} className={item}><Columns3 /> Funil <span className="ml-auto flex gap-1"><Kbd>G</Kbd><Kbd>F</Kbd></span></Command.Item>
                  <Command.Item value="relatorios" onSelect={() => ir("/relatorios")} className={item}><BarChart3 /> Relatórios <span className="ml-auto flex gap-1"><Kbd>G</Kbd><Kbd>R</Kbd></span></Command.Item>
                  <Command.Item value="automacoes" onSelect={() => ir("/automacoes")} className={item}><Bot /> Automações <span className="ml-auto flex gap-1"><Kbd>G</Kbd><Kbd>A</Kbd></span></Command.Item>
                  <Command.Item value="design" onSelect={() => ir("/design")} className={item}><LayoutTemplate /> Design system</Command.Item>
                  <Command.Item value="novo" onSelect={() => { setAberto(false); novoLead(); }} className={item}><Plus /> Novo lead <span className="ml-auto"><Kbd>N</Kbd></span></Command.Item>
                  <Command.Item value="tema" onSelect={() => { setTheme(resolvedTheme === "dark" ? "light" : "dark"); setAberto(false); }} className={item}>
                    {resolvedTheme === "dark" ? <Sun /> : <Moon />} Alternar tema
                  </Command.Item>
                  <Command.Item value="empresas" disabled className={`${item} opacity-50`}><Building2 /> Projetos e financeiro chegam nas Fases 3 e 4</Command.Item>
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
