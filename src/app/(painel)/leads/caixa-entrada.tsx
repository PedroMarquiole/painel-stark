"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bookmark, Inbox, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { toastUndo } from "@/components/ui/toaster";
import { usePainel, useTecla } from "@/components/painel/contexto";
import { useRelogio } from "@/hooks/use-now";
import { chamar } from "@/lib/chamar";
import { supabaseNavegador } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { SLA_VENCENDO_MS } from "@/lib/sla";
import { ORIGENS, SERVICOS, SITUACOES, type Servico } from "@/lib/rotulos";
import type { LeadInbox } from "@/lib/dados/tipos";
import type { FiltroSalvo } from "@/lib/dados/consultas";
import { carregarLeadInbox, descartarLead, removerFiltro, restaurarLead, salvarFiltro } from "../acoes";
import { FichaLead } from "./ficha-lead";
import { GRADE, LinhaLead } from "./linha";

type Visao = "abertos" | "vencendo" | "estourados" | "meus" | "todos" | "descartados";
const VISOES: { id: Visao; rotulo: string }[] = [
  { id: "abertos", rotulo: "Sem resposta" },
  { id: "vencendo", rotulo: "Vencendo (<4h)" },
  { id: "estourados", rotulo: "SLA estourado" },
  { id: "meus", rotulo: "Meus" },
  { id: "todos", rotulo: "Todos" },
  { id: "descartados", rotulo: "Descartados" },
];
const ehVisao = (v: string | null): v is Visao => VISOES.some((x) => x.id === v);

const aberto = (l: LeadInbox) => l.status === "novo" || l.status === "em_atendimento";
const semResposta = (l: LeadInbox) => aberto(l) && !l.primeira_resposta_em;
const falta = (l: LeadInbox, agora: number) => new Date(l.sla_vence_em).getTime() - agora;

