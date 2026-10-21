"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DndContext, DragOverlay, KeyboardCode, KeyboardSensor, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { ArrowDown, ArrowUp, ChevronsRight, Crosshair, Plus, Search, Settings2, Upload, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { usePainel } from "@/components/painel/contexto";
import { Bloco, Titulo } from "@/components/painel/blocos";
import { useRelogio } from "@/hooks/use-now";
import { chamar } from "@/lib/chamar";
import { cn, formatBRL } from "@/lib/utils";
import { CANAIS_PROSPECT, SITUACOES_PROSPECT, type CanalProspect, type SituacaoProspect } from "@/lib/rotulos";
import type { ConfigProspeccao, ModeloProspeccao, ProspeccaoIndicadores, Prospect } from "@/lib/dados/tipos";
import { ATIVAS, atrasado, hojeSp, linkDoCanal, mensagemSugerida, ordenarHoje, paraHoje, rotuloDia } from "@/lib/prospeccao";
import { mudarSituacao } from "./acoes";
import { IconeCanal, Pontos, Proximo, SeloSituacao } from "./comum";
import { FichaProspect } from "./ficha";
import { NovoProspect } from "./novo";
import { Importar } from "./importar";
import { Ajustes } from "./ajustes";

type Ver = "hoje" | "pipeline" | "lista";
const lerPref = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const gravarPref = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento: só não lembra */ } };

