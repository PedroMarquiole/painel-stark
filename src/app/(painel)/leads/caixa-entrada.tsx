"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Bookmark, Flame, Inbox, Search, User, X, type LucideIcon } from "lucide-react";
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
import { cn, formatProtocolo } from "@/lib/utils";
import { SLA_VENCENDO_MS } from "@/lib/sla";
import { ORIGENS, SERVICOS, SITUACOES, type Servico } from "@/lib/rotulos";
import type { LeadInbox } from "@/lib/dados/tipos";
import type { FiltroSalvo } from "@/lib/dados/consultas";
import { carregarLeadInbox, descartarLead, removerFiltro, restaurarLead, salvarFiltro } from "../acoes";
import { FichaLead } from "./ficha-lead";
import { GRADE, LinhaLead } from "./linha";

/**
 * O caminho do pedido, sempre na mesma ordem:
 * Novos (SLA correndo) → Em conversa (respondido; o negócio anda no funil) → Arquivados (convertido ou descartado).
 */
type Aba = "novos" | "conversa" | "arquivados" | "todos";
type Urgencia = "" | "vencendo" | "estourados";
const ABAS: { id: Aba; rotulo: string; dica: string }[] = [
  { id: "novos", rotulo: "Novos", dica: "Ainda sem resposta. O prazo de 1 dia útil está correndo." },
  { id: "conversa", rotulo: "Em conversa", dica: "Já respondidos. O negócio segue no funil." },
  { id: "arquivados", rotulo: "Arquivados", dica: "Convertidos em cliente ou descartados." },
];

/** Links antigos (?visao=vencendo, ?visao=descartados…) continuam funcionando. */
function lerVisao(v: string | null): { aba: Aba; urgencia: Urgencia; meus: boolean } | null {
  switch (v) {
    case "novos": case "abertos": return { aba: "novos", urgencia: "", meus: false };
    case "vencendo": return { aba: "novos", urgencia: "vencendo", meus: false };
    case "estourados": return { aba: "novos", urgencia: "estourados", meus: false };
    case "meus": return { aba: "novos", urgencia: "", meus: true };
    case "conversa": return { aba: "conversa", urgencia: "", meus: false };
    case "arquivados": case "descartados": return { aba: "arquivados", urgencia: "", meus: false };
    case "todos": return { aba: "todos", urgencia: "", meus: false };
    default: return null;
  }
}

// Negócio fechado (ganho ou perdido) também encerra o pedido: vai para Arquivados
const negocioFechado = (l: LeadInbox) => l.etapa === "ganho" || l.etapa === "perdido";
const aberto = (l: LeadInbox) => (l.status === "novo" || l.status === "em_atendimento") && !negocioFechado(l);
const semResposta = (l: LeadInbox) => aberto(l) && !l.primeira_resposta_em;
const emConversa = (l: LeadInbox) => aberto(l) && Boolean(l.primeira_resposta_em);
const arquivado = (l: LeadInbox) => l.status === "convertido" || l.status === "descartado" || negocioFechado(l);
const falta = (l: LeadInbox, agora: number) => new Date(l.sla_vence_em).getTime() - agora;
const vencendo = (l: LeadInbox, agora: number) => semResposta(l) && falta(l, agora) >= 0 && falta(l, agora) < SLA_VENCENDO_MS;
const estourado = (l: LeadInbox, agora: number) => semResposta(l) && falta(l, agora) < 0;

function Chip({ ativo, onClick, cor, Icone, children }: {
  ativo: boolean; onClick: () => void; cor?: "warning" | "danger"; Icone: LucideIcon; children: React.ReactNode;
}) {
  return (
    <button
      aria-pressed={ativo}
      onClick={onClick}
      className={cn(
        "flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors [&_svg]:size-3.5",
        ativo ? "border-transparent bg-accent-soft text-fg" : "border-border text-fg-muted hover:border-border-strong hover:text-fg",
        !ativo && cor === "warning" && "[&_svg]:text-warning",
        !ativo && cor === "danger" && "[&_svg]:text-danger",
      )}
    >
      <Icone aria-hidden />{children}
    </button>
  );
}

