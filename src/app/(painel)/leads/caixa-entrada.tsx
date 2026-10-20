"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Inbox, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { toastUndo } from "@/components/ui/toaster";
import { usePainel, useTecla } from "@/components/painel/contexto";
import { supabaseNavegador } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ORIGENS, SERVICOS, type Servico } from "@/lib/rotulos";
import type { LeadInbox } from "@/lib/dados/tipos";
import type { FiltroSalvo } from "@/lib/dados/consultas";
import { carregarLeadInbox, descartarLead, removerFiltro, restaurarLead, salvarFiltro } from "../acoes";
import { FichaLead } from "./ficha-lead";
import { GRADE, LinhaLead } from "./linha";

type Visao = "abertos" | "meus" | "estourados" | "todos" | "descartados";
const VISOES: { id: Visao; rotulo: string }[] = [
  { id: "abertos", rotulo: "Sem resposta" },
  { id: "meus", rotulo: "Meus" },
  { id: "estourados", rotulo: "SLA estourado" },
  { id: "todos", rotulo: "Todos" },
  { id: "descartados", rotulo: "Descartados" },
];

const aberto = (l: LeadInbox) => l.status === "novo" || l.status === "em_atendimento";

export function CaixaEntrada({ iniciais, idInicial, visaoInicial, filtrosIniciais }: { iniciais: LeadInbox[]; idInicial: string | null; visaoInicial?: string; filtrosIniciais: FiltroSalvo[] }) {
  const { perfil, offline, nomeDe, equipe } = usePainel();
  const router = useRouter();
  const [leads, setLeads] = React.useState(iniciais);
  const [novos, setNovos] = React.useState<Set<string>>(new Set());
  const [visao, setVisao] = React.useState<Visao>(VISOES.some((v) => v.id === visaoInicial) ? (visaoInicial as Visao) : "abertos");
  const [servico, setServico] = React.useState("");
  const [origem, setOrigem] = React.useState("");
  const [resp, setResp] = React.useState("");
  const [busca, setBusca] = React.useState("");
  const [filtros, setFiltros] = React.useState(filtrosIniciais);
  const [sel, setSel] = React.useState<string | null>(idInicial);
  const [aberta, setAberta] = React.useState(Boolean(idInicial));
  const [comando, setComando] = React.useState<{ tipo: "responder" | "descartar"; n: number }>({ tipo: "responder", n: 0 });
  const buscaRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => setLeads(iniciais), [iniciais]);

  // Tempo real: pedido novo entra no topo com destaque; mudanças atualizam a linha
  React.useEffect(() => {
    if (offline) return;
    const sb = supabaseNavegador();
    const canal = sb
      .channel("inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, async (p) => {
        const id = (p.new as { id?: string })?.id;
        if (!id) return;
        const linha = await carregarLeadInbox(id);
        if (!linha) return;
        setLeads((xs) => (xs.some((x) => x.id === id) ? xs.map((x) => (x.id === id ? linha : x)) : [linha, ...xs]));
        if (p.eventType === "INSERT") {
          setNovos((s) => new Set(s).add(id));
          setTimeout(() => setNovos((s) => { const n = new Set(s); n.delete(id); return n; }), 60_000);
        }
      })
      .subscribe();
    return () => { sb.removeChannel(canal); };
  }, [offline]);

  const agora = Date.now();
  const termo = busca.trim().toLowerCase();
  const lista = React.useMemo(() => {
    const filtrada = leads.filter((l) => {
      if (visao === "abertos" && !(aberto(l) && !l.primeira_resposta_em)) return false;
      if (visao === "meus" && !(aberto(l) && l.responsavel_id === perfil.id)) return false;
      if (visao === "estourados" && !(aberto(l) && !l.primeira_resposta_em && new Date(l.sla_vence_em).getTime() < agora)) return false;
      if (visao === "todos" && l.status === "descartado") return false;
      if (visao === "descartados" && l.status !== "descartado") return false;
      if (servico && !l.servicos.includes(servico as Servico)) return false;
      if (origem && (l.origem ?? "direto") !== origem) return false;
      if (resp && (resp === "ninguem" ? l.responsavel_id : l.responsavel_id !== resp)) return false;
      if (termo && !`${l.nome} ${l.empresa ?? ""} ${l.email ?? ""} ${l.dor} #${String(l.protocolo).padStart(4, "0")}`.toLowerCase().includes(termo)) return false;
      return true;
    });
    const porUrgencia = visao === "abertos" || visao === "estourados" || visao === "meus";
    return filtrada.sort((a, b) =>
      porUrgencia ? +new Date(a.sla_vence_em) - +new Date(b.sla_vence_em) : +new Date(b.created_at) - +new Date(a.created_at));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, visao, servico, origem, resp, termo, perfil.id]);

  const contagem = React.useMemo(() => ({
    abertos: leads.filter((l) => aberto(l) && !l.primeira_resposta_em).length,
    meus: leads.filter((l) => aberto(l) && l.responsavel_id === perfil.id).length,
    estourados: leads.filter((l) => aberto(l) && !l.primeira_resposta_em && new Date(l.sla_vence_em).getTime() < Date.now()).length,
  }), [leads, perfil.id]);

  const selecionado = leads.find((l) => l.id === sel) ?? null;

  const abrir = React.useCallback((id: string) => {
    setSel(id);
    setAberta(true);
    window.history.replaceState(null, "", `/leads?id=${id}`);
  }, []);
  const fechar = () => {
    setAberta(false);
    window.history.replaceState(null, "", "/leads");
  };

  const mover = (d: 1 | -1) => {
    if (!lista.length) return;
    const i = lista.findIndex((l) => l.id === sel);
    const prox = lista[Math.min(lista.length - 1, Math.max(0, i === -1 ? 0 : i + d))];
    setSel(prox.id);
    if (aberta) abrir(prox.id);
  };
  useTecla("j", () => mover(1), !aberta);
  useTecla("k", () => mover(-1), !aberta);
  useTecla("Enter", () => sel && abrir(sel), !aberta);
  useTecla("e", () => { if (sel) { abrir(sel); setComando((c) => ({ tipo: "responder", n: c.n + 1 })); } }, !aberta);
  useTecla("/", (e) => { e.preventDefault(); buscaRef.current?.focus(); });

  const atualizar = React.useCallback((id: string, patch: Partial<LeadInbox>) => {
    setLeads((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }, []);

  async function descartar(lead: LeadInbox, motivo: string) {
    const statusAntes = lead.status === "em_atendimento" ? "em_atendimento" : "novo";
    atualizar(lead.id, { status: "descartado" });
    fechar();
    const r = await descartarLead(lead.id, motivo);
    if (!r.ok) {
      atualizar(lead.id, { status: lead.status });
      toast.error(r.erro);
      return;
    }
    toastUndo(`Pedido descartado: ${motivo}`, async () => {
      atualizar(lead.id, { status: statusAntes });
      const d = await restaurarLead(lead.id, statusAntes);
      if (!d.ok) toast.error(d.erro);
    });
  }
  useTecla("d", () => {
    if (selecionado && aberto(selecionado)) {
      abrir(selecionado.id);
      setComando((c) => ({ tipo: "descartar", n: c.n + 1 }));
    }
  }, !aberta);

  const filtroAtual = { visao, servico, origem, resp };
  async function salvarAtual() {
    const nome = window.prompt("Nome do filtro (ex.: Automação vindo do Google)");
    if (!nome) return;
    const valores = Object.fromEntries(Object.entries(filtroAtual).filter(([, v]) => v));
    const r = await salvarFiltro("inbox", nome, valores, true);
    if (!r.ok) return toast.error(r.erro);
    setFiltros((f) => [...f, { id: (r.dados as { id: string } | undefined)?.id ?? crypto.randomUUID(), nome, filtros: valores, compartilhado: true }]);
    toast.success("Filtro salvo para a equipe");
  }
  const aplicar = (f: FiltroSalvo) => {
    setVisao((f.filtros.visao as Visao) ?? "todos");
    setServico(f.filtros.servico ?? "");
    setOrigem(f.filtros.origem ?? "");
    setResp(f.filtros.resp ?? "");
  };
  const temFiltro = servico || origem || resp || termo;

  return (
    <div className="flex h-[calc(100dvh-48px)] flex-col">
      <div className="flex flex-col gap-3 border-b border-border px-4 pb-3 pt-5 sm:px-6">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-semibold">Caixa de entrada</h1>
          <span className="num text-sm text-fg-muted">{contagem.abertos} sem resposta</span>
        </div>
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1" role="tablist" aria-label="Visões">
          {VISOES.map((v) => {
            const n = (contagem as Record<string, number>)[v.id];
            return (
              <button
                key={v.id}
                role="tab"
                aria-selected={visao === v.id}
                onClick={() => setVisao(v.id)}
                className={cn(
                  "flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm text-fg-muted transition-colors hover:bg-overlay hover:text-fg",
                  visao === v.id && "bg-overlay text-fg",
                )}
              >
                {v.rotulo}
                {n > 0 && <span className={cn("num text-xs", v.id === "estourados" ? "text-danger" : "text-fg-subtle")}>{n}</span>}
              </button>
            );
          })}
          {filtros.map((f) => (
            <span key={f.id} className="group flex h-7 shrink-0 items-center rounded-md border border-dashed border-border-strong text-sm text-fg-muted">
              <button onClick={() => aplicar(f)} className="flex items-center gap-1.5 pl-2.5 pr-1 hover:text-fg"><Bookmark className="size-3.5" />{f.nome}</button>
              <button
                aria-label={`Remover filtro ${f.nome}`}
                onClick={async () => {
                  setFiltros((xs) => xs.filter((x) => x.id !== f.id));
                  const r = await removerFiltro(f.id);
                  if (!r.ok) { setFiltros((xs) => [...xs, f]); toast.error(r.erro); }
                }}
                className="pr-1.5 opacity-0 transition-opacity hover:text-fg group-hover:opacity-100"
              ><X className="size-3.5" /></button>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-fg-subtle" aria-hidden />
            <Input ref={buscaRef} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar por nome, empresa, dor, #protocolo" className="pl-8" aria-label="Filtrar" />
            <Kbd className="absolute right-2 top-1.5">/</Kbd>
          </div>
          <Select value={servico} onChange={(e) => setServico(e.target.value)} aria-label="Serviço">
            <option value="">Todos os serviços</option>
            {Object.entries(SERVICOS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </Select>
          <Select value={origem} onChange={(e) => setOrigem(e.target.value)} aria-label="Origem">
            <option value="">Todas as origens</option>
            {Object.entries(ORIGENS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </Select>
          <Select value={resp} onChange={(e) => setResp(e.target.value)} aria-label="Responsável">
            <option value="">Qualquer responsável</option>
            <option value="ninguem">Sem responsável</option>
            {equipe.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </Select>
          {temFiltro && <Button variant="ghost" size="sm" onClick={() => { setServico(""); setOrigem(""); setResp(""); setBusca(""); }}>Limpar</Button>}
          <Button variant="ghost" size="sm" onClick={salvarAtual}><Bookmark /> Salvar filtro</Button>
        </div>
      </div>

      <div role="grid" aria-label="Pedidos" className="flex-1 overflow-y-auto">
        <div role="row" className={cn(GRADE, "sticky top-0 z-10 hidden h-8 border-b border-border bg-canvas/95 px-4 text-xs text-fg-subtle backdrop-blur md:grid")}>
          <span>Protocolo</span><span>Nome</span><span>Serviços</span><span>O que precisa</span><span>Origem</span><span>Chegou</span><span>SLA</span><span />
        </div>
        {lista.map((l) => (
          <LinhaLead key={l.id} lead={l} selecionado={l.id === sel} novo={novos.has(l.id)} responsavel={nomeDe(l.responsavel_id)} onAbrir={() => abrir(l.id)} />
        ))}
        {lista.length === 0 && (
          <EmptyState
            icon={<Inbox />}
            title={visao === "abertos" ? "Nenhum pedido esperando resposta" : visao === "estourados" ? "Nenhum SLA estourado" : "Nada por aqui"}
            description={visao === "abertos" ? "Quando o formulário do site enviar um pedido, ele aparece aqui na hora." : temFiltro ? "Tente limpar os filtros." : undefined}
            action={visao === "abertos" ? <Button size="sm" onClick={() => router.push("/funil")}>Ver o funil</Button> : temFiltro ? <Button size="sm" onClick={() => { setServico(""); setOrigem(""); setResp(""); setBusca(""); }}>Limpar filtros</Button> : undefined}
          />
        )}
        <p className="hidden px-4 py-3 text-xs text-fg-subtle md:block">
          <Kbd>J</Kbd> <Kbd>K</Kbd> navegam · <Kbd>Enter</Kbd> abre · <Kbd>E</Kbd> responde · <Kbd>?</Kbd> todos os atalhos
        </p>
      </div>

      <FichaLead
        id={sel}
        resumo={selecionado}
        aberto={aberta}
        onFechar={fechar}
        comando={comando}
        onAtualizar={atualizar}
        onDescartar={descartar}
      />
    </div>
  );
}
