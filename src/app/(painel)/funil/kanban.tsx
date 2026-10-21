"use client";
import * as React from "react";
import Link from "next/link";
import {
  DndContext, DragOverlay, KeyboardCode, KeyboardSensor, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { ArrowUpRight, CalendarClock } from "lucide-react";
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
import { MOTIVOS_PERDA, ROTULO_ETAPA, SERVICOS, type Etapa, type MotivoPerda } from "@/lib/rotulos";
import type { EtapaConfig, NegocioCard } from "@/lib/dados/tipos";
import { chamar } from "@/lib/chamar";
import { atualizarNegocio, desfazerMovimento, moverNegocio } from "../acoes";

const DIA = 86_400_000;
const compacto = (v: number) =>
  v >= 1_000_000 ? `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")} mi` : v >= 1000 ? `R$ ${Math.round(v / 1000)} mil` : formatBRL(v);

function diasNaEtapa(n: NegocioCard) {
  return Math.floor((Date.now() - new Date(n.etapa_desde).getTime()) / DIA);
}

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
        {parado && <Badge tone="warning"><CalendarClock aria-hidden />parado {dias}d</Badge>}
        {n.etapa === "perdido" && n.motivo_perda && <Badge tone="danger">{MOTIVOS_PERDA[n.motivo_perda]}</Badge>}
      </div>
      <h4 className="mt-1.5 line-clamp-2 text-sm font-medium">{n.titulo}</h4>
      <p className="truncate text-xs text-fg-muted">{n.contato_nome}{n.empresa && n.titulo.indexOf(n.empresa) === -1 ? ` · ${n.empresa}` : ""}</p>
      <div className="mt-3 flex items-center gap-2">
        {n.valor_estimado ? <span className="num text-sm">{formatBRL(n.valor_estimado)}</span> : <span className="text-xs text-fg-subtle">sem valor</span>}
        {n.etapa !== "ganho" && n.etapa !== "perdido" && <span className="num text-xs text-fg-subtle">· {n.probabilidade}%</span>}
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

function Coluna({ e, itens, onAbrir, somenteLeitura }: { e: EtapaConfig; itens: NegocioCard[]; onAbrir: (id: string) => void; somenteLeitura: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: e.etapa });
  const total = itens.reduce((s, n) => s + (n.valor_estimado ?? 0), 0);
  const ponderado = itens.reduce((s, n) => s + ((n.valor_estimado ?? 0) * n.probabilidade) / 100, 0);
  const fechada = e.etapa === "ganho" || e.etapa === "perdido";
  return (
    <section
      ref={setNodeRef}
      aria-label={e.rotulo}
      className={cn(
        "flex w-[272px] shrink-0 flex-col rounded-2xl bg-bloco shadow-bloco transition-colors duration-150",
        isOver && "bg-accent-soft ring-1 ring-accent/40",
      )}
    >
      <header className="flex items-baseline gap-2 px-4 pb-2.5 pt-4">
        <span className={cn("size-2 shrink-0 rounded-full", e.etapa === "ganho" ? "bg-success" : e.etapa === "perdido" ? "bg-danger" : "bg-fg-subtle")} aria-hidden />
        <h2 className="min-w-0 truncate font-sans text-sm font-medium" title={e.rotulo}>{e.rotulo}</h2>
        <span className="num text-xs text-fg-subtle">{itens.length}</span>
        <span className="flex-1" />
        {total > 0 && (
          <span className="num shrink-0 whitespace-nowrap text-xs text-fg-muted" title={fechada ? "Total" : `Total ${formatBRL(total)} · ponderado ${formatBRL(ponderado)}`}>
            {compacto(fechada ? total : ponderado)}
          </span>
        )}
      </header>
      <div className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        {itens.map((n) => <Arrastavel key={n.id} n={n} limite={e.dias_alerta_parado} onAbrir={() => onAbrir(n.id)} somenteLeitura={somenteLeitura} />)}
        {itens.length === 0 && <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-fg-subtle">{somenteLeitura ? "Vazio" : "Arraste um card para cá"}</p>}
      </div>
    </section>
  );
}

export function Kanban({ iniciais, etapas }: { iniciais: NegocioCard[]; etapas: EtapaConfig[] }) {
  const { perfil, equipe } = usePainel();
  const [negocios, setNegocios] = React.useState(iniciais);
  const [arrastando, setArrastando] = React.useState<string | null>(null);
  const [perda, setPerda] = React.useState<{ id: string; de: Etapa; ordem: number } | null>(null);
  const [aberto, setAberto] = React.useState<string | null>(null);
  const [escopo, setEscopo] = React.useState<"todos" | "meus">("todos");
  React.useEffect(() => setNegocios(iniciais), [iniciais]);
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

  const visiveis = negocios.filter((n) => escopo === "todos" || n.responsavel_id === perfil.id);
  const porEtapa = (e: Etapa) => visiveis.filter((n) => n.etapa === e).sort((a, b) => a.ordem - b.ordem);

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
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 px-4 pb-1 pt-2 sm:px-6 lg:pl-1">
        <div>
          <h1 className="text-xl font-semibold">Funil</h1>
          <p className="text-sm text-fg-muted">
            {somenteLeitura ? "Visualização: quem move os cards é o comercial." : "Arraste os cards entre as etapas (Espaço pelo teclado). Toda mudança entra na linha do tempo."}
          </p>
        </div>
        <dl className="flex flex-wrap gap-2 text-sm">
          {[
            ["Pipeline aberto", resumo.aberto],
            ["Ponderado (previsão)", resumo.ponderado],
            ["Previsão do mês", resumo.mes],
            ["Previsão do trimestre", resumo.tri],
          ].map(([r, v]) => (
            <div key={r as string} className="rounded-2xl bg-bloco px-4 py-2.5 shadow-bloco">
              <dt className="text-xs text-fg-muted">{r}</dt>
              <dd className="num text-md font-medium">{formatBRL(v as number)}</dd>
            </div>
          ))}
        </dl>
        <span className="flex-1" />
        <Segmented label="Escopo" value={escopo} onChange={setEscopo} options={[{ value: "todos", label: "Todos" }, { value: "meus", label: "Meus" }]} />
      </div>

      <DndContext id="funil" sensors={sensores} onDragStart={(e: DragStartEvent) => setArrastando(String(e.active.id))} onDragEnd={soltar} onDragCancel={() => setArrastando(null)}>
        <div className="flex flex-1 gap-4 overflow-x-auto px-4 pb-4 pt-4 sm:px-6 lg:pl-1">
          {etapas.map((e) => <Coluna key={e.etapa} e={e} itens={porEtapa(e.etapa)} onAbrir={setAberto} somenteLeitura={somenteLeitura} />)}
        </div>
        <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2,0.8,0.2,1)" }}>
          {ativo ? <div className="w-[256px]"><Cartao n={ativo} limite={null} arrastando /></div> : null}
        </DragOverlay>
      </DndContext>

      <DialogPerda
        aberto={Boolean(perda)}
        onCancelar={() => setPerda(null)}
        onConfirmar={(motivo, detalhe) => { if (perda) aplicar(perda.id, "perdido", motivo, detalhe); setPerda(null); }}
      />

      <Drawer
        open={Boolean(selecionado)}
        onOpenChange={(o) => !o && setAberto(null)}
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
