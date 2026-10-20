"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Mail, MessageCircle, Phone, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Select } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/ui/tooltip";
import { InlineField } from "@/components/domain/inline-field";
import { SlaBadge } from "@/components/domain/sla-badge";
import { LinhaTempo } from "@/components/painel/linha-tempo";
import { usePainel } from "@/components/painel/contexto";
import { formatBRL, formatProtocolo } from "@/lib/utils";
import { chamar } from "@/lib/chamar";
import { MOTIVOS_DESCARTE, ROTULO_ETAPA, SERVICOS, SITUACOES, rotuloOrigem } from "@/lib/rotulos";
import type { Atividade, LeadDetalhe, LeadInbox } from "@/lib/dados/tipos";
import { adicionarNota, atribuirLead, atualizarContato, carregarLead, registrarContato, responderLead } from "../acoes";

const fmtData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="py-1 text-fg-muted">{rotulo}</dt>
      <dd className="min-w-0 py-1">{children}</dd>
    </>
  );
}

export function FichaLead({
  id, resumo, aberto, onFechar, comando, onAtualizar, onDescartar,
}: {
  id: string | null;
  resumo: LeadInbox | null;
  aberto: boolean;
  onFechar: () => void;
  comando: { tipo: "responder" | "descartar"; n: number };
  onAtualizar: (id: string, patch: Partial<LeadInbox>) => void;
  onDescartar: (lead: LeadInbox, motivo: string) => void;
}) {
  const { perfil, equipe, nomeDe } = usePainel();
  const podeAgir = perfil.papel !== "projetos";
  const [lead, setLead] = React.useState<LeadDetalhe | null>(null);
  const [erro, setErro] = React.useState(false);
  const [modo, setModo] = React.useState<"email" | "externo" | "nota" | "descartar" | null>(null);
  const respostaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (!id || !aberto) return;
    let vivo = true;
    setLead(null);
    setErro(false);
    setModo(null);
    carregarLead(id).then((l) => vivo && (l ? setLead(l) : setErro(true))).catch(() => vivo && setErro(true));
    return () => { vivo = false; };
  }, [id, aberto]);

  // E / D (na lista) abrem direto na resposta ou no descarte — cada comando vale uma vez só
  const consumido = React.useRef(0);
  React.useEffect(() => {
    if (!comando.n || !aberto || comando.n === consumido.current) return;
    consumido.current = comando.n;
    const t = setTimeout(() => {
      setModo(comando.tipo === "responder" ? "email" : "descartar");
      if (comando.tipo === "responder") setTimeout(() => respostaRef.current?.focus(), 30);
    }, 80);
    return () => clearTimeout(t);
  }, [comando, aberto]);

  const base = lead ?? resumo;
  const adicionarAtividade = (a: Omit<Atividade, "id" | "ocorreu_em" | "autor_nome">) =>
    setLead((l) => l && { ...l, atividades: [{ ...a, id: crypto.randomUUID(), ocorreu_em: new Date().toISOString(), autor_nome: perfil.nome }, ...l.atividades] });

  async function enviarEmail(form: FormData) {
    if (!base) return;
    const assunto = String(form.get("assunto") ?? "");
    const corpo = String(form.get("corpo") ?? "");
    const r = await chamar(responderLead(base.id, "email", assunto, corpo));
    if (!r.ok) {
      toast.error(r.erro);
      return;
    }
    const agora = new Date().toISOString();
    adicionarAtividade({ tipo: "mensagem", canal: "email", direcao: "saida", automatica: false, titulo: assunto || "E-mail enviado", corpo });
    if (!base.primeira_resposta_em) onAtualizar(base.id, { primeira_resposta_em: agora, status: "em_atendimento" });
    setLead((l) => l && { ...l, primeira_resposta_em: l.primeira_resposta_em ?? agora });
    setModo(null);
    toast.success("E-mail na fila de envio", { description: "Sai em segundos. SLA marcado como respondido." });
  }

  async function registrarExterno(form: FormData) {
    if (!base) return;
    const canal = String(form.get("canal")) as "whatsapp" | "ligacao" | "reuniao";
    const resumoTxt = String(form.get("resumo") ?? "");
    const quandoLocal = String(form.get("quando") ?? "");
    const quando = quandoLocal ? new Date(`${quandoLocal}:00-03:00`).toISOString() : undefined;
    const r = await chamar(registrarContato(base.contato_id, canal, resumoTxt, { leadId: base.id, negocioId: base.negocio_id ?? undefined }, quando));
    if (!r.ok) {
      toast.error(r.erro);
      return;
    }
    const agora = new Date().toISOString();
    const momento = quando ?? new Date().toISOString();
    adicionarAtividade({ tipo: canal === "whatsapp" ? "mensagem" : canal, canal, direcao: "saida", automatica: false, titulo: { whatsapp: "Respondeu pelo WhatsApp", ligacao: "Ligação", reuniao: "Reunião" }[canal], corpo: resumoTxt || null });
    if (!base.primeira_resposta_em && new Date(momento) >= new Date(base.created_at)) onAtualizar(base.id, { primeira_resposta_em: momento, status: "em_atendimento" });
    setLead((l) => l && { ...l, primeira_resposta_em: l.primeira_resposta_em ?? momento });
    setModo(null);
    toast.success("Contato registrado");
  }

  async function salvarNota(form: FormData) {
    if (!base) return;
    const texto = String(form.get("nota") ?? "");
    const r = await chamar(adicionarNota(base.contato_id, texto, { leadId: base.id, negocioId: base.negocio_id ?? undefined }));
    if (!r.ok) {
      toast.error(r.erro);
      return;
    }
    adicionarAtividade({ tipo: "nota", canal: "nota", direcao: "interna", automatica: false, titulo: "Nota", corpo: texto });
    setModo(null);
  }

  const primeiroNome = base?.nome.split(" ")[0] ?? "";
  const agoraLocal = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 16); // datetime-local em São Paulo (UTC−3)
  const textoPadrao = `Olá, ${primeiroNome}!\n\nObrigado por contar o que está acontecendo. Pelo que você descreveu, dá para resolver isso de um jeito bem mais simples.\n\nPodemos marcar uma conversa de 30 minutos esta semana para entender os detalhes? Me diga dois horários que funcionam para você.\n\n${perfil.nome}\nStark — Software sob medida`;

  return (
    <Drawer
      open={aberto}
      onOpenChange={(o) => !o && onFechar()}
      width={620}
      title={base ? base.nome : "Carregando…"}
      subtitle={base && (
        <span className="num">
          {formatProtocolo(base.protocolo)}<span className="font-sans"> · {base.empresa ?? "Sem empresa"} · chegou via {rotuloOrigem(base.origem)} · {fmtData.format(new Date(base.created_at))}</span>
        </span>
      )}
      actions={base && podeAgir && (
        <Button variant="primary" size="sm" onClick={() => { setModo("email"); setTimeout(() => respostaRef.current?.focus(), 30); }}>
          <Send /> Responder
        </Button>
      )}
    >
      {erro && <p className="text-sm text-danger">Não foi possível carregar este pedido. Feche e abra de novo.</p>}
      {base && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-2">
            <SlaBadge deadline={new Date(base.sla_vence_em)} respondedAt={base.primeira_resposta_em ? new Date(base.primeira_resposta_em) : null} />
            {base.status === "descartado" && <Badge tone="danger" dot>Descartado{lead?.motivo_descarte ? ` · ${lead.motivo_descarte}` : ""}</Badge>}
            {base.servicos.map((s) => <Badge key={s} tone="outline">{SERVICOS[s]}</Badge>)}
          </div>

          {/* Ações */}
          {modo === "email" && (
            <form action={enviarEmail} className="flex flex-col gap-2 rounded-lg border border-accent/40 bg-surface p-3"
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") (e.currentTarget as HTMLFormElement).requestSubmit(); }}>
              <div className="flex items-center gap-2 text-xs text-fg-muted">
                <Mail className="size-3.5" aria-hidden /> Para <span className="text-fg">{lead?.contato.email ?? base.email}</span>
              </div>
              {lead?.contato.opt_out_email && (
                <p className="rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
                  Este cliente pediu para não receber e-mail. Se falou com ele por outro canal, use “Registrar contato”.
                </p>
              )}
              <Input name="assunto" defaultValue={`Seu pedido ${formatProtocolo(base.protocolo)} · Stark`} aria-label="Assunto" />
              <Textarea ref={respostaRef} name="corpo" defaultValue={textoPadrao} className="min-h-44" aria-label="Mensagem" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-fg-subtle">⌘ Enter envia</span>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setModo(null)}>Cancelar</Button>
                  <Button type="submit" variant="primary" size="sm" disabled={lead?.contato.opt_out_email}><Send /> Enviar e-mail</Button>
                </div>
              </div>
            </form>
          )}
          {modo === "externo" && (
            <form action={registrarExterno} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
              <p className="text-xs text-fg-muted">Respondeu por fora do painel? Registre aqui. Conta como resposta e fecha o SLA.</p>
              <Select name="canal" defaultValue="whatsapp" aria-label="Canal">
                <option value="whatsapp">WhatsApp (pelo celular)</option>
                <option value="ligacao">Ligação</option>
                <option value="reuniao">Reunião</option>
              </Select>
              <label className="flex items-center gap-2 text-xs text-fg-muted">
                Quando foi
                <Input type="datetime-local" name="quando" defaultValue={agoraLocal} max={agoraLocal} className="num h-7 w-auto" aria-label="Quando o contato aconteceu" />
              </label>
              <Textarea name="resumo" placeholder="Resumo do que foi conversado (opcional)" className="min-h-20" />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setModo(null)}>Cancelar</Button>
                <Button type="submit" size="sm">Registrar</Button>
              </div>
            </form>
          )}
          {modo === "nota" && (
            <form action={salvarNota} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
              <Textarea name="nota" autoFocus placeholder="Nota interna (o cliente não vê)" className="min-h-20" />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setModo(null)}>Cancelar</Button>
                <Button type="submit" size="sm">Salvar nota</Button>
              </div>
            </form>
          )}
          {modo === "descartar" && (
            <div className="flex flex-col gap-2 rounded-lg border border-danger/40 bg-surface p-3">
              <p className="text-sm">Por que descartar este pedido?</p>
              <div className="flex flex-wrap gap-1.5">
                {MOTIVOS_DESCARTE.map((m) => (
                  <Button key={m} size="sm" onClick={() => { if (resumo) onDescartar(resumo, m); setModo(null); }}>{m}</Button>
                ))}
              </div>
            </div>
          )}
          {!modo && !podeAgir && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-fg-subtle">Seu papel (Projetos/Dev) vê os pedidos; quem responde é o comercial.</span>
              <Button size="sm" onClick={() => setModo("nota")}>Nota</Button>
              <Button size="sm" variant="ghost" asChild><Link href={`/clientes/${base.contato_id}`}>Ficha do cliente <ArrowUpRight /></Link></Button>
            </div>
          )}
          {!modo && podeAgir && (
            <div className="flex flex-wrap gap-2">
              <Tooltip content="WhatsApp ainda não está integrado. Responda pelo celular e registre aqui.">
                <Button size="sm" onClick={() => setModo("externo")}><MessageCircle /> Registrar contato</Button>
              </Tooltip>
              <Button size="sm" onClick={() => setModo("nota")}>Nota</Button>
              {base.status !== "descartado" && <Button size="sm" variant="danger" onClick={() => setModo("descartar")}><Trash2 /> Descartar</Button>}
              <Button size="sm" variant="ghost" asChild><Link href={`/clientes/${base.contato_id}`}>Ficha do cliente <ArrowUpRight /></Link></Button>
            </div>
          )}

          <section>
            <h3 className="mb-1.5 text-xs font-medium text-fg-subtle">O que está custando mais tempo ou dinheiro</h3>
            <p className="whitespace-pre-wrap text-sm leading-6">{base.dor}</p>
          </section>

          <dl className="grid grid-cols-[132px_1fr] items-center text-sm">
            <Campo rotulo="Responsável">
              <Select
                value={base.responsavel_id ?? ""}
                aria-label="Responsável"
                disabled={!podeAgir}
                onChange={async (e) => {
                  const novo = e.target.value || null;
                  const antes = base.responsavel_id;
                  onAtualizar(base.id, { responsavel_id: novo });
                  setLead((l) => l && { ...l, responsavel_id: novo });
                  const r = await chamar(atribuirLead(base.id, base.negocio_id, novo));
                  if (!r.ok) {
                    onAtualizar(base.id, { responsavel_id: antes });
                    setLead((l) => l && { ...l, responsavel_id: antes });
                    toast.error(r.erro);
                  } else toast.success(novo ? `Atribuído a ${nomeDe(novo)}` : "Sem responsável");
                }}
              >
                <option value="">Sem responsável</option>
                {equipe.filter((p) => p.papel !== "projetos").map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </Select>
            </Campo>
            <Campo rotulo="Hoje resolve">{base.situacao_atual ? SITUACOES[base.situacao_atual] : "—"}</Campo>
            {lead && (
              <>
                <Campo rotulo="Nome"><InlineField value={lead.contato.nome} onSave={async (v) => { const r = await chamar(atualizarContato(lead.contato.id, { nome: v })); if (!r.ok) { toast.error(r.erro); throw 0; } onAtualizar(base.id, { nome: v }); }} /></Campo>
                <Campo rotulo="E-mail"><InlineField value={lead.contato.email ?? ""} onSave={async (v) => { const r = await chamar(atualizarContato(lead.contato.id, { email: v })); if (!r.ok) { toast.error(r.erro); throw 0; } }} /></Campo>
                <Campo rotulo="WhatsApp">
                  <span className="flex items-center gap-1">
                    <InlineField mono value={lead.contato.whatsapp ?? ""} onSave={async (v) => { const r = await chamar(atualizarContato(lead.contato.id, { whatsapp: v })); if (!r.ok) { toast.error(r.erro); throw 0; } }} />
                    {lead.contato.whatsapp && (
                      <Button variant="ghost" size="icon-sm" asChild aria-label="Abrir conversa no WhatsApp">
                        <a href={`https://wa.me/${lead.contato.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá, ${primeiroNome}! Aqui é ${perfil.nome.split(" ")[0]}, da Stark.`)}`} target="_blank" rel="noreferrer"><Phone /></a>
                      </Button>
                    )}
                  </span>
                </Campo>
                {lead.prazo && <Campo rotulo="Prazo">{lead.prazo}</Campo>}
                {lead.investimento && <Campo rotulo="Investimento">{lead.investimento}</Campo>}
                {lead.porte && <Campo rotulo="Porte">{lead.porte}</Campo>}
                {Object.entries(lead.respostas_extras).map(([k, v]) => <Campo key={k} rotulo={k.replace(/_/g, " ")}>{v}</Campo>)}
                {lead.simulador && (
                  <Campo rotulo="Simulador">
                    <span className="num text-xs">{Object.entries(lead.simulador).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join(" · ")}</span>
                  </Campo>
                )}
                {(lead.utm.medium || lead.utm.campaign) && <Campo rotulo="Campanha"><span className="num text-xs">{[lead.utm.source, lead.utm.medium, lead.utm.campaign].filter(Boolean).join(" / ")}</span></Campo>}
                {lead.negocio && (
                  <Campo rotulo="Negócio">
                    <Link href="/funil" className="hover:underline">{ROTULO_ETAPA[lead.negocio.etapa]}{lead.negocio.valor_estimado ? <span className="num"> · {formatBRL(lead.negocio.valor_estimado)}</span> : ""}</Link>
                  </Campo>
                )}
                <Campo rotulo="LGPD">{lead.consentimento_lgpd_em ? <span className="text-xs text-fg-muted">Aceite em {fmtData.format(new Date(lead.consentimento_lgpd_em))}</span> : <span className="text-xs text-fg-subtle">Sem registro (criado manualmente)</span>}</Campo>
              </>
            )}
          </dl>

          {lead && lead.outros_pedidos.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-medium text-fg-subtle">Outros pedidos deste cliente</h3>
              <ul className="flex flex-col gap-1.5">
                {lead.outros_pedidos.map((o) => (
                  <li key={o.id} className="flex gap-2 text-sm">
                    <span className="num text-xs text-fg-subtle">{formatProtocolo(o.protocolo)}</span>
                    <span className="truncate text-fg-muted">{o.dor}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="mb-3 text-xs font-medium text-fg-subtle">Linha do tempo</h3>
            {lead ? <LinhaTempo atividades={lead.atividades} /> : <div className="flex flex-col gap-3"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-3/5" /></div>}
          </section>
        </div>
      )}
    </Drawer>
  );
}