export function Prospeccao({ iniciais, indicadores, modelos: modelosIniciais, config: configInicial }: {
  iniciais: Prospect[]; indicadores: ProspeccaoIndicadores; modelos: ModeloProspeccao[]; config: ConfigProspeccao;
}) {
  const { perfil, equipe, nomeDe } = usePainel();
  const router = useRouter();
  const params = useSearchParams();
  const agora = useRelogio(60_000);
  const hoje = hojeSp(agora);
  const [prospects, setProspects] = React.useState(iniciais);
  const [modelos, setModelos] = React.useState(modelosIniciais);
  const [config, setConfig] = React.useState(configInicial);
  const [ver, setVer] = React.useState<Ver>("hoje");
  const [busca, setBusca] = React.useState("");
  const [resp, setResp] = React.useState("");
  const [canal, setCanal] = React.useState("");
  const [lista, setLista] = React.useState("");
  const [aberto, setAberto] = React.useState<string | null>(params.get("id"));
  const [foco, setFoco] = React.useState<"registrar" | null>(null);
  const [novo, setNovo] = React.useState(false);
  const [importar, setImportar] = React.useState(false);
  const [ajustes, setAjustes] = React.useState(false);
  const [contatosFeitos, setContatosFeitos] = React.useState(0); // registrados nesta visita (somam aos da semana)
  const podeAgir = perfil.papel !== "projetos";

  React.useEffect(() => setProspects(iniciais), [iniciais]);
  React.useEffect(() => {
    const v = lerPref("prospeccao:ver");
    if (v === "hoje" || v === "pipeline" || v === "lista") setVer(v);
  }, []);
  const mudarVer = (v: Ver) => { setVer(v); gravarPref("prospeccao:ver", v); };

  const abrir = React.useCallback((id: string, f: "registrar" | null = null) => {
    setAberto(id);
    setFoco(f);
    window.history.replaceState(null, "", `/prospeccao?id=${id}`);
  }, []);
  const fechar = () => { setAberto(null); window.history.replaceState(null, "", "/prospeccao"); };

  const atualizar = React.useCallback((id: string, patch: Partial<Prospect>) => {
    setProspects((xs) => xs.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const termo = busca.trim().toLowerCase();
  const listas = React.useMemo(() => [...new Map(prospects.filter((p) => p.lista_id).map((p) => [p.lista_id!, p.lista_nome ?? "Lista"])).entries()], [prospects]);
  const visiveis = prospects.filter((p) => {
    if (resp === "eu" && p.responsavel_id !== perfil.id) return false;
    if (resp && resp !== "eu" && p.responsavel_id !== resp) return false;
    if (canal && p.canal !== canal) return false;
    if (lista && p.lista_id !== lista) return false;
    if (termo && !`${p.empresa} ${p.pessoa ?? ""} ${p.cidade ?? ""} ${p.segmento ?? ""} ${p.email ?? ""}`.toLowerCase().includes(termo)) return false;
    return true;
  });
  const temFiltro = Boolean(termo || resp || canal || lista);

  // Números do topo: "hoje" e "a abordar" acompanham a tela; os do período vêm do banco
  const doDia = prospects.filter((p) => paraHoje(p, hoje));
  const nAtrasados = doDia.filter((p) => atrasado(p, hoje)).length;
  const nAbordar = prospects.filter((p) => p.situacao === "a_abordar").length;
  const semana = indicadores.contatos_semana + contatosFeitos;
  const totalRitmo = config.ritmo.length + 1;
  const selecionado = prospects.find((p) => p.id === aberto) ?? null;

  const resumo = doDia.length === 0
    ? "Nenhum contato marcado para hoje."
    : `${doDia.length} contato${doDia.length > 1 ? "s" : ""} para hoje${nAtrasados ? `, ${nAtrasados} atrasado${nAtrasados > 1 ? "s" : ""}` : ""}.`;

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-4 pb-8 pt-2 sm:px-6 lg:pl-1">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Prospecção</h1>
          <p className="mt-1 text-sm text-fg-muted">Empresas que vocês vão atrás. {resumo}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {podeAgir && <Button onClick={() => setImportar(true)}><Upload /> Importar planilha</Button>}
          {podeAgir && <Button variant="primary" onClick={() => setNovo(true)}><UserPlus /> Novo prospect</Button>}
          <Button variant="ghost" size="icon" aria-label="Mensagens e ritmo" title="Mensagens e ritmo" onClick={() => setAjustes(true)}><Settings2 /></Button>
          <Segmented label="Ver como" value={ver} onChange={mudarVer}
            options={[{ value: "hoje", label: "Hoje" }, { value: "pipeline", label: "Pipeline" }, { value: "lista", label: "Lista" }]} />
        </div>
      </div>

      <dl className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 xl:grid-cols-5">
        <Numero rotulo="Para hoje" valor={String(doDia.length)} detalhe={nAtrasados ? `${nAtrasados} atrasado${nAtrasados > 1 ? "s" : ""}` : "nenhum atrasado"} alerta={nAtrasados > 0} />
        <Numero rotulo="A abordar" valor={String(nAbordar)} detalhe="na lista, ainda sem contato" />
        <Numero rotulo="Contatos feitos" valor={String(semana)} detalhe={config.meta_semana ? `nesta semana · meta ${config.meta_semana}` : "nesta semana"} />
        <Numero rotulo="Responderam" valor={indicadores.resposta_pct == null ? "—" : `${indicadores.resposta_pct}%`} detalhe="dos abordados em 30 dias" />
        <Numero rotulo="Viraram negócio" valor={String(indicadores.viraram_negocio)} detalhe={`em 30 dias${indicadores.valor_no_funil ? ` · ${formatBRL(indicadores.valor_no_funil)} no funil` : ""}`} destaque />
      </dl>

      {(ver !== "hoje" || prospects.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-2 size-4 text-fg-subtle" aria-hidden />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar empresa, pessoa ou cidade" className="pl-8" aria-label="Buscar prospect" />
          </div>
          <Select value={resp} onChange={(e) => setResp(e.target.value)} aria-label="Responsável">
            <option value="">Todos os responsáveis</option>
            <option value="eu">Só os meus</option>
            {equipe.filter((p) => p.papel !== "projetos" && p.id !== perfil.id).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </Select>
          <Select value={canal} onChange={(e) => setCanal(e.target.value)} aria-label="Canal">
            <option value="">Todos os canais</option>
            {(Object.keys(CANAIS_PROSPECT) as CanalProspect[]).map((c) => <option key={c} value={c}>{CANAIS_PROSPECT[c]}</option>)}
          </Select>
          {listas.length > 0 && (
            <Select value={lista} onChange={(e) => setLista(e.target.value)} aria-label="Lista">
              <option value="">Todas as listas</option>
              {listas.map(([id, nome]) => <option key={id} value={id}>Lista: {nome}</option>)}
            </Select>
          )}
          {temFiltro && <Button variant="ghost" size="sm" onClick={() => { setBusca(""); setResp(""); setCanal(""); setLista(""); }}>Limpar</Button>}
        </div>
      )}

      {prospects.length === 0 ? (
        <Bloco>
          <EmptyState icon={<Crosshair />} title="Nenhum prospect ainda"
            description="Comece importando uma planilha de empresas ou cadastrando a primeira à mão."
            action={podeAgir ? <div className="flex gap-2"><Button onClick={() => setImportar(true)}><Upload /> Importar planilha</Button><Button variant="primary" onClick={() => setNovo(true)}><Plus /> Novo prospect</Button></div> : undefined} />
        </Bloco>
      ) : ver === "hoje" ? (
        <Hoje itens={visiveis} hoje={hoje} totalRitmo={totalRitmo} modelos={modelos} indicadores={indicadores} config={config}
          podeAgir={podeAgir} onAbrir={abrir} onAjustes={() => setAjustes(true)} />
      ) : ver === "pipeline" ? (
        <Pipeline itens={visiveis} hoje={hoje} totalRitmo={totalRitmo} podeAgir={podeAgir} onAbrir={abrir} onAtualizar={atualizar} />
      ) : (
        <Lista itens={visiveis} hoje={hoje} totalRitmo={totalRitmo} onAbrir={abrir} nomeDe={nomeDe} />
      )}

      <FichaProspect
        prospect={selecionado}
        aberto={Boolean(selecionado)}
        foco={foco}
        modelos={modelos}
        config={config}
        onFechar={fechar}
        onAtualizar={atualizar}
        onContatoFeito={() => setContatosFeitos((n) => n + 1)}
      />
      <NovoProspect aberto={novo} setAberto={setNovo} onCriado={(p) => { setProspects((xs) => [...xs, p]); abrir(p.id, "registrar"); }} />
      <Importar aberto={importar} setAberto={setImportar} onImportado={() => router.refresh()} />
      <Ajustes aberto={ajustes} setAberto={setAjustes} modelos={modelos} config={config}
        onModelo={(m) => setModelos((xs) => [...xs.filter((x) => !(x.canal === m.canal && x.toque === m.toque)), m])} onConfig={setConfig} />
    </div>
  );
}

function Numero({ rotulo, valor, detalhe, alerta, destaque }: { rotulo: string; valor: string; detalhe: string; alerta?: boolean; destaque?: boolean }) {
  return (
    <div className="min-w-40 shrink-0 rounded-2xl bg-bloco px-5 py-4 shadow-bloco">
      <dt className="text-sm text-fg-muted">{rotulo}</dt>
      <dd className={cn("num mt-1 text-xl font-medium", destaque && "text-accent")}>{valor}</dd>
      <dd className={cn("text-xs", alerta ? "text-danger" : "text-fg-subtle")}>{detalhe}</dd>
    </div>
  );
}

// ─── Hoje ───────────────────────────────────────────────────────────────────
function Hoje({ itens, hoje, totalRitmo, modelos, indicadores, config, podeAgir, onAbrir, onAjustes }: {
  itens: Prospect[]; hoje: string; totalRitmo: number; modelos: ModeloProspeccao[]; indicadores: ProspeccaoIndicadores; config: ConfigProspeccao;
  podeAgir: boolean; onAbrir: (id: string, f?: "registrar" | null) => void; onAjustes: () => void;
}) {
  const { perfil } = usePainel();
  const doDia = ordenarHoje(itens.filter((p) => paraHoje(p, hoje)), hoje);
  const atrasados = doDia.filter((p) => atrasado(p, hoje));
  const deHoje = doDia.filter((p) => !atrasado(p, hoje));
  const proximos = itens.filter((p) => p.situacao === "a_abordar" && !paraHoje(p, hoje)).sort((a, b) => (a.proximo_contato ?? "").localeCompare(b.proximo_contato ?? "")).slice(0, 5);
  const maxPct = Math.max(1, ...indicadores.por_canal.map((c) => c.pct ?? 0));

  const Linha = ({ p }: { p: Prospect }) => {
    const msg = mensagemSugerida(p, modelos, perfil.nome);
    const link = linkDoCanal(p, p.canal, msg?.texto);
    const dica = p.situacao === "respondeu"
      ? (p.ultima_resposta ? `Respondeu: “${p.ultima_resposta}”` : "Respondeu, combinar o próximo passo")
      : p.situacao === "a_abordar" ? `1º contato · ${p.lista_nome ? `lista ${p.lista_nome}` : "cadastrado"}`
      : `${Math.min(p.toques + 1, totalRitmo)}º contato${p.toques + 1 >= totalRitmo ? " (último)" : ""}${p.ultimo_contato_em ? ` · último ${rotuloDia(p.ultimo_contato_em.slice(0, 10), hoje)}` : ""}`;
    return (
      <li className={cn("grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-xl bg-bloco-inset px-3.5 py-2.5 md:grid-cols-[32px_minmax(0,1.3fr)_minmax(0,1fr)_120px_auto]",
        p.situacao === "respondeu" && "ring-1 ring-success/35")}>
        <IconeCanal canal={p.canal} />
        <button onClick={() => onAbrir(p.id)} className="min-w-0 text-left">
          <span className="block truncate font-medium hover:underline">{p.empresa}</span>
          <span className="block truncate text-xs text-fg-muted">{[p.pessoa, p.cargo].filter(Boolean).join(", ") || p.cidade || "—"}</span>
        </button>
        <span className="col-span-2 truncate text-xs text-fg-muted md:col-span-1">{dica}</span>
        <span className="hidden md:block">
          {atrasado(p, hoje) ? <Proximo p={p} hoje={hoje} /> : p.situacao === "respondeu" ? <span className="text-xs text-success">respondeu</span> : <Pontos feitos={p.toques} total={totalRitmo} />}
        </span>
        <span className="col-span-3 flex justify-end gap-1.5 md:col-span-1">
          {link && <Button size="sm" asChild><a href={link.href} target="_blank" rel="noreferrer">{link.rotulo}</a></Button>}
          {podeAgir && <Button size="sm" variant="primary" onClick={() => onAbrir(p.id, "registrar")}>Registrar</Button>}
        </span>
      </li>
    );
  };

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <Bloco className="gap-3">
        <Titulo extra="atrasados primeiro, depois quem respondeu">Contatos de hoje</Titulo>
        {doDia.length === 0 ? (
          <p className="py-8 text-center text-sm text-fg-muted">
            Nada marcado para hoje. {proximos.length ? "Que tal abordar alguém da lista ao lado?" : "Importe uma planilha ou cadastre um prospect."}
          </p>
        ) : (
          <>
            {atrasados.length > 0 && <p className="text-xs font-medium text-danger">Atrasados</p>}
            {atrasados.length > 0 && <ul className="flex flex-col gap-1.5">{atrasados.map((p) => <Linha key={p.id} p={p} />)}</ul>}
            {deHoje.length > 0 && atrasados.length > 0 && <p className="mt-1 text-xs font-medium text-fg-muted">Para hoje</p>}
            {deHoje.length > 0 && <ul className="flex flex-col gap-1.5">{deHoje.map((p) => <Linha key={p.id} p={p} />)}</ul>}
          </>
        )}
      </Bloco>

      <div className="flex flex-col gap-4">
        <Bloco>
          <Titulo extra={`${itens.filter((p) => p.situacao === "a_abordar").length} na lista`}>Próximos a abordar</Titulo>
          {proximos.length === 0 ? <p className="text-sm text-fg-muted">Ninguém esperando na lista.</p> : (
            <ul className="flex flex-col gap-1.5">
              {proximos.map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-xl bg-bloco-inset px-3.5 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.empresa}</span>
                    <span className="block truncate text-xs text-fg-muted">{[p.segmento, p.cidade, p.proximo_contato ? `entra ${rotuloDia(p.proximo_contato, hoje)}` : null].filter(Boolean).join(" · ")}</span>
                  </span>
                  {podeAgir && <Button size="sm" onClick={() => onAbrir(p.id, "registrar")}>Abordar</Button>}
                </li>
              ))}
            </ul>
          )}
        </Bloco>
        <Bloco>
          <Titulo extra="últimos 30 dias">Quem responde mais</Titulo>
          {indicadores.por_canal.length === 0 ? <p className="text-sm text-fg-muted">Aparece depois dos primeiros contatos.</p> : (
            <ul className="flex flex-col gap-2.5">
              {indicadores.por_canal.map((c) => (
                <li key={c.canal} className="grid grid-cols-[80px_minmax(0,1fr)_44px] items-center gap-2.5">
                  <span className="text-fg-muted">{CANAIS_PROSPECT[c.canal]}</span>
                  <span className="h-2.5 rounded-sm bg-bloco-inset"><span className="block h-full rounded-sm bg-series-1" style={{ width: `${((c.pct ?? 0) / maxPct) * 100}%` }} /></span>
                  <span className="num text-right" title={`${c.n} abordados`}>{c.pct ?? 0}%</span>
                </li>
              ))}
            </ul>
          )}
        </Bloco>
        <Bloco>
          <Titulo>Ritmo combinado</Titulo>
          <p className="flex flex-wrap items-center gap-2 text-xs">
            {config.ritmo.map((d, i) => (
              <React.Fragment key={i}>
                <span className="rounded-full bg-bloco-inset px-2.5 py-1">{i + 1}º contato</span>
                <span className="text-fg-subtle">+{d} dia{d > 1 ? "s" : ""} útil{d > 1 ? "eis" : ""}</span>
              </React.Fragment>
            ))}
            <span className="rounded-full bg-bloco-inset px-2.5 py-1">{config.ritmo.length + 1}º contato</span>
            <span className="text-fg-subtle">sem resposta? encerra</span>
          </p>
          <button onClick={onAjustes} className="mt-3 self-start text-xs text-accent hover:underline">Mensagens e ritmo</button>
        </Bloco>
      </div>
    </div>
  );
}

