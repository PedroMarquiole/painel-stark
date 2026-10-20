"use client";
import * as React from "react";
import Link from "next/link";
import * as Switch from "@radix-ui/react-switch";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { InlineField } from "@/components/domain/inline-field";
import { SlaBadge } from "@/components/domain/sla-badge";
import { LinhaTempo } from "@/components/painel/linha-tempo";
import { usePainel } from "@/components/painel/contexto";
import { formatBRL, formatProtocolo } from "@/lib/utils";
import { MOTIVOS_PERDA, ROTULO_ETAPA, SERVICOS } from "@/lib/rotulos";
import type { Ficha } from "@/lib/dados/consultas";
import type { Atividade } from "@/lib/dados/tipos";
import { chamar } from "@/lib/chamar";
import { adicionarNota, atualizarContato } from "../../acoes";

const fmtDia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });

function Alternar({ rotulo, valor, onChange }: { rotulo: string; valor: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-fg-muted">{rotulo}</span>
      <Switch.Root checked={valor} onCheckedChange={onChange} className="relative inline-flex h-5 w-9 items-center rounded-full border border-border-strong bg-overlay data-[state=checked]:border-danger data-[state=checked]:bg-danger/70">
        <Switch.Thumb className="block size-3.5 translate-x-0.5 rounded-full bg-fg transition-transform duration-150 data-[state=checked]:translate-x-[18px]" />
      </Switch.Root>
    </label>
  );
}

