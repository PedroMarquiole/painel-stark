"use client";
import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  DndContext, DragOverlay, KeyboardCode, KeyboardSensor, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { ArrowDown, ArrowRight, ArrowUp, ArrowUpRight, CalendarClock, ChevronsRight, Columns3, MailWarning, Rows3, Search } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, Select } from "@/components/ui/dialog";
import { Drawer } from "@/components/ui/drawer";
import { Input, Label } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { InlineField } from "@/components/domain/inline-field";
import { usePainel } from "@/components/painel/contexto";
import { cn, formatBRL, formatProtocolo } from "@/lib/utils";
import { MOTIVOS_PERDA, ROTULO_ETAPA, SERVICOS, type Etapa, type MotivoPerda, type Servico } from "@/lib/rotulos";
import type { EtapaConfig, NegocioCard } from "@/lib/dados/tipos";
import { chamar } from "@/lib/chamar";
import { atualizarNegocio, desfazerMovimento, moverNegocio } from "../acoes";

const DIA = 86_400_000;
const compacto = (v: number) =>
  v >= 1_000_000 ? `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")} mi` : v >= 1000 ? `R$ ${Math.round(v / 1000)} mil` : formatBRL(v);
const fechado = (e: Etapa) => e === "ganho" || e === "perdido";

function diasNaEtapa(n: NegocioCard) {
  return Math.max(0, Math.floor((Date.now() - new Date(n.etapa_desde).getTime()) / DIA));
}
const tempo = (d: number) => (d <= 0 ? "hoje" : d === 1 ? "há 1 dia" : `há ${d} dias`);

/** O que normalmente vem a seguir em cada etapa. Ajuda quem pega o card a saber o que fazer. */
const PROXIMO: Record<Etapa, string> = {
  novo: "Responder o pedido",
  triagem: "Agendar o diagnóstico",
  diagnostico: "Fazer a reunião de diagnóstico",
  descoberta: "Montar e enviar a proposta",
  proposta: "Cobrar retorno da proposta",
  negociacao: "Fechar condições",
  ganho: "Iniciar o projeto",
  perdido: "",
};

type Ordem = "parado" | "valor" | "recentes";
const ORDENS: Record<Ordem, { rotulo: string; f: (a: NegocioCard, b: NegocioCard) => number }> = {
  parado: { rotulo: "Mais tempo na etapa", f: (a, b) => +new Date(a.etapa_desde) - +new Date(b.etapa_desde) },
  valor: { rotulo: "Maior valor", f: (a, b) => (b.valor_estimado ?? 0) - (a.valor_estimado ?? 0) },
  recentes: { rotulo: "Mais recentes", f: (a, b) => +new Date(b.created_at) - +new Date(a.created_at) },
};