// ─── Pipeline ───────────────────────────────────────────────────────────────
const COLUNAS = SITUACOES_PROSPECT.filter((s) => s.id !== "sem_interesse" && s.id !== "nao_abordar");

function Pipeline({ itens, hoje, totalRitmo, podeAgir, onAbrir, onAtualizar }: {
  itens: Prospect[]; hoje: string; totalRitmo: number; podeAgir: boolean; onAbrir: (id: string, f?: "registrar" | null) => void;
  onAtualizar: (id: string, patch: Partial<Prospect>) => void;
}) {
  const [encerradosAbertos, setEncerradosAbertos] = React.useState(false);
  const [arrastando, setArrastando] = React.useState<string | null>(null);
  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      keyboardCodes: { start: [KeyboardCode.Space], cancel: [KeyboardCode.Esc], end: [KeyboardCode.Space] },
      coordinateGetter: (ev, { currentCoordinates: c }) => {
        const passo = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[ev.code];
        if (!passo) return undefined;
        ev.preventDefault();
        return { x: c.x + passo[0] * 220, y: c.y + passo[1] * 60 };
      },
    }),
  );
  const encerrados = itens.filter((p) => p.situacao === "sem_interesse" || p.situacao === "nao_abordar");
  const porSituacao = (s: SituacaoProspect) => itens.filter((p) => p.situacao === s)
    .sort((a, b) => (a.proximo_contato ?? "9").localeCompare(b.proximo_contato ?? "9") || a.created_at.localeCompare(b.created_at));
  const ativo = itens.find((p) => p.id === arrastando);

  async function soltar(ev: DragEndEvent) {
    setArrastando(null);
    const p = itens.find((x) => x.id === ev.active.id);
    const destino = ev.over?.id as SituacaoProspect | "encerrados" | undefined;
    if (!p || !destino || destino === p.situacao) return;
    if (p.situacao === "interessado") return void toast.info("Já virou negócio. Continue pelo Funil.");
    if (destino === "interessado") return onAbrir(p.id); // criar negócio pede e-mail/WhatsApp e serviço, na ficha
    const para: SituacaoProspect = destino === "encerrados" ? "sem_interesse" : destino;
    if (destino === "encerrados" && (p.situacao === "sem_interesse" || p.situacao === "nao_abordar")) return;
    const antes = { situacao: p.situacao, proximo_contato: p.proximo_contato, toques: p.toques };
    onAtualizar(p.id, { situacao: para, proximo_contato: para === "sem_interesse" ? null : p.proximo_contato ?? hoje, toques: para === "a_abordar" ? 0 : p.toques });
    const r = await chamar(mudarSituacao(p.id, para as Exclude<SituacaoProspect, "interessado">));
    if (!r.ok) { onAtualizar(p.id, antes); return void toast.error(r.erro); }
    if (r.dados) onAtualizar(p.id, { situacao: r.dados.situacao, proximo_contato: r.dados.proximo_contato });
    toast(`${p.empresa} → ${SITUACOES_PROSPECT.find((s) => s.id === para)?.rotulo}`, {
      id: `prosp-${p.id}`,
      action: {
        label: "Desfazer",
        onClick: async () => {
          onAtualizar(p.id, antes);
          const d = await chamar(mudarSituacao(p.id, antes.situacao as Exclude<SituacaoProspect, "interessado">));
          if (!d.ok) toast.error(d.erro);
        },
      },
    });
  }

  return (
    <DndContext id="prospeccao" sensors={sensores} onDragStart={(e) => setArrastando(String(e.active.id))} onDragEnd={soltar} onDragCancel={() => setArrastando(null)}
      accessibility={{ screenReaderInstructions: { draggable: "Espaço pega o card. Setas mudam de coluna. Espaço solta, Esc cancela." } }}>
      <p id="dica-prospect" className="sr-only">Enter abre a ficha. Espaço pega o card; setas mudam de coluna; Espaço solta.</p>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {COLUNAS.map((c) => (
          <Coluna key={c.id} id={c.id} rotulo={c.rotulo} dica={c.id === "interessado" ? "soltar aqui abre a ficha para criar o negócio" : c.dica} destaque={c.id === "interessado"}>
            {porSituacao(c.id).map((p) => <Cartao key={p.id} p={p} hoje={hoje} totalRitmo={totalRitmo} podeAgir={podeAgir} onAbrir={() => onAbrir(p.id)} />)}
          </Coluna>
        ))}
        {encerradosAbertos ? (
          <Coluna id="encerrados" rotulo="Encerrados" dica="sem interesse ou não abordar" onRecolher={() => setEncerradosAbertos(false)}>
            {encerrados.map((p) => <Cartao key={p.id} p={p} hoje={hoje} totalRitmo={totalRitmo} podeAgir={podeAgir} onAbrir={() => onAbrir(p.id)} />)}
          </Coluna>
        ) : (
          <ColunaRecolhida n={encerrados.length} detalhe={`${encerrados.filter((p) => p.situacao === "sem_interesse").length} sem interesse · ${encerrados.filter((p) => p.situacao === "nao_abordar").length} não abordar`}
            onAbrir={() => setEncerradosAbertos(true)} />
        )}
      </div>
      <DragOverlay dropAnimation={{ duration: 160 }}>{ativo ? <div className="w-[220px] rotate-[1.5deg]"><Cartao p={ativo} hoje={hoje} totalRitmo={totalRitmo} podeAgir={false} onAbrir={() => {}} /></div> : null}</DragOverlay>
    </DndContext>
  );
}

