"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Ban, Check, Copy, Handshake, RotateCcw, ThumbsDown } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Select } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineField } from "@/components/domain/inline-field";
import { usePainel } from "@/components/painel/contexto";
import { chamar } from "@/lib/chamar";
import { cn, formatarTelefone } from "@/lib/utils";
import { CANAIS_PROSPECT, SERVICOS, type CanalProspect, type Servico } from "@/lib/rotulos";
import type { ConfigProspeccao, ModeloProspeccao, Prospect, ToqueProspect } from "@/lib/dados/tipos";
import {
  ATIVAS, atrasado, hojeSp, linkDoCanal, linkEmail, linkInstagram, linkLinkedin, linkSite, linkWhatsapp, numeroDoContato, preencher, rotuloDia,
  simularToque, type ResultadoToque,
} from "@/lib/prospeccao";
import { atualizarProspect, carregarToques, converterEmNegocio, mudarSituacao, registrarToque, type DadosProspect } from "./acoes";
import { Pontos, Proximo, SeloSituacao } from "./comum";

const RESULTADOS: { id: ResultadoToque; rotulo: string }[] = [
  { id: "enviada", rotulo: "Mandei, sem resposta" },
  { id: "respondeu", rotulo: "Respondeu" },
  { id: "depois", rotulo: "Pediu para falar depois" },
  { id: "sem_interesse", rotulo: "Sem interesse" },
  { id: "nota", rotulo: "Só uma anotação" },
];
const ROTULO_TOQUE: Record<ToqueProspect["resultado"], string> = {
  enviada: "Contato feito, sem resposta", respondeu: "Respondeu", depois: "Pediu para falar depois", sem_interesse: "Sem interesse",
  interessado: "Virou negócio", nao_abordar: "Não abordar mais", reaberto: "Reaberto", nota: "Anotação", importado: "Entrou na prospecção",
};
const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