function Cartao({ n, limite, arrastando, onAbrir }: { n: NegocioCard; limite: number | null; arrastando?: boolean; onAbrir?: () => void }) {
  const { nomeDe } = usePainel();
  const dias = diasNaEtapa(n);
  const parado = limite != null && dias > limite;
  const resp = nomeDe(n.responsavel_id);
  return (
    <article
      onClick={onAbrir}
      className={cn(
        "group rounded-xl border border-transparent bg-bloco-inset p-3 text-left transition-[border-color,box-shadow,transform] duration-150 ease-out hover:border-border-strong",
        parado && "border-warning/40",
        arrastando && "rotate-[1.5deg] cursor-grabbing shadow-pop",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="num text-xs text-fg-subtle">{n.protocolo ? formatProtocolo(n.protocolo) : "manual"}</span>
        {parado ? <Badge tone="warning"><CalendarClock aria-hidden />parado {dias}d</Badge>
          : !fechado(n.etapa) && <span className="text-xs text-fg-subtle">{tempo(dias)} aqui</span>}
        {n.etapa === "perdido" && n.motivo_perda && <Badge tone="danger">{MOTIVOS_PERDA[n.motivo_perda]}</Badge>}
      </div>
      <h4 className="mt-1.5 line-clamp-2 text-sm font-medium">{n.contato_nome}{n.empresa ? <span className="font-normal text-fg-muted">, {n.empresa}</span> : null}</h4>
      <p className="truncate text-xs text-fg-muted">{n.servicos.map((x) => SERVICOS[x]).join(", ")}</p>
      {!fechado(n.etapa) && (
        n.respondido
          ? <p className="mt-2 flex items-center gap-1.5 text-xs text-fg-muted"><ArrowRight className="size-3 shrink-0 text-fg-subtle" aria-hidden /><span className="truncate">{PROXIMO[n.etapa]}</span></p>
          : <p className="mt-2 flex items-center gap-1.5 text-xs text-danger"><MailWarning className="size-3 shrink-0" aria-hidden />Cliente ainda sem resposta</p>
      )}
      <div className="mt-2.5 flex items-center gap-2">
        {n.valor_estimado ? <span className="num text-sm">{formatBRL(n.valor_estimado)}</span> : <span className="text-xs text-fg-subtle">sem valor</span>}
        {!fechado(n.etapa) && <span className="num text-xs text-fg-subtle">{n.probabilidade}%</span>}
        <span className="flex-1" />
        {resp ? <Avatar name={resp} size={20} /> : <span title="Sem responsável" className="size-5 rounded-full border border-dashed border-border-strong" />}
      </div>
    </article>
  );
}

function Arrastavel({ n, limite, onAbrir, somenteLeitura }: { n: NegocioCard; limite: number | null; onAbrir: () => void; somenteLeitura: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: n.id, disabled: somenteLeitura });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      aria-roledescription="card arrastável"
      aria-label={`${n.titulo}. Enter abre; Espaço pega para arrastar.`}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onAbrir();
          return;
        }
        listeners?.onKeyDown?.(e);
      }}
      className={cn(somenteLeitura ? "cursor-pointer" : "cursor-grab touch-manipulation", "rounded-xl focus-visible:outline-2 focus-visible:outline-accent", isDragging && "opacity-30")}
    >
      <Cartao n={n} limite={limite} onAbrir={onAbrir} />
    </div>
  );
}

function Coluna({ e, itens, onAbrir, somenteLeitura, recolhida, onAlternar }: {
  e: EtapaConfig; itens: NegocioCard[]; onAbrir: (id: string) => void; somenteLeitura: boolean; recolhida?: boolean; onAlternar?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: e.etapa });
  const total = itens.reduce((s, n) => s + (n.valor_estimado ?? 0), 0);
  const ponderado = itens.reduce((s, n) => s + ((n.valor_estimado ?? 0) * n.probabilidade) / 100, 0);
  const ehFechada = fechado(e.etapa);
  const cor = e.etapa === "ganho" ? "bg-success" : e.etapa === "perdido" ? "bg-danger" : "bg-fg-subtle";

  // Ganho/Perdido recolhidos: só contagem e total; continua recebendo cards arrastados
  if (recolhida) {
    return (
      <section ref={setNodeRef} aria-label={`${e.rotulo} (recolhida)`}
        className={cn("flex w-14 shrink-0 flex-col items-center rounded-2xl bg-bloco py-4 shadow-bloco transition-colors", isOver && "bg-accent-soft ring-1 ring-accent/40")}>
        <button onClick={onAlternar} className="flex flex-1 flex-col items-center gap-3 text-fg-muted hover:text-fg" aria-label={`Abrir ${e.rotulo}: ${itens.length} negócios`}>
          <span className={cn("size-2 rounded-full", cor)} aria-hidden />
          <span className="num text-md text-fg">{itens.length}</span>
          <span className="text-sm font-medium [writing-mode:vertical-rl]">{e.rotulo}</span>
          {total > 0 && <span className="num text-xs [writing-mode:vertical-rl]">{compacto(total)}</span>}
        </button>
      </section>
    );
  }
  return (
    <section
      ref={setNodeRef}
      aria-label={e.rotulo}
      className={cn(
        "flex w-[256px] shrink-0 flex-col rounded-2xl bg-bloco shadow-bloco transition-colors duration-150 xl:w-auto xl:min-w-[184px] xl:flex-1 xl:basis-0",
        isOver && "bg-accent-soft ring-1 ring-accent/40",
      )}
    >
      <header className="flex items-baseline gap-2 px-4 pb-1 pt-4">
        <span className={cn("size-2 shrink-0 rounded-full", cor)} aria-hidden />
        <h2 className="min-w-0 truncate font-sans text-sm font-medium" title={e.rotulo}>{e.rotulo}</h2>
        <span className="num text-xs text-fg-subtle">{itens.length}</span>
        <span className="flex-1" />
        {ehFechada && onAlternar && (
          <button onClick={onAlternar} className="text-xs text-fg-subtle hover:text-fg" aria-label={`Recolher ${e.rotulo}`}><ChevronsRight className="size-4" /></button>
        )}
      </header>
      <p className="num px-4 pb-2.5 text-xs text-fg-subtle" title={ehFechada ? "Total" : `Total ${formatBRL(total)}, ponderado pela probabilidade ${formatBRL(ponderado)}`}>
        {total > 0 ? (ehFechada ? compacto(total) : <>{compacto(total)} <span className="font-sans">· previsto</span> {compacto(ponderado)}</>) : " "}
      </p>
      <div className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        {itens.map((n) => <Arrastavel key={n.id} n={n} limite={e.dias_alerta_parado} onAbrir={() => onAbrir(n.id)} somenteLeitura={somenteLeitura} />)}
        {itens.length === 0 && <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-fg-subtle">{somenteLeitura ? "Vazio" : "Arraste um card para cá"}</p>}
      </div>
    </section>
  );
}