function Coluna({ id, rotulo, dica, destaque, onRecolher, children }: { id: string; rotulo: string; dica: string; destaque?: boolean; onRecolher?: () => void; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const n = React.Children.count(children);
  return (
    <section ref={setNodeRef} aria-label={rotulo}
      className={cn("flex min-h-[420px] w-[240px] shrink-0 flex-col gap-2 rounded-2xl bg-bloco px-2 pb-2 pt-4 shadow-bloco xl:w-auto xl:min-w-[180px] xl:flex-1 xl:basis-0",
        destaque && "outline-dashed outline-1 outline-accent/50", isOver && "bg-accent-soft ring-1 ring-accent/40")}>
      <header className="flex items-start gap-2 px-2">
        <div className="min-w-0 flex-1">
          <h2 className={cn("font-sans text-sm font-medium", destaque && "text-accent")}>{rotulo} <span className="num text-xs font-normal text-fg-subtle">{n}</span></h2>
          <p className="text-xs text-fg-subtle">{dica}</p>
        </div>
        {onRecolher && <button onClick={onRecolher} aria-label={`Recolher ${rotulo}`} className="text-fg-subtle hover:text-fg"><ChevronsRight className="size-4" /></button>}
      </header>
      {children}
      {n === 0 && <p className="mx-1 rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-fg-subtle">Vazio</p>}
    </section>
  );
}

function ColunaRecolhida({ n, detalhe, onAbrir }: { n: number; detalhe: string; onAbrir: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: "encerrados" });
  return (
    <section ref={setNodeRef} aria-label="Encerrados (recolhida)" className={cn("flex w-14 shrink-0 flex-col items-center rounded-2xl bg-bloco py-4 shadow-bloco", isOver && "bg-accent-soft ring-1 ring-accent/40")}>
      <button onClick={onAbrir} aria-label={`Abrir encerrados: ${n}`} className="flex flex-1 flex-col items-center gap-3 text-fg-muted hover:text-fg">
        <span className="num text-md text-fg">{n}</span>
        <span className="text-sm font-medium [writing-mode:vertical-rl]">Encerrados</span>
        <span className="text-xs [writing-mode:vertical-rl]">{detalhe}</span>
      </button>
    </section>
  );
}