export function FichaProspect({ prospect: p, aberto, foco, modelos, config, onFechar, onAtualizar, onContatoFeito }: {
  prospect: Prospect | null; aberto: boolean; foco: "registrar" | null; modelos: ModeloProspeccao[]; config: ConfigProspeccao;
  onFechar: () => void; onAtualizar: (id: string, patch: Partial<Prospect>) => void; onContatoFeito: () => void;
}) {
  const { perfil, equipe } = usePainel();
  const router = useRouter();
  const podeAgir = perfil.papel !== "projetos";
  const hoje = hojeSp();
  const [toques, setToques] = React.useState<ToqueProspect[] | null>(null);
  const [canal, setCanal] = React.useState<CanalProspect>("linkedin");
  const [resultado, setResultado] = React.useState<ResultadoToque>("enviada");
  const [anotacao, setAnotacao] = React.useState("");
  const [data, setData] = React.useState("");
  const [mensagem, setMensagem] = React.useState("");
  const [converter, setConverter] = React.useState(false);
  const ocupado = React.useRef(false);
  const [enviando, setEnviando] = React.useState(false);
  const registrarRef = React.useRef<HTMLDivElement>(null);

  const id = p?.id;
  React.useEffect(() => {
    if (!id || !aberto) return;
    let vivo = true;
    setToques(null);
    setConverter(false);
    setResultado("enviada");
    setAnotacao("");
    setData("");
    carregarToques(id).then((t) => vivo && setToques(t)).catch(() => vivo && setToques([]));
    return () => { vivo = false; };
  }, [id, aberto]);
  // Canal e mensagem sugerida acompanham o prospect aberto
  React.useEffect(() => { if (p) setCanal(p.canal); }, [p?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = p ? numeroDoContato(p) : 1;
  React.useEffect(() => {
    if (!p) return;
    const m = modelos.find((x) => x.canal === canal && x.toque === n) ?? modelos.find((x) => x.canal === canal);
    setMensagem(m ? preencher(m.texto, p, perfil.nome) : "");
  }, [p?.id, canal, n, modelos]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (aberto && foco === "registrar") setTimeout(() => registrarRef.current?.scrollIntoView({ block: "center" }), 80);
  }, [aberto, foco, id]);

  if (!p) return <Drawer open={false} onOpenChange={() => {}} title=""><span /></Drawer>;
  const ativo = ATIVAS.includes(p.situacao);
  const totalRitmo = config.ritmo.length + 1;
  const encerrado = p.situacao === "sem_interesse" || p.situacao === "nao_abordar";
  const sugestao = simularToque(p, resultado, config.ritmo, hoje, data || null);
  const proximoTexto = resultado === "nota" ? null
    : sugestao.situacao === "sem_interesse" ? (resultado === "sem_interesse" ? "Vai para Encerrados." : `Era o ${p.toques + 1}º contato sem resposta: vai para Encerrados (dá para reabrir).`)
    : sugestao.proximo_contato ? `Próximo contato: ${rotuloDia(sugestao.proximo_contato, hoje)}${data ? "" : " (pelo ritmo)"}` : null;

  const adicionarToque = (t: Omit<ToqueProspect, "id" | "ocorreu_em" | "autor_nome">) =>
    setToques((xs) => [{ ...t, id: crypto.randomUUID(), ocorreu_em: new Date().toISOString(), autor_nome: perfil.nome }, ...(xs ?? [])]);

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    if (!p || ocupado.current) return;
    if (resultado === "depois" && !data) return void toast.error("Escolha quando falar de novo.");
    ocupado.current = true;
    setEnviando(true);
    const antes = { situacao: p.situacao, toques: p.toques, proximo_contato: p.proximo_contato, ultimo_contato_em: p.ultimo_contato_em, canal: p.canal };
    const previsto = simularToque(p, resultado, config.ritmo, hoje, data || null);
    onAtualizar(p.id, { ...previsto, ...(resultado !== "nota" ? { canal } : {}) });
    try {
      const r = await chamar(registrarToque(p.id, canal, resultado, anotacao, data || null));
      if (!r.ok) { onAtualizar(p.id, antes); return void toast.error(r.erro); }
      if (r.dados) onAtualizar(p.id, { situacao: r.dados.situacao, proximo_contato: r.dados.proximo_contato, toques: r.dados.toques });
      adicionarToque({ canal, resultado, anotacao: anotacao.trim() || null });
      if (resultado === "enviada") onContatoFeito();
      const final = r.dados ?? { situacao: previsto.situacao ?? p.situacao, proximo_contato: previsto.proximo_contato ?? null };
      toast.success(resultado === "nota" ? "Anotação salva"
        : final.situacao === "sem_interesse" ? `${p.empresa} foi para Encerrados`
        : final.proximo_contato ? `Registrado. Próximo contato ${rotuloDia(final.proximo_contato, hoje)}` : "Registrado");
      setAnotacao("");
      setData("");
      setResultado("enviada");
    } finally {
      ocupado.current = false;
      setEnviando(false);
    }
  }

  async function mudar(para: "sem_interesse" | "nao_abordar" | "reabrir") {
    if (!p) return;
    const destino = para === "reabrir" ? (p.toques === 0 ? "a_abordar" : "acompanhamento") : para;
    const antes = { situacao: p.situacao, proximo_contato: p.proximo_contato };
    onAtualizar(p.id, { situacao: destino, proximo_contato: para === "reabrir" ? hoje : null });
    const r = await chamar(mudarSituacao(p.id, destino));
    if (!r.ok) { onAtualizar(p.id, antes); return void toast.error(r.erro); }
    adicionarToque({ canal: null, resultado: para === "reabrir" ? "reaberto" : para, anotacao: null });
    const msg = para === "reabrir" ? `${p.empresa} voltou para hoje` : para === "nao_abordar" ? `${p.empresa}: não abordar mais` : `${p.empresa} foi para Encerrados`;
    toast(msg, {
      id: `prosp-${p.id}`,
      action: para === "reabrir" ? undefined : {
        label: "Desfazer",
        onClick: async () => {
          onAtualizar(p.id, antes);
          const d = await chamar(mudarSituacao(p.id, antes.situacao === "interessado" ? "acompanhamento" : antes.situacao));
          if (!d.ok) toast.error(d.erro);
        },
      },
    });
  }

  async function salvar(campo: keyof DadosProspect, valor: string) {
    if (!p) return;
    const r = await chamar(atualizarProspect(p.id, { [campo]: valor } as Partial<DadosProspect>));
    if (!r.ok) { toast.error(r.erro); throw new Error(r.erro); }
    onAtualizar(p.id, { [campo]: valor || null } as Partial<Prospect>);
  }

  const copiar = async () => {
    try { await navigator.clipboard.writeText(mensagem); toast.success("Mensagem copiada"); }
    catch { toast.error("Não deu para copiar. Selecione o texto e copie."); }
  };
  const abrirCom = linkDoCanal(p, canal, mensagem);
  const links = [
    p.linkedin && { href: linkLinkedin(p.linkedin), rotulo: "LinkedIn" },
    p.whatsapp && { href: linkWhatsapp(p.whatsapp), rotulo: `WhatsApp ${formatarTelefone(p.whatsapp)}` },
    p.email && { href: linkEmail(p.email), rotulo: p.email },
    p.instagram && { href: linkInstagram(p.instagram), rotulo: p.instagram.startsWith("@") ? p.instagram : "Instagram" },
    p.site && { href: linkSite(p.site), rotulo: p.site },
  ].filter(Boolean) as { href: string; rotulo: string }[];

  return (
    <Drawer
      open={aberto}
      onOpenChange={(o) => !o && onFechar()}
      width={640}
      title={p.empresa}
      subtitle={[p.pessoa && `${p.pessoa}${p.cargo ? `, ${p.cargo}` : ""}`, p.segmento, p.cidade].filter(Boolean).join(" · ") || "Sem contato definido"}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <SeloSituacao situacao={p.situacao} />
          {ativo && p.situacao !== "a_abordar" && <span className="flex items-center gap-2 text-xs text-fg-muted"><Pontos feitos={p.toques} total={totalRitmo} /> {Math.min(p.toques, totalRitmo)} de {totalRitmo} contatos</span>}
          {ativo && p.proximo_contato && (
            <Badge tone={atrasado(p, hoje) ? "danger" : "neutral"}>Próximo contato: {rotuloDia(p.proximo_contato, hoje)}{atrasado(p, hoje) ? " (atrasado)" : ""}</Badge>
          )}
          {encerrado && p.motivo_encerramento && <span className="text-xs text-fg-muted">{p.motivo_encerramento}</span>}
        </div>

        {p.situacao === "interessado" && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-accent-soft px-4 py-3">
            <span className="text-sm">Virou negócio no Funil. Continue por lá.</span>
            {p.negocio_id && <Button size="sm" variant="primary" asChild><Link href={`/funil?id=${p.negocio_id}`}>Abrir no Funil <ArrowUpRight /></Link></Button>}
          </div>
        )}

        {links.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {links.map((l) => <Button key={l.href} size="sm" asChild><a href={l.href} target="_blank" rel="noreferrer">{l.rotulo}</a></Button>)}
          </div>
        )}

        {ativo && (
          <section className="rounded-xl bg-bloco-inset p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-medium text-fg-muted">Mensagem sugerida · {n}º contato por {CANAIS_PROSPECT[canal]}</h3>
              <div className="flex gap-1.5">
                <Button size="sm" variant="secondary" onClick={copiar} className="bg-bloco"><Copy /> Copiar</Button>
                {abrirCom && (canal === "whatsapp" || canal === "email") && (
                  <Button size="sm" variant="secondary" asChild className="bg-bloco"><a href={abrirCom.href} target="_blank" rel="noreferrer">{abrirCom.rotulo} com o texto</a></Button>
                )}
              </div>
            </div>
            <Textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} className="min-h-28 bg-bloco" aria-label="Mensagem sugerida" />
            <p className="mt-2 text-xs text-fg-subtle">Edite à vontade antes de copiar. O painel não envia nada sozinho: você manda pelo seu {CANAIS_PROSPECT[canal]}.</p>
          </section>
        )}

        {podeAgir && p.situacao !== "interessado" && p.situacao !== "nao_abordar" && (
          <div ref={registrarRef}>
            <form onSubmit={registrar} className="flex flex-col gap-3 rounded-xl border border-accent/40 p-4">
              <h3 className="text-md font-medium">Registrar contato</h3>
              <fieldset className="flex flex-wrap items-center gap-1.5">
                <legend className="mb-1.5 text-xs text-fg-muted">Canal</legend>
                {(Object.keys(CANAIS_PROSPECT) as CanalProspect[]).map((c) => (
                  <button key={c} type="button" aria-pressed={canal === c} onClick={() => setCanal(c)}
                    className={cn("h-8 rounded-full border px-3 text-xs transition-colors", canal === c ? "border-transparent bg-accent-soft text-fg" : "border-border text-fg-muted hover:border-border-strong")}>
                    {CANAIS_PROSPECT[c]}
                  </button>
                ))}
              </fieldset>
              <fieldset className="grid grid-cols-2 gap-1.5 sm:grid-cols-3" role="radiogroup">
                <legend className="mb-1.5 text-xs text-fg-muted">O que aconteceu</legend>
                {RESULTADOS.map((r, i) => (
                  <button key={r.id} type="button" role="radio" aria-checked={resultado === r.id} onClick={() => setResultado(r.id)} autoFocus={foco === "registrar" && i === 0}
                    className={cn("min-h-10 rounded-lg border px-3 py-2 text-left text-sm transition-colors", resultado === r.id ? "border-accent bg-accent-soft" : "border-border hover:border-border-strong")}>
                    {r.rotulo}
                  </button>
                ))}
              </fieldset>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pr-anot">Anotação {resultado === "respondeu" ? "(o que a pessoa disse)" : "(opcional)"}</Label>
                <Textarea id="pr-anot" value={anotacao} onChange={(e) => setAnotacao(e.target.value)} className="min-h-16"
                  placeholder={resultado === "respondeu" ? "Ex.: me liga quinta à tarde" : resultado === "sem_interesse" ? "Ex.: já têm sistema próprio" : ""} />
              </div>
              {resultado !== "nota" && resultado !== "sem_interesse" && (
                <label className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
                  {resultado === "depois" ? "Falar de novo em" : "Mudar a data do próximo contato (opcional)"}
                  <Input type="date" min={hoje} value={data} onChange={(e) => setData(e.target.value)} className="num h-8 w-auto" required={resultado === "depois"} aria-label="Data do próximo contato" />
                </label>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-fg-muted">{proximoTexto}</p>
                <Button type="submit" variant="primary" disabled={enviando}><Check /> {enviando ? "Registrando…" : "Registrar"}</Button>
              </div>
            </form>
          </div>
        )}

        {podeAgir && p.situacao !== "interessado" && (
          converter ? (
            <Converter p={p} onCancelar={() => setConverter(false)} onConvertido={(negocioId) => {
              onAtualizar(p.id, { situacao: "interessado", negocio_id: negocioId, proximo_contato: null });
              adicionarToque({ canal: null, resultado: "interessado", anotacao: "Virou negócio no Funil" });
              setConverter(false);
              toast.success(`${p.empresa} virou negócio no Funil`, {
                description: "Está em Em triagem, com o histórico da prospecção.",
                action: negocioId ? { label: "Abrir", onClick: () => router.push(`/funil?id=${negocioId}`) } : undefined,
                duration: 8000,
              });
            }} />
          ) : (
            <div className="flex flex-wrap gap-2">
              {p.situacao !== "nao_abordar" && <Button variant="primary" className="bg-transparent text-accent ring-1 ring-accent hover:bg-accent-soft" onClick={() => setConverter(true)}><Handshake /> Tem interesse: criar negócio</Button>}
              {ativo && <Button onClick={() => mudar("sem_interesse")}><ThumbsDown /> Sem interesse</Button>}
              {p.situacao !== "nao_abordar" && <Button variant="danger" onClick={() => mudar("nao_abordar")}><Ban /> Não abordar mais</Button>}
              {encerrado && <Button onClick={() => mudar("reabrir")}><RotateCcw /> Reabrir</Button>}
            </div>
          )
        )}

        <dl className="grid grid-cols-[136px_minmax(0,1fr)] items-center gap-y-1 text-sm">
          <dt className="text-fg-muted">Responsável</dt>
          <dd>
            <Select value={p.responsavel_id ?? ""} disabled={!podeAgir} aria-label="Responsável"
              onChange={async (e) => {
                const v = e.target.value || null;
                const antes = p.responsavel_id;
                onAtualizar(p.id, { responsavel_id: v });
                const r = await chamar(atualizarProspect(p.id, { responsavel_id: v }));
                if (!r.ok) { onAtualizar(p.id, { responsavel_id: antes }); toast.error(r.erro); }
              }}>
              <option value="">Ninguém</option>
              {equipe.filter((x) => x.papel !== "projetos").map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
            </Select>
          </dd>
          <dt className="text-fg-muted">Canal preferido</dt>
          <dd>
            <Select value={p.canal} disabled={!podeAgir} aria-label="Canal preferido" onChange={async (e) => {
              const v = e.target.value as CanalProspect;
              onAtualizar(p.id, { canal: v });
              setCanal(v);
              const r = await chamar(atualizarProspect(p.id, { canal: v }));
              if (!r.ok) toast.error(r.erro);
            }}>
              {(Object.keys(CANAIS_PROSPECT) as CanalProspect[]).map((c) => <option key={c} value={c}>{CANAIS_PROSPECT[c]}</option>)}
            </Select>
          </dd>
          {([
            ["pessoa", "Pessoa"], ["cargo", "Cargo"], ["email", "E-mail"], ["whatsapp", "WhatsApp"], ["linkedin", "LinkedIn"], ["instagram", "Instagram"],
            ["site", "Site"], ["cidade", "Cidade"], ["segmento", "Segmento"], ["porque", "Por que abordar"],
          ] as [keyof DadosProspect & keyof Prospect, string][]).map(([campo, rotulo]) => (
            <React.Fragment key={campo}>
              <dt className="text-fg-muted">{rotulo}</dt>
              <dd className="min-w-0">
                <InlineField disabled={!podeAgir} mono={campo === "whatsapp"} value={String(p[campo] ?? "")} placeholder="Adicionar…"
                  exibir={campo === "whatsapp" ? formatarTelefone : undefined} onSave={(v) => salvar(campo, v)} />
              </dd>
            </React.Fragment>
          ))}
          <dt className="text-fg-muted">Origem do contato</dt>
          <dd className="py-1 text-fg-muted">{p.lista_nome ? `Lista “${p.lista_nome}” · ` : ""}{p.origem}</dd>
        </dl>

        <section>
          <h3 className="mb-3 text-xs font-medium text-fg-subtle">Histórico</h3>
          {toques === null ? (
            <div className="flex flex-col gap-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-1/2" /></div>
          ) : toques.length === 0 ? <p className="text-sm text-fg-muted">Nada registrado ainda.</p> : (
            <ol className="flex flex-col gap-2.5">
              {toques.map((t) => (
                <li key={t.id} className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 text-sm">
                  <span className="num text-xs text-fg-subtle">{fmt.format(new Date(t.ocorreu_em))}</span>
                  <span>
                    {ROTULO_TOQUE[t.resultado]}{t.canal ? ` · ${CANAIS_PROSPECT[t.canal]}` : ""}
                    {t.anotacao && <span className="text-fg-muted">: {t.anotacao}</span>}
                    {t.autor_nome && <span className="text-fg-subtle"> · {t.autor_nome.split(" ")[0]}</span>}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </Drawer>
  );
}

/** Tem interesse: pede o que o Funil precisa (e-mail ou WhatsApp e o serviço) e cria o negócio. */
function Converter({ p, onCancelar, onConvertido }: { p: Prospect; onCancelar: () => void; onConvertido: (negocioId: string | null) => void }) {
  const [email, setEmail] = React.useState(p.email ?? "");
  const [whats, setWhats] = React.useState(p.whatsapp ?? "");
  const [servicos, setServicos] = React.useState<Servico[]>([]);
  const [enviando, setEnviando] = React.useState(false);
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    if (!email.trim() && !whats.trim()) return void toast.error("Informe o e-mail ou o WhatsApp do contato.");
    setEnviando(true);
    const r = await chamar(converterEmNegocio(p.id, email, whats, servicos));
    setEnviando(false);
    if (!r.ok) return void toast.error(r.erro);
    onConvertido(r.dados?.negocio_id ?? null);
  }
  return (
    <form onSubmit={enviar} className="flex flex-col gap-3 rounded-xl border border-accent p-4">
      <h3 className="text-md font-medium">Criar negócio no Funil</h3>
      <p className="text-xs text-fg-muted">O negócio começa em Em triagem, com o histórico da prospecção. O Funil precisa de um jeito de falar com o cliente.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5"><Label htmlFor="cv-email">E-mail</Label><Input id="cv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="cv-whats">WhatsApp</Label><Input id="cv-whats" value={whats} onChange={(e) => setWhats(e.target.value)} placeholder="(11) 98765-4321" /></div>
      </div>
      <fieldset className="flex flex-wrap gap-1.5">
        <legend className="mb-1.5 text-xs text-fg-muted">O que interessa (opcional)</legend>
        {(Object.keys(SERVICOS) as Servico[]).map((s) => (
          <button key={s} type="button" aria-pressed={servicos.includes(s)} onClick={() => setServicos((xs) => (xs.includes(s) ? xs.filter((x) => x !== s) : [...xs, s]))}
            className={cn("h-8 rounded-full border px-3 text-xs transition-colors", servicos.includes(s) ? "border-transparent bg-accent-soft text-fg" : "border-border text-fg-muted hover:border-border-strong")}>
            {SERVICOS[s]}
          </button>
        ))}
      </fieldset>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancelar}>Cancelar</Button>
        <Button type="submit" variant="primary" disabled={enviando}><Handshake /> {enviando ? "Criando…" : "Criar negócio"}</Button>
      </div>
    </form>
  );
}