type ColunaLista = "negocio" | "etapa" | "valor" | "previsto" | "responsavel" | "dias" | "fechamento";

/** Todos os negócios numa tabela. Clicar no cabeçalho ordena. */
function Lista({ itens, etapas, onAbrir }: { itens: NegocioCard[]; etapas: EtapaConfig[]; onAbrir: (id: string) => void }) {
  const { nomeDe } = usePainel();
  const [ord, setOrd] = React.useState<{ c: ColunaLista; asc: boolean }>({ c: "etapa", asc: true });
  const ordemEtapa = (e: Etapa) => etapas.find((x) => x.etapa === e)?.ordem ?? 0;
  const chave: Record<ColunaLista, (n: NegocioCard) => number | string> = {
    negocio: (n) => n.contato_nome.toLowerCase(),
    etapa: (n) => ordemEtapa(n.etapa) * 1e6 - diasNaEtapa(n),
    valor: (n) => n.valor_estimado ?? -1,
    previsto: (n) => fechado(n.etapa) ? -1 : ((n.valor_estimado ?? 0) * n.probabilidade) / 100,
    responsavel: (n) => (nomeDe(n.responsavel_id) ?? "~").toLowerCase(),
    dias: (n) => diasNaEtapa(n),
    fechamento: (n) => n.previsao_fechamento ?? "9999",
  };
  const linhas = [...itens].sort((a, b) => {
    const x = chave[ord.c](a), y = chave[ord.c](b);
    return (x < y ? -1 : x > y ? 1 : 0) * (ord.asc ? 1 : -1);
  });
  const Cab = ({ c, children, className }: { c: ColunaLista; children: React.ReactNode; className?: string }) => (
    <th className={cn("px-3 py-3 font-normal", className)} aria-sort={ord.c === c ? (ord.asc ? "ascending" : "descending") : "none"}>
      <button onClick={() => setOrd((o) => ({ c, asc: o.c === c ? !o.asc : c === "etapa" || c === "negocio" || c === "responsavel" || c === "fechamento" }))}
        className={cn("inline-flex items-center gap-1 hover:text-fg", ord.c === c && "text-fg")}>
        {children}{ord.c === c && (ord.asc ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </th>
  );
  const fmtDia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });
  return (
    <div className="mx-4 mb-4 min-h-0 overflow-auto rounded-2xl bg-bloco shadow-bloco sm:mx-6 lg:ml-1">
      <table className="w-full min-w-[920px] text-sm">
        <thead className="sticky top-0 z-10 bg-bloco/95 text-left text-xs text-fg-subtle backdrop-blur">
          <tr className="border-b border-border">
            <Cab c="negocio" className="pl-5">Cliente</Cab>
            <Cab c="etapa">Etapa</Cab>
            <Cab c="valor" className="text-right">Valor</Cab>
            <Cab c="previsto" className="text-right">Previsto</Cab>
            <Cab c="responsavel">Responsável</Cab>
            <Cab c="dias">Na etapa</Cab>
            <Cab c="fechamento" className="pr-5">Fechamento</Cab>
          </tr>
        </thead>
        <tbody>
          {linhas.map((n) => {
            const resp = nomeDe(n.responsavel_id);
            return (
              <tr key={n.id} onClick={() => onAbrir(n.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onAbrir(n.id)}
                className="cursor-pointer border-b border-border/70 last:border-0 hover:bg-bloco-inset focus-visible:bg-bloco-inset focus-visible:outline-none">
                <td className="max-w-[320px] py-2.5 pl-5 pr-3">
                  <p className="truncate font-medium">{n.contato_nome}{n.empresa && <span className="font-normal text-fg-muted">, {n.empresa}</span>}</p>
                  <p className="truncate text-xs text-fg-subtle">
                    {n.protocolo ? <span className="num">{formatProtocolo(n.protocolo)} </span> : null}{n.servicos.map((x) => SERVICOS[x]).join(", ")}
                  </p>
                </td>
                <td className="px-3">
                  <Badge tone={n.etapa === "ganho" ? "success" : n.etapa === "perdido" ? "danger" : "neutral"} dot>{ROTULO_ETAPA[n.etapa]}</Badge>
                  {!n.respondido && !fechado(n.etapa) && <span className="ml-1.5 text-xs text-danger">sem resposta</span>}
                </td>
                <td className="num px-3 text-right">{n.valor_estimado ? formatBRL(n.valor_estimado) : <span className="font-sans text-xs text-fg-subtle">sem valor</span>}</td>
                <td className="num px-3 text-right text-fg-muted">{fechado(n.etapa) || !n.valor_estimado ? "—" : formatBRL(((n.valor_estimado ?? 0) * n.probabilidade) / 100)}</td>
                <td className="px-3">{resp ? <span className="flex items-center gap-2"><Avatar name={resp} size={20} /><span className="truncate">{resp}</span></span> : <span className="text-xs text-fg-subtle">ninguém</span>}</td>
                <td className="num px-3 text-fg-muted">{fechado(n.etapa) ? "—" : `${diasNaEtapa(n)}d`}</td>
                <td className="num pr-5 pl-3 text-fg-muted">{n.previsao_fechamento ? fmtDia.format(new Date(n.previsao_fechamento)) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {linhas.length === 0 && <p className="py-10 text-center text-sm text-fg-muted">Nenhum negócio com esses filtros.</p>}
    </div>
  );
}

const lerPref = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const gravarPref = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento: só não lembra */ } };

export function Kanban({ iniciais, etapas }: { iniciais: NegocioCard[]; etapas: EtapaConfig[] }) {
  const { perfil, equipe } = usePainel();
  const [negocios, setNegocios] = React.useState(iniciais);
  const [arrastando, setArrastando] = React.useState<string | null>(null);
  const [perda, setPerda] = React.useState<{ id: string; de: Etapa; ordem: number } | null>(null);
  const [aberto, setAberto] = React.useState<string | null>(null);
  const params = useSearchParams();
  const [busca, setBusca] = React.useState("");
  const [resp, setResp] = React.useState("");       // "" todos · "eu" · "ninguem" · id
  const [servico, setServico] = React.useState("");
  const [ordem, setOrdem] = React.useState<Ordem>("parado");
  const [modoVer, setModoVer] = React.useState<"quadro" | "lista">("quadro");
  const [abertas, setAbertas] = React.useState<Set<Etapa>>(new Set()); // Ganho/Perdido começam recolhidas
  React.useEffect(() => setNegocios(iniciais), [iniciais]);
  React.useEffect(() => {
    const v = lerPref("funil:ver");
    if (v === "lista" || v === "quadro") setModoVer(v);
  }, []);
  const verComo = (v: "quadro" | "lista") => { setModoVer(v); gravarPref("funil:ver", v); };
  // /funil?id=… (vindo da ficha do lead) abre o negócio direto
  const idDaUrl = params.get("id");
  React.useEffect(() => { if (idDaUrl) setAberto(idDaUrl); }, [idDaUrl]);
  const negociosRef = React.useRef(negocios);
  negociosRef.current = negocios;

  const somenteLeitura = perfil.papel === "projetos";
  // Mouse e toque separados: o PointerSensor capturava o toque antes do TouchSensor (arrastar não funcionava no celular)
  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      keyboardCodes: { start: [KeyboardCode.Space], cancel: [KeyboardCode.Esc], end: [KeyboardCode.Space, KeyboardCode.Enter] },
    }),
  );

  const termo = busca.trim().toLowerCase();
  const visiveis = negocios.filter((n) => {
    if (resp === "eu" && n.responsavel_id !== perfil.id) return false;
    if (resp === "ninguem" && n.responsavel_id) return false;
    if (resp && resp !== "eu" && resp !== "ninguem" && n.responsavel_id !== resp) return false;
    if (servico && !n.servicos.includes(servico as Servico)) return false;
    if (termo && !`${n.titulo} ${n.contato_nome} ${n.empresa ?? ""} ${n.protocolo ? formatProtocolo(n.protocolo) : ""}`.toLowerCase().includes(termo)) return false;
    return true;
  });
  const temFiltro = Boolean(termo || resp || servico);
  const porEtapa = (e: Etapa) => visiveis.filter((n) => n.etapa === e).sort(ORDENS[ordem].f);
  const alternar = (e: Etapa) => setAbertas((a) => { const n = new Set(a); if (n.has(e)) n.delete(e); else n.add(e); return n; });

  // Mês e trimestre no fuso de São Paulo (não no fuso de quem abre a página)
  const periodo = (iso: string) => {
    const [a, m] = iso.slice(0, 7).split("-").map(Number);
    return { mes: `${a}-${m}`, tri: `${a}-${Math.ceil(m / 3)}` };
  };
  const hoje = periodo(new Date(Date.now() - 3 * 3_600_000).toISOString());
  const emSp = (iso: string) => periodo(new Date(new Date(iso).getTime() - 3 * 3_600_000).toISOString());
  const abertos = visiveis.filter((n) => n.etapa !== "ganho" && n.etapa !== "perdido");
  const ponderado = (n: NegocioCard) => ((n.valor_estimado ?? 0) * n.probabilidade) / 100;
  const ganhos = visiveis.filter((n) => n.etapa === "ganho" && n.ganho_em);
  const soma = (xs: NegocioCard[], f: (n: NegocioCard) => number) => xs.reduce((s, n) => s + f(n), 0);
  const resumo = {
    aberto: soma(abertos, (n) => n.valor_estimado ?? 0),
    ponderado: soma(abertos, ponderado),
    // Previsão = já ganho no período + ponderado do que tem fechamento previsto no período
    mes: soma(ganhos.filter((n) => emSp(n.ganho_em!).mes === hoje.mes), (n) => n.valor_estimado ?? 0)
       + soma(abertos.filter((n) => n.previsao_fechamento && periodo(n.previsao_fechamento).mes === hoje.mes), ponderado),
    tri: soma(ganhos.filter((n) => emSp(n.ganho_em!).tri === hoje.tri), (n) => n.valor_estimado ?? 0)
       + soma(abertos.filter((n) => n.previsao_fechamento && periodo(n.previsao_fechamento).tri === hoje.tri), ponderado),
  };

  async function aplicar(id: string, para: Etapa, motivo?: MotivoPerda, detalhe?: string) {
    const atual = negocios.find((n) => n.id === id)!;
    const ordem = Math.max(0, ...negocios.filter((n) => n.etapa === para).map((n) => n.ordem)) + 1;
    const prob = etapas.find((e) => e.etapa === para)?.probabilidade_padrao ?? atual.probabilidade;
    const marca = new Date().toISOString();
    setNegocios((xs) => xs.map((n) => (n.id === id ? {
      ...n, etapa: para, ordem, probabilidade: prob, etapa_desde: marca, motivo_perda: motivo ?? null,
      ganho_em: para === "ganho" ? marca : null, perdido_em: para === "perdido" ? marca : null,
    } : n)));
    const r = await chamar(moverNegocio(id, para, ordem, motivo, detalhe));
    if (!r.ok) {
      setNegocios((xs) => xs.map((n) => (n.id === id ? atual : n)));
      toast.error(r.erro);
      return;
    }
    toast(`${atual.titulo.split(" · ").pop()} → ${ROTULO_ETAPA[para]}`, {
      action: {
        label: "Desfazer",
        onClick: async () => {
          const depois = negociosRef.current.find((n) => n.id === id);
          setNegocios((xs) => xs.map((n) => (n.id === id ? atual : n)));
          // restaura etapa, ordem, datas e probabilidade como estavam antes de mover
          const u = await chamar(desfazerMovimento(atual));
          if (!u.ok) {
            if (depois) setNegocios((xs) => xs.map((n) => (n.id === id ? depois : n)));
            toast.error(u.erro);
          }
        },
      },
    });
  }

  function soltar(ev: DragEndEvent) {
    setArrastando(null);
    const id = String(ev.active.id);
    const para = ev.over?.id as Etapa | undefined;
    const n = negocios.find((x) => x.id === id);
    if (!n || !para || para === n.etapa) return;
    if (para === "perdido") return setPerda({ id, de: n.etapa, ordem: n.ordem });
    aplicar(id, para);
  }

  const ativo = negocios.find((n) => n.id === arrastando);
  const selecionado = negocios.find((n) => n.id === aberto) ?? null;

  return (
    <div className="flex h-[calc(100dvh-64px)] flex-col max-lg:h-[calc(100dvh-64px-56px)]">
      <div className="flex flex-col gap-3 px-4 pb-1 pt-2 sm:px-6 lg:pl-1">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Funil</h1>
            <p className="mt-1 text-sm text-fg-muted">
              {somenteLeitura ? "Visualização: quem move os cards é o comercial."
                : modoVer === "quadro" ? "Arraste os cards entre as etapas (Espaço pelo teclado). Toda mudança entra na linha do tempo."
                : "Clique num negócio para abrir. Clique no título da coluna para ordenar."}
            </p>
          </div>
          <Segmented label="Ver como" value={modoVer} onChange={verComo}
            options={[{ value: "quadro", label: <><Columns3 aria-hidden /> Quadro</> }, { value: "lista", label: <><Rows3 aria-hidden /> Lista</> }]} />
        </div>
        <dl className="flex flex-wrap gap-2 text-sm">
          {[
            ["Em aberto", resumo.aberto, "Soma dos negócios ainda não fechados"],
            ["Previsto (ponderado)", resumo.ponderado, "Valor × chance de fechar, somado"],
            ["Previsão do mês", resumo.mes, "Já ganho no mês + previsto com fechamento no mês"],
            ["Previsão do trimestre", resumo.tri, "Já ganho no trimestre + previsto com fechamento no trimestre"],
          ].map(([r, v, dica]) => (
            <div key={r as string} title={dica as string} className="rounded-2xl bg-bloco px-4 py-2.5 shadow-bloco">
              <dt className="text-xs text-fg-muted">{r}</dt>
              <dd className="num text-md font-medium">{formatBRL(v as number)}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-fg-subtle" aria-hidden />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente, empresa ou #protocolo" className="pl-8" aria-label="Buscar no funil" />
          </div>
          <Select value={resp} onChange={(e) => setResp(e.target.value)} aria-label="Responsável">
            <option value="">Todos os responsáveis</option>
            <option value="eu">Só os meus</option>
            <option value="ninguem">Sem responsável</option>
            {equipe.filter((p) => p.papel !== "projetos" && p.id !== perfil.id).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </Select>
          <Select value={servico} onChange={(e) => setServico(e.target.value)} aria-label="Serviço">
            <option value="">Todos os serviços</option>
            {Object.entries(SERVICOS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </Select>
          {modoVer === "quadro" && (
            <Select value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)} aria-label="Ordenar cards">
              {(Object.keys(ORDENS) as Ordem[]).map((o) => <option key={o} value={o}>Ordenar: {ORDENS[o].rotulo.toLowerCase()}</option>)}
            </Select>
          )}
          {temFiltro && <Button variant="ghost" size="sm" onClick={() => { setBusca(""); setResp(""); setServico(""); }}>Limpar</Button>}
          {temFiltro && <span className="text-xs text-fg-subtle">{visiveis.length} de {negocios.length} negócios</span>}
        </div>
      </div>

      {modoVer === "lista" ? (
        <div className="flex min-h-0 flex-1 flex-col pt-3"><Lista itens={visiveis} etapas={etapas} onAbrir={setAberto} /></div>
      ) : (
        <DndContext id="funil" sensors={sensores} onDragStart={(e: DragStartEvent) => setArrastando(String(e.active.id))} onDragEnd={soltar} onDragCancel={() => setArrastando(null)}>
          <div className="flex flex-1 gap-3 overflow-x-auto px-4 pb-4 pt-3 sm:px-6 lg:pl-1">
            {etapas.map((e) => (
              <Coluna key={e.etapa} e={e} itens={porEtapa(e.etapa)} onAbrir={setAberto} somenteLeitura={somenteLeitura}
                recolhida={fechado(e.etapa) && !abertas.has(e.etapa)} onAlternar={fechado(e.etapa) ? () => alternar(e.etapa) : undefined} />
            ))}
          </div>
          <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2,0.8,0.2,1)" }}>
            {ativo ? <div className="w-[240px]"><Cartao n={ativo} limite={null} arrastando /></div> : null}
          </DragOverlay>
        </DndContext>
      )}

      <DialogPerda
        aberto={Boolean(perda)}
        onCancelar={() => setPerda(null)}
        onConfirmar={(motivo, detalhe) => { if (perda) aplicar(perda.id, "perdido", motivo, detalhe); setPerda(null); }}
      />

      <Drawer
        open={Boolean(selecionado)}
        onOpenChange={(o) => { if (!o) { setAberto(null); if (idDaUrl) window.history.replaceState(null, "", "/funil"); } }}
        width={480}
        title={selecionado?.titulo ?? ""}
        subtitle={selecionado && <span>{selecionado.contato_nome}{selecionado.empresa ? ` · ${selecionado.empresa}` : ""}</span>}
        actions={selecionado && <Button size="sm" variant="ghost" asChild><Link href={`/clientes/${selecionado.contato_id}`}>Ficha <ArrowUpRight /></Link></Button>}
      >
        {selecionado && (
          <dl className="grid grid-cols-[120px_1fr] items-center gap-y-2 text-sm">
            <dt className="text-fg-muted">Etapa</dt>
            <dd>
              <Select
                value={selecionado.etapa}
                aria-label="Etapa"
                disabled={somenteLeitura}
                onChange={(e) => {
                  const para = e.target.value as Etapa;
                  if (para === "perdido") setPerda({ id: selecionado.id, de: selecionado.etapa, ordem: selecionado.ordem });
                  else aplicar(selecionado.id, para);
                }}
              >
                {etapas.map((e) => <option key={e.etapa} value={e.etapa}>{e.rotulo}</option>)}
              </Select>
            </dd>
            <dt className="text-fg-muted">Título</dt>
            <dd className="min-w-0">
              <InlineField value={selecionado.titulo} onSave={async (v) => {
                const r = await chamar(atualizarNegocio(selecionado.id, { titulo: v }));
                if (!r.ok) { toast.error(r.erro); throw 0; }
                setNegocios((xs) => xs.map((n) => (n.id === selecionado.id ? { ...n, titulo: v } : n)));
              }} />
            </dd>
            <dt className="text-fg-muted">Valor estimado</dt>
            <dd>
              <InlineField mono placeholder="Informar valor" value={selecionado.valor_estimado ? String(selecionado.valor_estimado) : ""} onSave={async (v) => {
                const valor = v.trim() ? Number(v.replace(/[^\d,]/g, "").replace(",", ".")) : null;
                if (valor !== null && Number.isNaN(valor)) { toast.error("Valor inválido"); throw 0; }
                const r = await chamar(atualizarNegocio(selecionado.id, { valor_estimado: valor }));
                if (!r.ok) { toast.error(r.erro); throw 0; }
                setNegocios((xs) => xs.map((n) => (n.id === selecionado.id ? { ...n, valor_estimado: valor } : n)));
              }} />
            </dd>
            <dt className="text-fg-muted">Probabilidade</dt>
            <dd>
              <InlineField mono value={String(selecionado.probabilidade)} onSave={async (v) => {
                const p = Math.max(0, Math.min(100, Math.round(Number(v))));
                if (Number.isNaN(p)) { toast.error("Use um número de 0 a 100"); throw 0; }
                const r = await chamar(atualizarNegocio(selecionado.id, { probabilidade: p }));
                if (!r.ok) { toast.error(r.erro); throw 0; }
                setNegocios((xs) => xs.map((n) => (n.id === selecionado.id ? { ...n, probabilidade: p } : n)));
              }} />
            </dd>
            <dt className="text-fg-muted">Responsável</dt>
            <dd>
              <Select
                value={selecionado.responsavel_id ?? ""}
                aria-label="Responsável"
                disabled={somenteLeitura}
                onChange={async (e) => {
                  const v = e.target.value || null;
                  const antes = selecionado.responsavel_id;
                  setNegocios((xs) => xs.map((n) => (n.id === selecionado.id ? { ...n, responsavel_id: v } : n)));
                  const r = await chamar(atualizarNegocio(selecionado.id, { responsavel_id: v }));
                  if (!r.ok) {
                    setNegocios((xs) => xs.map((n) => (n.id === selecionado.id ? { ...n, responsavel_id: antes } : n)));
                    toast.error(r.erro);
                  }
                }}
              >
                <option value="">Sem responsável</option>
                {equipe.filter((p) => p.papel !== "projetos").map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </Select>
            </dd>
            <dt className="text-fg-muted">Fechamento previsto</dt>
            <dd>
              <Input
                type="date"
                className="num h-8 w-auto"
                aria-label="Fechamento previsto"
                disabled={somenteLeitura || selecionado.etapa === "ganho" || selecionado.etapa === "perdido"}
                defaultValue={selecionado.previsao_fechamento ?? ""}
                key={selecionado.id}
                onChange={async (e) => {
                  const v = e.target.value || null;
                  const antes = selecionado.previsao_fechamento;
                  setNegocios((xs) => xs.map((n) => (n.id === selecionado.id ? { ...n, previsao_fechamento: v } : n)));
                  const r = await chamar(atualizarNegocio(selecionado.id, { previsao_fechamento: v }));
                  if (!r.ok) {
                    setNegocios((xs) => xs.map((n) => (n.id === selecionado.id ? { ...n, previsao_fechamento: antes } : n)));
                    toast.error(r.erro);
                  }
                }}
              />
            </dd>
            <dt className="text-fg-muted">Serviços</dt>
            <dd className="flex flex-wrap gap-1">{selecionado.servicos.map((s) => <Badge key={s} tone="outline">{SERVICOS[s]}</Badge>)}</dd>
            <dt className="text-fg-muted">Na etapa há</dt>
            <dd className="num">{diasNaEtapa(selecionado)} dias</dd>
            {!fechado(selecionado.etapa) && (<>
              <dt className="text-fg-muted">Próximo passo</dt>
              <dd>{selecionado.respondido ? PROXIMO[selecionado.etapa] : <span className="text-danger">Responder o cliente (ainda sem resposta)</span>}</dd>
            </>)}
            {selecionado.lead_id && (<>
              <dt className="text-fg-muted">Pedido de origem</dt>
              <dd><Link href={`/leads?id=${selecionado.lead_id}`} className="inline-flex items-center gap-1 text-accent hover:underline">
                <span className="num">{selecionado.protocolo ? formatProtocolo(selecionado.protocolo) : "abrir"}</span> na caixa de entrada <ArrowUpRight className="size-3.5" aria-hidden />
              </Link></dd>
            </>)}
          </dl>
        )}
      </Drawer>
    </div>
  );
}

function DialogPerda({ aberto, onCancelar, onConfirmar }: { aberto: boolean; onCancelar: () => void; onConfirmar: (m: MotivoPerda, d: string) => void }) {
  const [motivo, setMotivo] = React.useState<MotivoPerda | null>(null);
  const [detalhe, setDetalhe] = React.useState("");
  React.useEffect(() => { if (aberto) { setMotivo(null); setDetalhe(""); } }, [aberto]);
  return (
    <Dialog
      open={aberto}
      onOpenChange={(o) => !o && onCancelar()}
      title="Por que perdemos?"
      description="O motivo alimenta o relatório de perdas. É obrigatório."
      footer={<>
        <Button variant="ghost" onClick={onCancelar}>Cancelar</Button>
        <Button variant="primary" disabled={!motivo} onClick={() => motivo && onConfirmar(motivo, detalhe)}>Marcar como perdido</Button>
      </>}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Motivo">
          {(Object.keys(MOTIVOS_PERDA) as MotivoPerda[]).map((m) => (
            <button
              key={m}
              role="radio"
              aria-checked={motivo === m}
              onClick={() => setMotivo(m)}
              className={cn("h-8 rounded-full border px-3 text-sm transition-colors", motivo === m ? "border-accent bg-accent-soft" : "border-border text-fg-muted hover:border-border-strong")}
            >
              {MOTIVOS_PERDA[m]}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="perda-detalhe">Detalhe (opcional)</Label>
          <Input id="perda-detalhe" value={detalhe} onChange={(e) => setDetalhe(e.target.value)} placeholder="Ex.: fechou com agência local por R$ 15 mil" />
        </div>
      </div>
    </Dialog>
  );
}