function Cartao({ p, hoje, totalRitmo, podeAgir, onAbrir }: { p: Prospect; hoje: string; totalRitmo: number; podeAgir: boolean; onAbrir: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: p.id, disabled: !podeAgir || p.situacao === "interessado" });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} aria-roledescription="card arrastável" aria-describedby="dica-prospect"
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAbrir(); return; } listeners?.onKeyDown?.(e); }}
      className={cn("rounded-xl focus-visible:outline-2 focus-visible:outline-accent", podeAgir ? "cursor-grab touch-manipulation" : "cursor-pointer", isDragging && "opacity-30")}>
      <article onClick={onAbrir} className={cn("rounded-xl border border-transparent bg-bloco-inset p-3 transition-colors hover:border-border-strong", atrasado(p, hoje) && "border-danger/45")}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 text-sm font-medium leading-5">{p.empresa}</h3>
          <IconeCanal canal={p.canal} className="size-6 [&_svg]:size-3.5" />
        </div>
        <p className="truncate text-xs text-fg-muted">{p.pessoa ?? p.cidade ?? "—"}</p>
        {p.situacao === "respondeu" && p.ultima_resposta && <p className="mt-2 rounded-lg bg-bloco px-2 py-1.5 text-xs text-fg-muted">“{p.ultima_resposta}”</p>}
        <div className="mt-2.5 flex items-center gap-2">
          {ATIVAS.includes(p.situacao) && p.situacao !== "a_abordar" && <Pontos feitos={p.toques} total={totalRitmo} />}
          {ATIVAS.includes(p.situacao) && <Proximo p={p} hoje={hoje} className="ml-auto" />}
          {p.situacao === "interessado" && p.negocio_id && <a href={`/funil?id=${p.negocio_id}`} onClick={(e) => e.stopPropagation()} className="text-xs">No Funil ↗</a>}
          {(p.situacao === "sem_interesse" || p.situacao === "nao_abordar") && <SeloSituacao situacao={p.situacao} />}
        </div>
      </article>
    </div>
  );
}