export function CaixaEntrada({ iniciais, filtrosIniciais }: { iniciais: LeadInbox[]; filtrosIniciais: FiltroSalvo[] }) {
  const { perfil, offline, nomeDe, equipe } = usePainel();
  const router = useRouter();
  const params = useSearchParams();
  const agora = useRelogio();
  const [leads, setLeads] = React.useState(iniciais);
  const [novos, setNovos] = React.useState<Set<string>>(new Set());
  const inicial = lerVisao(params.get("visao")) ?? { aba: "novos" as Aba, urgencia: "" as Urgencia, meus: false };
  const [aba, setAbaBruta] = React.useState<Aba>(inicial.aba);
  const [urgencia, setUrgencia] = React.useState<Urgencia>(inicial.urgencia);
  const [meus, setMeus] = React.useState(inicial.meus);
  // Respondidos agora há pouco continuam visíveis em "Novos" (com aviso) até trocar de aba
  const [movidos, setMovidos] = React.useState<Set<string>>(new Set());
  const setAba = React.useCallback((a: Aba) => {
    setAbaBruta(a);
    setMovidos(new Set());
    if (a !== "novos") setUrgencia("");
  }, []);
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
    if (!idDaUrl) return;
    setSel(idDaUrl);
    setAberta(true);
    // Mostra a aba onde o pedido está, para ele aparecer na lista por trás da ficha
    const l = iniciais.find((x) => x.id === idDaUrl);
    if (l && !params.get("visao")) setAbaBruta(arquivado(l) ? "arquivados" : l.primeira_resposta_em ? "conversa" : "novos");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idDaUrl]);
  const visaoDaUrl = params.get("visao");
  React.useEffect(() => {
    const v = lerVisao(visaoDaUrl);
    if (!v) return;
    setAba(v.aba);
    setUrgencia(v.urgencia);
    setMeus(v.meus);
  }, [visaoDaUrl, setAba]);

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
      if (aba === "novos" && !(semResposta(l) || movidos.has(l.id))) return false;
      if (aba === "novos" && urgencia === "vencendo" && !vencendo(l, agora)) return false;
      if (aba === "novos" && urgencia === "estourados" && !estourado(l, agora)) return false;
      if (aba === "conversa" && !emConversa(l)) return false;
      if (aba === "arquivados" && !arquivado(l)) return false;
      if (aba === "todos" && l.status === "descartado") return false;
      if (meus && l.responsavel_id !== perfil.id) return false;
      if (desde && new Date(l.created_at).getTime() < desde) return false;
      if (servico && !l.servicos.includes(servico as Servico)) return false;
      if (origem && (l.origem ?? "direto") !== origem) return false;
      if (situacao && (l.situacao_atual ?? "nao_informado") !== situacao) return false;
      if (resp && (resp === "ninguem" ? l.responsavel_id : l.responsavel_id !== resp)) return false;
      if (termo && !`${l.nome} ${l.empresa ?? ""} ${l.email ?? ""} ${l.dor} #${String(l.protocolo).padStart(4, "0")}`.toLowerCase().includes(termo)) return false;
      return true;
    });
    // Novos: o prazo mais apertado primeiro. Em conversa: respondido mais recente primeiro. Demais: chegada.
    const tempo = (x: string | null) => (x ? +new Date(x) : 0);
    return filtrada.sort((a, b) => {
      // pedido que acabou de chegar fica no topo, em qualquer ordenação
      const na = novos.has(a.id) ? 1 : 0;
      const nb = novos.has(b.id) ? 1 : 0;
      if (na !== nb) return nb - na;
      if (aba === "novos") return tempo(a.sla_vence_em) - tempo(b.sla_vence_em);
      if (aba === "conversa") return tempo(b.primeira_resposta_em) - tempo(a.primeira_resposta_em);
      return tempo(b.created_at) - tempo(a.created_at);
    });
  }, [leads, aba, urgencia, meus, movidos, servico, origem, situacao, resp, termo, perfil.id, agora, desde, novos]);

  const contagem = React.useMemo(() => ({
    novos: leads.filter(semResposta).length,
    conversa: leads.filter(emConversa).length,
    vencendo: leads.filter((l) => vencendo(l, agora)).length,
    estourados: leads.filter((l) => estourado(l, agora)).length,
  }), [leads, agora]);

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

  /** Da ficha: na 1ª resposta, o pedido muda de aba e o negócio anda no funil. Avisa para onde foi. */
  const atualizarDaFicha = React.useCallback((id: string, patch: Partial<LeadInbox>) => {
    const antes = leads.find((x) => x.id === id);
    const primeiraResposta = Boolean(antes && !antes.primeira_resposta_em && patch.primeira_resposta_em);
    if (primeiraResposta && antes) {
      if (antes.etapa === "novo") patch = { ...patch, etapa: "triagem" };
      setMovidos((m) => new Set(m).add(id));
      toast.success(`Respondido. ${formatProtocolo(antes.protocolo)} foi para “Em conversa”`, {
        description: antes.etapa === "novo" || !antes.etapa ? "No funil, o negócio passou para Em triagem." : undefined,
        action: { label: "Ver", onClick: () => { setAba("conversa"); setSel(id); } },
        duration: 8000,
      });
    }
    atualizar(id, patch);
  }, [leads, atualizar, setAba]);

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
    const visao = aba === "novos" && urgencia ? urgencia : aba;
    const valores = Object.fromEntries(Object.entries({ visao, servico, origem, situacao, resp, meus: meus ? "1" : "" }).filter(([, v]) => v));
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
    const v = lerVisao(f.filtros.visao ?? null) ?? { aba: "todos" as Aba, urgencia: "" as Urgencia, meus: false };
    setAba(v.aba);
    setUrgencia(v.urgencia);
    setMeus(v.meus || f.filtros.meus === "1");
    setServico(f.filtros.servico ?? "");
    setOrigem(f.filtros.origem ?? "");
    setSituacao(f.filtros.situacao ?? "");
    setResp(f.filtros.resp ?? "");
  };
  const limpar = () => {
    setServico(""); setOrigem(""); setSituacao(""); setResp(""); setBusca(""); setUrgencia(""); setMeus(false);
    if (dias) router.replace("/leads");
  };
  const temFiltro = Boolean(servico || origem || situacao || resp || termo || dias || urgencia || meus);

  return (
    <div className="flex h-[calc(100dvh-64px)] flex-col max-lg:h-[calc(100dvh-64px-56px)]">
      <div className="flex flex-col gap-3 px-4 pb-4 pt-2 sm:px-6 lg:pl-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-xl font-semibold">Caixa de entrada</h1>
          <span className="text-sm text-fg-muted">{ABAS.find((x) => x.id === aba)?.dica ?? "Todos os pedidos, menos os descartados."}</span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <div className="flex shrink-0 gap-0.5 rounded-full bg-bloco p-1 shadow-bloco" role="tablist" aria-label="Etapas do pedido">
            {ABAS.map((v) => {
              const n = v.id === "arquivados" ? 0 : contagem[v.id as "novos" | "conversa"];
              return (
                <button
                  key={v.id}
                  role="tab"
                  aria-selected={aba === v.id}
                  onClick={() => setAba(v.id)}
                  className={cn(
                    "flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm text-fg-muted transition-colors hover:text-fg",
                    aba === v.id && "bg-invert text-invert-fg hover:text-invert-fg",
                  )}
                >
                  {v.rotulo}
                  {n > 0 && <span className="num text-xs opacity-70">{n}</span>}
                </button>
              );
            })}
          </div>
          {aba === "todos" && (
            <span className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-accent-soft pl-3 pr-1 text-xs text-fg">
              Todos os pedidos
              <button aria-label="Voltar para Novos" onClick={() => setAba("novos")} className="p-0.5 text-fg-muted hover:text-fg"><X className="size-3.5" /></button>
            </span>
          )}
          {aba === "novos" && (
            <>
              <Chip ativo={urgencia === "vencendo"} onClick={() => setUrgencia(urgencia === "vencendo" ? "" : "vencendo")} cor="warning" Icone={AlertTriangle}>
                Vencendo em 4h <span className="num">{contagem.vencendo}</span>
              </Chip>
              <Chip ativo={urgencia === "estourados"} onClick={() => setUrgencia(urgencia === "estourados" ? "" : "estourados")} cor="danger" Icone={Flame}>
                Prazo estourado <span className="num">{contagem.estourados}</span>
              </Chip>
            </>
          )}
          <Chip ativo={meus} onClick={() => setMeus(!meus)} Icone={User}>Só os meus</Chip>
          {filtros.map((f) => (
            <span key={f.id} className="group flex h-8 shrink-0 items-center rounded-full border border-dashed border-border-strong text-sm text-fg-muted">
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
            <span className="flex h-8 items-center gap-1 rounded-full bg-accent-soft pl-3 pr-1 text-xs text-fg">
              Chegaram nos últimos {dias} dias
              <button aria-label="Remover período" onClick={() => router.replace("/leads")} className="p-0.5 text-fg-muted hover:text-fg"><X className="size-3.5" /></button>
            </span>
          )}
          {temFiltro && <Button variant="ghost" size="sm" onClick={limpar}>Limpar</Button>}
          <Button variant="ghost" size="sm" onClick={salvarAtual}><Bookmark /> Salvar filtro</Button>
        </div>
      </div>

      <div role="grid" aria-label="Pedidos" className="mx-4 mb-4 min-h-0 overflow-y-auto rounded-2xl bg-bloco shadow-bloco sm:mx-6 lg:ml-1">
        <div role="row" className={cn(GRADE, "sticky top-0 z-10 hidden h-10 border-b border-border bg-bloco/95 px-5 text-xs text-fg-subtle backdrop-blur md:grid")}>
          <span>Protocolo</span><span>Nome</span><span>Serviços</span><span>O que precisa</span><span>Origem</span><span>Chegou</span><span>{aba === "novos" ? "Prazo" : "Andamento"}</span><span />
        </div>
        {lista.map((l) => (
          <LinhaLead key={l.id} lead={l} selecionado={l.id === sel} novo={novos.has(l.id)} movido={aba === "novos" && movidos.has(l.id)} responsavel={nomeDe(l.responsavel_id)} onAbrir={() => abrir(l.id)} />
        ))}
        {lista.length === 0 && (
          <EmptyState
            icon={<Inbox />}
            title={urgencia === "estourados" ? "Nenhum prazo estourado" : urgencia === "vencendo" ? "Nada vencendo nas próximas 4h"
              : aba === "novos" ? "Nenhum pedido esperando resposta" : aba === "conversa" ? "Nenhuma conversa em andamento" : aba === "arquivados" ? "Nada arquivado" : "Nada por aqui"}
            description={temFiltro ? "Tente limpar os filtros."
              : aba === "novos" ? "Quando o formulário do site enviar um pedido, ele aparece aqui na hora."
              : aba === "conversa" ? "Ao responder um pedido em Novos, ele vem para cá." : undefined}
            action={temFiltro ? <Button size="sm" onClick={limpar}>Limpar filtros</Button>
              : aba === "novos" && contagem.conversa > 0 ? <Button size="sm" onClick={() => setAba("conversa")}>Ver Em conversa</Button> : undefined}
          />
        )}
        <p className="hidden px-5 py-3 text-xs text-fg-subtle md:block">
          <Kbd>J</Kbd> <Kbd>K</Kbd> navegam · <Kbd>Enter</Kbd> abre · <Kbd>E</Kbd> responde · <Kbd>D</Kbd> descarta · <Kbd>?</Kbd> todos os atalhos
        </p>
      </div>

      <FichaLead
        id={sel}
        resumo={selecionado}
        aberto={aberta}
        onFechar={fechar}
        comando={comando}
        onAtualizar={atualizarDaFicha}
        onDescartar={descartar}
      />
    </div>
  );
}
