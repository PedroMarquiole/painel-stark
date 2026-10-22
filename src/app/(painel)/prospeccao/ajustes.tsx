"use client";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { usePainel } from "@/components/painel/contexto";
import { chamar } from "@/lib/chamar";
import { cn } from "@/lib/utils";
import { CANAIS_PROSPECT, type CanalProspect } from "@/lib/rotulos";
import type { ConfigProspeccao, ModeloProspeccao } from "@/lib/dados/tipos";
import { salvarConfig, salvarModelo } from "./acoes";

const CANAIS_MODELO: CanalProspect[] = ["linkedin", "whatsapp", "email", "instagram"];

/** Modelos de mensagem por canal e contato, e o ritmo combinado (dias úteis entre contatos). */
export function Ajustes({ aberto, setAberto, modelos, config, onModelo, onConfig }: {
  aberto: boolean; setAberto: (o: boolean) => void; modelos: ModeloProspeccao[]; config: ConfigProspeccao;
  onModelo: (m: ModeloProspeccao) => void; onConfig: (c: ConfigProspeccao) => void;
}) {
  const { perfil } = usePainel();
  const admin = perfil.papel === "admin";
  const [canal, setCanal] = React.useState<CanalProspect>("linkedin");
  const [toque, setToque] = React.useState<1 | 2 | 3>(1);
  const modelo = modelos.find((m) => m.canal === canal && m.toque === toque);
  const atual = modelo?.texto ?? "";
  const assuntoAtual = modelo?.assunto ?? "";
  const [texto, setTexto] = React.useState(atual);
  const [assunto, setAssunto] = React.useState(assuntoAtual);
  const [ritmo, setRitmo] = React.useState(config.ritmo.join(", "));
  const [meta, setMeta] = React.useState(config.meta_semana ? String(config.meta_semana) : "");
  const [salvando, setSalvando] = React.useState(false);
  React.useEffect(() => setTexto(atual), [atual, aberto]);
  React.useEffect(() => setAssunto(assuntoAtual), [assuntoAtual, aberto]);
  React.useEffect(() => { if (aberto) { setRitmo(config.ritmo.join(", ")); setMeta(config.meta_semana ? String(config.meta_semana) : ""); } }, [aberto, config]);

  async function gravarModelo() {
    if (salvando) return;
    setSalvando(true);
    const r = await chamar(salvarModelo(canal, toque, texto, assunto));
    setSalvando(false);
    if (!r.ok) return void toast.error(r.erro);
    onModelo({ canal, toque, texto, assunto: canal === "email" ? assunto.trim() || null : null });
    toast.success(`Modelo do ${toque}º contato por ${CANAIS_PROSPECT[canal]} salvo`);
  }

  async function gravarRitmo() {
    if (salvando) return;
    const r1 = ritmo.split(/[^\d]+/).map(Number).filter((n) => n >= 1 && n <= 30).slice(0, 5);
    if (!r1.length) return void toast.error("Informe os dias entre contatos, ex.: 3, 4");
    const m = Number(meta) > 0 ? Math.round(Number(meta)) : null;
    setSalvando(true);
    const r = await chamar(salvarConfig(r1, m));
    setSalvando(false);
    if (!r.ok) return void toast.error(r.erro);
    onConfig({ ritmo: r1, meta_semana: m });
    toast.success("Ritmo salvo. Vale para os próximos contatos registrados.");
  }

  const exemplo = ritmo.split(/[^\d]+/).map(Number).filter((n) => n >= 1 && n <= 30).slice(0, 5);

  return (
    <Dialog open={aberto} onOpenChange={setAberto} title="Ajustes da prospecção" description="Mensagens prontas e o ritmo de contatos que vocês combinaram." className="max-w-2xl">
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <h3 className="text-md font-medium">Mensagens prontas</h3>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Canal">
            {CANAIS_MODELO.map((c) => (
              <button key={c} type="button" aria-pressed={canal === c} onClick={() => setCanal(c)}
                className={cn("h-8 rounded-full border px-3 text-xs transition-colors", canal === c ? "border-transparent bg-accent-soft text-fg" : "border-border text-fg-muted hover:border-border-strong")}>
                {CANAIS_PROSPECT[c]}
              </button>
            ))}
            <span className="mx-1 h-5 w-px bg-border" aria-hidden />
            {([1, 2, 3] as const).map((n) => (
              <button key={n} type="button" aria-pressed={toque === n} onClick={() => setToque(n)}
                className={cn("h-8 rounded-full border px-3 text-xs transition-colors", toque === n ? "border-transparent bg-accent-soft text-fg" : "border-border text-fg-muted hover:border-border-strong")}>
                {n}º contato
              </button>
            ))}
          </div>
          {canal === "email" && (
            <Input aria-label="Assunto do e-mail" value={assunto} onChange={(e) => setAssunto(e.target.value)} disabled={perfil.papel === "projetos"} placeholder="Assunto, ex.: {{empresa}}: uma pergunta rápida" />
          )}
          <Textarea aria-label="Texto do modelo" className="min-h-36" value={texto} onChange={(e) => setTexto(e.target.value)} disabled={perfil.papel === "projetos"}
            placeholder="Oi, {{pessoa}}! Aqui é {{seu_nome}}, da Stark…" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-fg-subtle">
              {"{{pessoa}}"}, {"{{empresa}}"}, {"{{seu_nome}}"} e, pelo ramo da empresa (campo Segmento ou o nome), {"{{nicho}}"} (ex.: clínicas),
              {"{{dor}}"} (o problema típico do ramo), {"{{ganho}}"} (o que o sistema resolve) e {"{{na_cidade}}"} (“ em Campinas”).
            </p>
            {perfil.papel !== "projetos" && <Button variant="primary" size="sm" onClick={gravarModelo} disabled={salvando || (texto === atual && assunto === assuntoAtual)}>Salvar modelo</Button>}
          </div>
        </section>

        <section className="flex flex-col gap-3 border-t border-border pt-5">
          <h3 className="text-md font-medium">Ritmo combinado</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="aj-ritmo">Dias úteis entre os contatos</Label>
              <Input id="aj-ritmo" className="num" value={ritmo} onChange={(e) => setRitmo(e.target.value)} disabled={!admin} placeholder="3, 4" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="aj-meta">Meta de contatos por semana</Label>
              <Input id="aj-meta" type="number" min={0} className="num" value={meta} onChange={(e) => setMeta(e.target.value)} disabled={!admin} placeholder="Sem meta" />
            </div>
          </div>
          {exemplo.length > 0 && (
            <p className="text-xs text-fg-muted">
              1º contato{exemplo.map((d, i) => ` → ${d} dias úteis → ${i + 2}º contato`).join("")}. Sem resposta no {exemplo.length + 1}º, vai para Encerrados.
            </p>
          )}
          {admin ? (
            <div className="flex justify-end"><Button variant="primary" size="sm" onClick={gravarRitmo} disabled={salvando}>Salvar ritmo</Button></div>
          ) : <p className="text-xs text-fg-subtle">Só o admin muda o ritmo e a meta.</p>}
        </section>
      </div>
    </Dialog>
  );
}