// ─── Lista ──────────────────────────────────────────────────────────────────
type Col = "empresa" | "situacao" | "proximo" | "toques" | "responsavel";
function Lista({ itens, hoje, totalRitmo, onAbrir, nomeDe }: {
  itens: Prospect[]; hoje: string; totalRitmo: number; onAbrir: (id: string) => void; nomeDe: (id: string | null | undefined) => string | null;
}) {
  const [filtro, setFiltro] = React.useState<"ativos" | "todos" | SituacaoProspect>("ativos");
  const [ord, setOrd] = React.useState<{ c: Col; asc: boolean }>({ c: "proximo", asc: true });
  const ordem = (s: SituacaoProspect) => SITUACOES_PROSPECT.findIndex((x) => x.id === s);
  const chave: Record<Col, (p: Prospect) => string | number> = {
    empresa: (p) => p.empresa.toLowerCase(),
    situacao: (p) => ordem(p.situacao),
    proximo: (p) => p.proximo_contato ?? "9999",
    toques: (p) => p.toques,
    responsavel: (p) => (nomeDe(p.responsavel_id) ?? "~").toLowerCase(),
  };
  const linhas = itens
    .filter((p) => (filtro === "ativos" ? ATIVAS.includes(p.situacao) : filtro === "todos" ? true : p.situacao === filtro))
    .sort((a, b) => { const x = chave[ord.c](a), y = chave[ord.c](b); return (x < y ? -1 : x > y ? 1 : 0) * (ord.asc ? 1 : -1); });
  const Cab = ({ c, children, className }: { c: Col; children: React.ReactNode; className?: string }) => (
    <th className={cn("px-3 py-3 font-normal", className)} aria-sort={ord.c === c ? (ord.asc ? "ascending" : "descending") : "none"}>
      <button onClick={() => setOrd((o) => ({ c, asc: o.c === c ? !o.asc : true }))} className={cn("inline-flex items-center gap-1 hover:text-fg", ord.c === c && "text-fg")}>
        {children}{ord.c === c && (ord.asc ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </th>
  );
  return (
    <div className="flex flex-col gap-3">
      <Select value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)} aria-label="Situação" className="self-start">
        <option value="ativos">Em andamento</option>
        <option value="todos">Todos, inclusive encerrados</option>
        {SITUACOES_PROSPECT.map((s) => <option key={s.id} value={s.id}>{s.rotulo}</option>)}
      </Select>
      <div className="overflow-x-auto rounded-2xl bg-bloco shadow-bloco">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="text-left text-xs text-fg-subtle">
            <tr className="border-b border-border">
              <Cab c="empresa" className="pl-5">Empresa</Cab>
              <Cab c="situacao">Situação</Cab>
              <th className="px-3 py-3 font-normal">Canal</th>
              <Cab c="proximo">Próximo contato</Cab>
              <Cab c="toques">Contatos</Cab>
              <Cab c="responsavel">Responsável</Cab>
              <th className="py-3 pl-3 pr-5 font-normal">Lista / origem</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((p) => {
              const resp = nomeDe(p.responsavel_id);
              return (
                <tr key={p.id} tabIndex={0} onClick={() => onAbrir(p.id)} onKeyDown={(e) => e.key === "Enter" && onAbrir(p.id)}
                  className="cursor-pointer border-b border-border/70 last:border-0 hover:bg-bloco-inset focus-visible:bg-bloco-inset focus-visible:outline-none">
                  <td className="max-w-[300px] py-2.5 pl-5 pr-3">
                    <p className="truncate font-medium">{p.empresa}</p>
                    <p className="truncate text-xs text-fg-subtle">{[p.pessoa, p.cidade, p.segmento].filter(Boolean).join(" · ") || "—"}</p>
                  </td>
                  <td className="px-3"><SeloSituacao situacao={p.situacao} /></td>
                  <td className="px-3 text-fg-muted">{CANAIS_PROSPECT[p.canal]}</td>
                  <td className="px-3">{ATIVAS.includes(p.situacao) ? <Proximo p={p} hoje={hoje} /> : <span className="text-xs text-fg-subtle">—</span>}</td>
                  <td className="px-3"><Pontos feitos={p.toques} total={totalRitmo} /></td>
                  <td className="px-3">{resp ? <span className="flex items-center gap-2"><Avatar name={resp} size={20} /><span className="truncate">{resp}</span></span> : <span className="text-xs text-fg-subtle">ninguém</span>}</td>
                  <td className="max-w-[220px] truncate py-2.5 pl-3 pr-5 text-xs text-fg-muted" title={p.origem}>{p.lista_nome ?? p.origem}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {linhas.length === 0 && <p className="py-10 text-center text-sm text-fg-muted">Nenhum prospect com esses filtros.</p>}
      </div>
      <p className="text-xs text-fg-subtle">{linhas.length} prospect{linhas.length === 1 ? "" : "s"}</p>
    </div>
  );
}