export function CaixaEntrada({ iniciais, filtrosIniciais }: { iniciais: LeadInbox[]; filtrosIniciais: FiltroSalvo[] }) {
  const { perfil, offline, nomeDe, equipe } = usePainel();
  const router = useRouter();
  const params = useSearchParams();
  const agora = useRelogio();
  const [leads, setLeads] = React.useState(iniciais);
  const [novos, setNovos] = React.useState<Set<string>>(new Set());
  const [visao, setVisao] = React.useState<Visao>(ehVisao(params.get("visao")) ? (params.get("visao") as Visao) : "abertos");
  const [servico, setServico] = React.useState(params.get("servico") ?? "");
  const [origem, setOrigem] = React.useState(params.get("origem") ?? "");
  const [situacao, setSituacao] = React.useState(params.get("situacao") ?? "");
  const [resp, setResp] = React.useState("");
  const [busca, setBusca] = React.useState("");
  const [filtros, setFiltros] = React.useState(filtrosIniciais);
  const [sel, setSel] = React.useState<string | null>(params.get("id"));
  const [aberta, setAberta] = React.useState(Boolean(params.get("id")));
  const [comando, setComando] = React.useState<{ tipo: "responder" | "descartar"; n: number }>({ tipo: "responder", n: 0 });
  const buscaRef = React.useRef<HTMLInputElement>(null);
  const dias = Number(params.get("dias")) || null;
  const podeAgir = perfil.papel !== "projetos";

  React.useEffect(() => setLeads(iniciais), [iniciais]);

  // Links para /leads?id=… (notificação, ⌘K, sino) abrem a ficha mesmo já estando nesta tela
  const idDaUrl = params.get("id");
  React.useEffect(() => {
    if (idDaUrl) {
      setSel(idDaUrl);
      setAberta(true);
    }
  }, [idDaUrl]);
  const visaoDaUrl = params.get("visao");
  React.useEffect(() => {
    if (ehVisao(visaoDaUrl)) setVisao(visaoDaUrl);
  }, [visaoDaUrl]);

  // Tempo real: pedido novo entra no topo com destaque; mudanças atualizam a linha
  React.useEffect(() => {
    if (offline) return;
    const sb = supabaseNavegador();
    const canal = sb
      .channel("inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, async (p) => {
        const id = (p.new as { id?: string })?.id;
        if (!id) return;
        const linha = await carregarLeadInbox(id).catch(() => null);
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

  const termo = busca.trim().toLowerCase();
  const desde = dias ? agora - dias * 86_400_000 : null;
  const lista = React.useMemo(() => {
    const filtrada = leads.filter((l) => {
      if (visao === "abertos" && !semResposta(l)) return false;
      if (visao === "vencendo" && !(semResposta(l) && falta(l, agora) >= 0 && falta(l, agora) < SLA_VENCENDO_MS)) return false;
      if (visao === "estourados" && !(semResposta(l) && falta(l, agora) < 0)) return false;
      if (visao === "meus" && !(aberto(l) && l.responsavel_id === perfil.id)) return false;
      if (visao === "todos" && l.status === "descartado") return false;
      if (visao === "descartados" && l.status !== "descartado") return false;
      if (desde && new Date(l.created_at).getTime() < desde) return false;
      if (servico && !l.servicos.includes(servico as Servico)) return false;
      if (origem && (l.origem ?? "direto") !== origem) return false;
      if (situacao && (l.situacao_atual ?? "nao_informado") !== situacao) return false;
      if (resp && (resp === "ninguem" ? l.responsavel_id : l.responsavel_id !== resp)) return false;
      if (termo && !`${l.nome} ${l.empresa ?? ""} ${l.email ?? ""} ${l.dor} #${String(l.protocolo).padStart(4, "0")}`.toLowerCase().includes(termo)) return false;
      return true;
    });
    const porUrgencia = visao === "abertos" || visao === "vencendo" || visao === "estourados" || visao === "meus";
    return filtrada.sort((a, b) => {
      // pedido que acabou de chegar fica no topo, em qualquer ordenação
      const na = novos.has(a.id) ? 1 : 0;
      const nb = novos.has(b.id) ? 1 : 0;
      if (na !== nb) return nb - na;
      return porUrgencia ? +new Date(a.sla_vence_em) - +new Date(b.sla_vence_em) : +new Date(b.created_at) - +new Date(a.created_at);
    });
  }, [leads, visao, servico, origem, situacao, resp, termo, perfil.id, agora, desde, novos]);

  const contagem = React.useMemo(() => ({
    abertos: leads.filter(semResposta).length,
    vencendo: leads.filter((l) => semResposta(l) && falta(l, agora) >= 0 && falta(l, agora) < SLA_VENCENDO_MS).length,
    estourados: leads.filter((l) => semResposta(l) && falta(l, agora) < 0).length,
    meus: leads.filter((l) => aberto(l) && l.responsavel_id === perfil.id).length,
  }), [leads, perfil.id, agora]);

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
  };
  useTecla("j", () => mover(1), !aberta);
  useTecla("k", () => mover(-1), !aberta);
  useTecla("Enter", () => sel && abrir(sel), !aberta);
  useTecla("e", () => { if (sel && podeAgir) { abrir(sel); setComando((c) => ({ tipo: "responder", n: c.n + 1 })); } }, !aberta);
  useTecla("d", () => {
    if (selecionado && aberto(selecionado) && podeAgir) {
      abrir(selecionado.id);
      setComando((c) => ({ tipo: "descartar", n: c.n + 1 }));
    }
  }, !aberta);
  useTecla("/", () => buscaRef.current?.focus());

  const atualizar = React.useCallback((id: string, patch: Partial<LeadInbox>) => {
    setLeads((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }, []);

  async function descartar(lead: LeadInbox, motivo: string) {
    const statusAntes = lead.status === "em_atendimento" ? "em_atendimento" : "novo";
    atualizar(lead.id, { status: "descartado" });
    fechar();
    const r = await chamar(descartarLead(lead.id, motivo));
    if (!r.ok) {
      atualizar(lead.id, { status: lead.status });
      toast.error(r.erro);
      return;
    }
    toastUndo(`Pedido descartado: ${motivo}`, async () => {
      atualizar(lead.id, { status: statusAntes });
      const d = await chamar(restaurarLead(lead.id, statusAntes));
      if (!d.ok) {
        atualizar(lead.id, { status: "descartado" });
        toast.error(d.erro);
      }
    });
  }

  async function salvarAtual() {
    const nome = window.prompt("Nome do filtro (ex.: Automação vindo do Google)");
    if (!nome?.trim()) return;
    const valores = Object.fromEntries(Object.entries({ visao, servico, origem, situacao, resp }).filter(([, v]) => v));
    const r = await chamar(salvarFiltro("inbox", nome, valores, true));
    if (!r.ok) return void toast.error(r.erro);
    const id = (r.dados as { id: string } | undefined)?.id ?? crypto.randomUUID();
    setFiltros((f) => [...f, { id, nome: nome.trim().slice(0, 40), filtros: valores, compartilhado: true, profile_id: perfil.id }]);
    toast.success("Filtro salvo para a equipe");
  }

  async function remover(f: FiltroSalvo) {
    setFiltros((xs) => xs.filter((x) => x.id !== f.id));
    const r = await chamar(removerFiltro(f.id));
    if (!r.ok) {
      setFiltros((xs) => [...xs, f]);
      return void toast.error(r.erro);
    }
    toastUndo(`Filtro “${f.nome}” removido`, async () => {
      const s = await chamar(salvarFiltro("inbox", f.nome, f.filtros, f.compartilhado));
      if (!s.ok) return void toast.error(s.erro);
      setFiltros((xs) => [...xs, { ...f, id: (s.dados as { id: string } | undefined)?.id ?? f.id }]);
    });
  }

  const aplicar = (f: FiltroSalvo) => {
    setVisao(ehVisao(f.filtros.visao ?? null) ? (f.filtros.visao as Visao) : "todos");
    setServico(f.filtros.servico ?? "");
    setOrigem(f.filtros.origem ?? "");
    setSituacao(f.filtros.situacao ?? "");
    setResp(f.filtros.resp ?? "");
  };
  const limpar = () => {
    setServico(""); setOrigem(""); setSituacao(""); setResp(""); setBusca("");
    if (dias) router.replace("/leads");
  };
  const temFiltro = Boolean(servico || origem || situacao || resp || termo || dias);

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
                {n > 0 && <span className={cn("num text-xs", v.id === "estourados" ? "text-danger" : v.id === "vencendo" ? "text-warning" : "text-fg-subtle")}>{n}</span>}
              </button>
            );
          })}
          {filtros.map((f) => (
            <span key={f.id} className="group flex h-7 shrink-0 items-center rounded-md border border-dashed border-border-strong text-sm text-fg-muted">
              <button onClick={() => aplicar(f)} className="flex items-center gap-1.5 pl-2.5 pr-2 hover:text-fg"><Bookmark className="size-3.5" />{f.nome}</button>
              {f.profile_id === perfil.id && (
                <button aria-label={`Remover filtro ${f.nome}`} onClick={() => remover(f)} className="-ml-1 pr-1.5 opacity-60 transition-opacity hover:text-fg hover:opacity-100">
                  <X className="size-3.5" />
                </button>
              )}
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
            {origem && !(origem in ORIGENS) && <option value={origem}>{origem}</option>}
          </Select>
          <Select value={situacao} onChange={(e) => setSituacao(e.target.value)} aria-label="Como resolve hoje">
            <option value="">Qualquer situação</option>
            {Object.entries(SITUACOES).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </Select>
          <Select value={resp} onChange={(e) => setResp(e.target.value)} aria-label="Responsável">
            <option value="">Qualquer responsável</option>
            <option value="ninguem">Sem responsável</option>
            {equipe.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </Select>
          {dias && (
            <span className="flex h-7 items-center gap-1 rounded-md bg-accent-soft pl-2.5 pr-1 text-xs text-fg">
              Chegaram nos últimos {dias} dias
              <button aria-label="Remover período" onClick={() => router.replace("/leads")} className="p-0.5 text-fg-muted hover:text-fg"><X className="size-3.5" /></button>
            </span>
          )}
          {temFiltro && <Button variant="ghost" size="sm" onClick={limpar}>Limpar</Button>}
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
            title={visao === "abertos" ? "Nenhum pedido esperando resposta" : visao === "estourados" ? "Nenhum SLA estourado" : visao === "vencendo" ? "Nada vencendo nas próximas 4h" : "Nada por aqui"}
            description={visao === "abertos" && !temFiltro ? "Quando o formulário do site enviar um pedido, ele aparece aqui na hora." : temFiltro ? "Tente limpar os filtros." : undefined}
            action={temFiltro ? <Button size="sm" onClick={limpar}>Limpar filtros</Button> : visao === "abertos" ? <Button size="sm" onClick={() => router.push("/funil")}>Ver o funil</Button> : undefined}
          />
        )}
        <p className="hidden px-4 py-3 text-xs text-fg-subtle md:block">
          <Kbd>J</Kbd> <Kbd>K</Kbd> navegam · <Kbd>Enter</Kbd> abre · <Kbd>E</Kbd> responde · <Kbd>D</Kbd> descarta · <Kbd>?</Kbd> todos os atalhos
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