/** Ficha 360°: tudo do cliente numa página — pedidos, negócios, linha do tempo e LTV. */
export function Ficha360({ ficha }: { ficha: Ficha }) {
  const { perfil, nomeDe } = usePainel();
  const c = ficha.contato;
  const [atividades, setAtividades] = React.useState<Atividade[]>(ficha.atividades);
  const [optEmail, setOptEmail] = React.useState(c.opt_out_email);
  const [optWhats, setOptWhats] = React.useState(c.opt_out_whatsapp);
  const [nota, setNota] = React.useState("");

  const salvar = (campo: "nome" | "email" | "whatsapp" | "cargo") => async (v: string) => {
    const r = await chamar(atualizarContato(c.id, { [campo]: v }));
    if (!r.ok) { toast.error(r.erro); throw 0; }
  };

  async function enviarNota() {
    const texto = nota.trim();
    if (!texto) return;
    const id = crypto.randomUUID();
    setNota("");
    setAtividades((xs) => [{ id, tipo: "nota", canal: "nota", direcao: "interna", automatica: false, titulo: "Nota", corpo: texto, ocorreu_em: new Date().toISOString(), autor_nome: perfil.nome }, ...xs]);
    const r = await chamar(adicionarNota(c.id, texto, { leadId: ficha.pedidos[0]?.id, negocioId: ficha.negocios[0]?.id }));
    if (!r.ok) {
      setAtividades((xs) => xs.filter((a) => a.id !== id));
      setNota(texto);
      toast.error(r.erro);
    }
  }

  return (
    <div className="mx-auto grid max-w-[1200px] gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[340px_1fr]">
      <aside className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold">{c.nome}</h1>
          <p className="text-sm text-fg-muted">{c.empresa ?? "Sem empresa"} · cliente desde {fmtDia.format(new Date(c.created_at))}</p>
        </div>
        <Card className="p-card">
          <dl className="grid grid-cols-[96px_1fr] items-center gap-y-1 text-sm">
            <dt className="text-fg-muted">Nome</dt><dd className="min-w-0"><InlineField value={c.nome} onSave={salvar("nome")} /></dd>
            <dt className="text-fg-muted">E-mail</dt><dd className="min-w-0"><InlineField value={c.email ?? ""} onSave={salvar("email")} /></dd>
            <dt className="text-fg-muted">WhatsApp</dt><dd className="min-w-0"><InlineField mono value={c.whatsapp ?? ""} onSave={salvar("whatsapp")} /></dd>
            <dt className="text-fg-muted">Cargo</dt><dd className="min-w-0"><InlineField value={c.cargo ?? ""} onSave={salvar("cargo")} /></dd>
            <dt className="text-fg-muted">Responsável</dt><dd className="py-1">{nomeDe(c.responsavel_id) ?? "—"}</dd>
          </dl>
        </Card>
        <Card className="grid grid-cols-2 gap-px overflow-hidden bg-border">
          {[
            ["Valor gerado (LTV)", formatBRL(ficha.ltv)],
            ["Pedidos", String(ficha.pedidos.length)],
            ["Negócios", String(ficha.negocios.length)],
            ["Ganhos", String(ficha.negocios.filter((n) => n.etapa === "ganho").length)],
          ].map(([r, v]) => (
            <div key={r} className="bg-raised p-card">
              <p className="text-xs text-fg-muted">{r}</p>
              <p className="num text-md">{v}</p>
            </div>
          ))}
        </Card>
        <Card className="flex flex-col gap-3 p-card">
          <p className="text-xs font-medium text-fg-subtle">Preferências de contato (LGPD)</p>
          <Alternar rotulo="Não quer receber e-mail" valor={optEmail} onChange={async (v) => { setOptEmail(v); const r = await chamar(atualizarContato(c.id, { opt_out_email: v })); if (!r.ok) { setOptEmail(!v); toast.error(r.erro); } }} />
          <Alternar rotulo="Não quer receber WhatsApp" valor={optWhats} onChange={async (v) => { setOptWhats(v); const r = await chamar(atualizarContato(c.id, { opt_out_whatsapp: v })); if (!r.ok) { setOptWhats(!v); toast.error(r.erro); } }} />
          <p className="text-xs text-fg-subtle">Automações respeitam isso; mensagens bloqueadas ficam registradas.</p>
        </Card>
      </aside>

      <div className="flex min-w-0 flex-col gap-6">
        <section>
          <h2 className="mb-2 text-md font-semibold">Negócios</h2>
          <Card>
            {ficha.negocios.length === 0 && <p className="p-card text-sm text-fg-muted">Nenhum negócio.</p>}
            {ficha.negocios.map((n) => (
              <Link key={n.id} href="/funil" className="flex items-center gap-3 border-b border-border px-card py-3 text-sm last:border-0 hover:bg-overlay/50">
                <span className="flex-1 truncate font-medium">{n.titulo}</span>
                <Badge tone={n.etapa === "ganho" ? "success" : n.etapa === "perdido" ? "danger" : "neutral"} dot>
                  {ROTULO_ETAPA[n.etapa]}{n.etapa === "perdido" && n.motivo_perda ? ` · ${MOTIVOS_PERDA[n.motivo_perda]}` : ""}
                </Badge>
                <span className="num w-28 text-right">{n.valor_estimado ? formatBRL(n.valor_estimado) : "—"}</span>
              </Link>
            ))}
          </Card>
        </section>

        <section>
          <h2 className="mb-2 text-md font-semibold">Pedidos pelo site</h2>
          <Card>
            {ficha.pedidos.map((l) => (
              <Link key={l.id} href={`/leads?id=${l.id}`} className="flex flex-col gap-1.5 border-b border-border px-card py-3 text-sm last:border-0 hover:bg-overlay/50">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="num text-xs text-fg-subtle">{formatProtocolo(l.protocolo)}</span>
                  <span className="text-xs text-fg-muted">{fmtDia.format(new Date(l.created_at))}</span>
                  {l.servicos.map((s) => <Badge key={s} tone="outline">{SERVICOS[s]}</Badge>)}
                  <span className="flex-1" />
                  <SlaBadge deadline={new Date(l.sla_vence_em)} respondedAt={l.primeira_resposta_em ? new Date(l.primeira_resposta_em) : null} />
                </span>
                <span className="text-fg-muted">{l.dor}</span>
              </Link>
            ))}
          </Card>
        </section>

        <section>
          <h2 className="mb-3 text-md font-semibold">Linha do tempo</h2>
          <div className="mb-5 flex flex-col gap-2">
            <Textarea value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Escreva uma nota interna…" className="min-h-16"
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") enviarNota(); }} />
            <div className="flex justify-end"><Button size="sm" onClick={enviarNota} disabled={!nota.trim()}>Adicionar nota</Button></div>
          </div>
          <LinhaTempo atividades={atividades} />
        </section>
      </div>
    </div>
  );
}
