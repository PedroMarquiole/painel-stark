"use client";
import * as React from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, Select } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { usePainel } from "@/components/painel/contexto";
import { chamar } from "@/lib/chamar";
import { cn } from "@/lib/utils";
import { CAMPOS_PLANILHA, lerTexto, lerXlsx, mapearColunas, paraImportar, type CampoPlanilha } from "@/lib/prospeccao";
import { importarPlanilha, type LinhaImportar, type ResultadoImportacao } from "./acoes";

type Etapa = "arquivo" | "colunas" | "conferir";
type Status = ResultadoImportacao["linhas"][number]["status"];
const STATUS: Record<Status, { rotulo: string; tom: string }> = {
  novo: { rotulo: "Entra", tom: "text-success" },
  repetido: { rotulo: "Já está na prospecção", tom: "text-fg-muted" },
  cliente: { rotulo: "Já é contato do painel", tom: "text-fg-muted" },
  nao_abordar: { rotulo: "Pediu para não ser abordado", tom: "text-danger" },
  sem_contato: { rotulo: "Sem nenhum contato", tom: "text-warning" },
  sem_empresa: { rotulo: "Sem nome da empresa", tom: "text-warning" },
};

/** Sem banco (modo offline), confere só o básico. */
function conferirLocal(linhas: LinhaImportar[]): ResultadoImportacao {
  const st = linhas.map((l, i) => ({
    linha: i + 1,
    status: (!l.empresa?.trim() ? "sem_empresa" : !(l.email || l.whatsapp || l.linkedin || l.instagram || l.site) ? "sem_contato" : "novo") as Status,
  }));
  const n = (s: Status) => st.filter((x) => x.status === s).length;
  return { lista_id: null, linhas: st, novos: n("novo"), repetidos: 0, clientes: 0, bloqueados: 0, sem_contato: n("sem_contato"), sem_empresa: n("sem_empresa") };
}

export function Importar({ aberto, setAberto, onImportado }: { aberto: boolean; setAberto: (o: boolean) => void; onImportado: () => void }) {
  const { perfil, equipe } = usePainel();
  const vendedores = equipe.filter((x) => x.papel !== "projetos");
  const [etapa, setEtapa] = React.useState<Etapa>("arquivo");
  const [arquivo, setArquivo] = React.useState("");
  const [colado, setColado] = React.useState("");
  const [tabela, setTabela] = React.useState<string[][]>([]);
  const [mapa, setMapa] = React.useState<(CampoPlanilha | null)[]>([]);
  const [lista, setLista] = React.useState("");
  const [origem, setOrigem] = React.useState("");
  const [resp, setResp] = React.useState<string[]>([perfil.id]);
  const [porDia, setPorDia] = React.useState(10);
  const [conferido, setConferido] = React.useState<ResultadoImportacao | null>(null);
  const [ocupado, setOcupado] = React.useState(false);
  const trava = React.useRef(false);

  React.useEffect(() => {
    if (!aberto) return;
    setEtapa("arquivo"); setArquivo(""); setColado(""); setTabela([]); setMapa([]); setLista(""); setOrigem("");
    setResp([perfil.id]); setPorDia(10); setConferido(null);
  }, [aberto, perfil.id]);

  const cabecalho = tabela[0] ?? [];
  const corpo = tabela.slice(1);
  const linhas = React.useMemo(() => paraImportar(corpo, mapa), [corpo, mapa]); // eslint-disable-line react-hooks/exhaustive-deps

  function carregar(t: string[][], nome: string) {
    if (t.length < 2) return void toast.error("A planilha precisa de um cabeçalho e pelo menos uma linha.");
    setTabela(t);
    setMapa(mapearColunas(t[0]));
    setArquivo(nome);
    if (!lista) setLista(nome.replace(/\.(csv|xlsx|txt)$/i, ""));
    setEtapa("colunas");
  }

  async function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      if (/\.xlsx$/i.test(f.name)) carregar(lerXlsx(new Uint8Array(await f.arrayBuffer())), f.name);
      else if (/\.(csv|txt|tsv)$/i.test(f.name)) carregar(lerTexto(await f.text()), f.name);
      else toast.error("Use .xlsx ou .csv. No Google Planilhas: Arquivo › Fazer download › .xlsx ou .csv.");
    } catch {
      toast.error("Não consegui ler esse arquivo. Tente salvar como .csv ou cole as linhas abaixo.");
    }
  }

  async function conferir() {
    if (!mapa.includes("empresa")) return void toast.error("Diga qual coluna é a Empresa.");
    if (trava.current) return;
    trava.current = true;
    setOcupado(true);
    try {
      const r = await chamar(importarPlanilha(linhas, lista, origem || "Planilha", resp, porDia, true));
      if (!r.ok) return void toast.error(r.erro);
      setConferido(r.dados ?? conferirLocal(linhas));
      setEtapa("conferir");
    } finally {
      trava.current = false;
      setOcupado(false);
    }
  }

  async function importar() {
    if (!origem.trim()) return void toast.error("Conte de onde vieram esses contatos.");
    if (!resp.length) return void toast.error("Escolha quem vai abordar.");
    if (trava.current) return;
    trava.current = true;
    setOcupado(true);
    try {
      const r = await chamar(importarPlanilha(linhas, lista.trim() || arquivo || "Planilha", origem.trim(), resp, porDia, false));
      if (!r.ok) return void toast.error(r.erro);
      const novos = r.dados?.novos ?? conferido?.novos ?? 0;
      toast.success(`${novos} ${novos === 1 ? "empresa entrou" : "empresas entraram"} na prospecção`, {
        description: `Distribuídas em até ${porDia} por dia útil, a partir de hoje.`,
      });
      setAberto(false);
      onImportado();
    } finally {
      trava.current = false;
      setOcupado(false);
    }
  }

  const rodape = etapa === "arquivo" ? (
    <Button variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
  ) : etapa === "colunas" ? (<>
    <Button variant="ghost" onClick={() => setEtapa("arquivo")}>Voltar</Button>
    <Button variant="primary" onClick={conferir} disabled={ocupado}>{ocupado ? "Conferindo…" : `Conferir ${corpo.length} ${corpo.length === 1 ? "linha" : "linhas"}`}</Button>
  </>) : (<>
    <Button variant="ghost" onClick={() => setEtapa("colunas")}>Voltar</Button>
    <Button variant="primary" onClick={importar} disabled={ocupado || !conferido?.novos}>
      {ocupado ? "Importando…" : `Importar ${conferido?.novos ?? 0} ${conferido?.novos === 1 ? "empresa" : "empresas"}`}
    </Button>
  </>);

  return (
    <Dialog
      open={aberto}
      onOpenChange={setAberto}
      title="Importar planilha"
      description={etapa === "arquivo" ? "Lista de empresas em .xlsx ou .csv, ou linhas coladas do Excel." : etapa === "colunas" ? "Confira o que é cada coluna." : "Veja o que entra antes de importar."}
      className="max-w-2xl"
      footer={rodape}
    >
      {etapa === "arquivo" && (
        <div className="flex flex-col gap-4">
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border-strong px-4 py-8 text-center transition-colors hover:border-accent hover:bg-accent-soft/40">
            <FileSpreadsheet className="size-6 text-fg-muted" />
            <span className="text-sm font-medium">Escolher arquivo</span>
            <span className="text-xs text-fg-muted">.xlsx ou .csv, com uma linha de cabeçalho (Empresa, Nome, E-mail…)</span>
            <input type="file" accept=".xlsx,.csv,.txt,.tsv" className="sr-only" onChange={escolher} />
          </label>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="imp-colar">Ou cole as linhas aqui (com o cabeçalho)</Label>
            <Textarea id="imp-colar" className="min-h-24 font-mono text-xs" value={colado} onChange={(e) => setColado(e.target.value)} placeholder={"Empresa\tContato\tWhatsApp\nConstrutora Lima\tRenata\t11 98123-4455"} />
            <div className="flex justify-end">
              <Button size="sm" disabled={!colado.trim()} onClick={() => carregar(lerTexto(colado), "Linhas coladas")}><Upload /> Usar estas linhas</Button>
            </div>
          </div>
        </div>
      )}

      {etapa === "colunas" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-fg-muted">{arquivo} · {corpo.length} {corpo.length === 1 ? "linha" : "linhas"}. Colunas marcadas “Ignorar” ficam de fora.</p>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-bloco-inset text-left text-xs text-fg-muted">
                <tr><th className="px-3 py-2 font-medium">Coluna da planilha</th><th className="px-3 py-2 font-medium">Exemplo</th><th className="px-3 py-2 font-medium">É o quê</th></tr>
              </thead>
              <tbody>
                {cabecalho.map((h, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2">{h || `Coluna ${i + 1}`}</td>
                    <td className="max-w-48 truncate px-3 py-2 text-fg-muted">{corpo.find((l) => l[i])?.[i] ?? ""}</td>
                    <td className="px-3 py-2">
                      <Select aria-label={`Campo da coluna ${h}`} value={mapa[i] ?? ""} className={cn(!mapa[i] && "text-fg-subtle")}
                        onChange={(e) => {
                          const v = (e.target.value || null) as CampoPlanilha | null;
                          setMapa((m) => m.map((x, j) => (j === i ? v : x === v && v !== null ? null : x)));
                        }}>
                        <option value="">Ignorar</option>
                        {(Object.keys(CAMPOS_PLANILHA) as CampoPlanilha[]).map((c) => <option key={c} value={c}>{CAMPOS_PLANILHA[c]}</option>)}
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!mapa.includes("empresa") && <p className="text-xs text-danger">Falta dizer qual coluna é a Empresa.</p>}
        </div>
      )}

      {etapa === "conferir" && conferido && (
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {([
              ["Entram", conferido.novos, "text-success"],
              ["Já na prospecção", conferido.repetidos, ""],
              ["Já são contatos", conferido.clientes, ""],
              ["Não abordar", conferido.bloqueados, "text-danger"],
              ["Sem contato", conferido.sem_contato, "text-warning"],
              ["Sem empresa", conferido.sem_empresa, "text-warning"],
            ] as [string, number, string][]).filter(([, n], i) => i === 0 || n > 0).map(([r, n, tom]) => (
              <div key={r} className="rounded-xl bg-bloco-inset px-3 py-2">
                <dt className="text-xs text-fg-muted">{r}</dt>
                <dd className={cn("num text-lg font-medium", tom)}>{n}</dd>
              </div>
            ))}
          </dl>
          {conferido.novos < linhas.length && (
            <details className="text-sm">
              <summary className="cursor-pointer text-fg-muted">Ver as {linhas.length - conferido.novos} que ficam de fora</summary>
              <ul className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto">
                {conferido.linhas.filter((l) => l.status !== "novo").map((l) => (
                  <li key={l.linha} className="flex justify-between gap-3 text-xs">
                    <span className="truncate">Linha {l.linha + 1}: {linhas[l.linha - 1]?.empresa || "(sem empresa)"}</span>
                    <span className={STATUS[l.status].tom}>{STATUS[l.status].rotulo}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5"><Label htmlFor="imp-lista">Nome da lista</Label><Input id="imp-lista" value={lista} onChange={(e) => setLista(e.target.value)} placeholder="Ex.: Construtoras Campinas" /></div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="imp-dia">Quantas por dia útil</Label>
              <Input id="imp-dia" type="number" min={1} max={50} className="num" value={porDia} onChange={(e) => setPorDia(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="imp-origem">De onde vieram esses contatos</Label>
              <Input id="imp-origem" value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder="Ex.: lista da feira Sinduscon 2026, pesquisa no LinkedIn" required />
              <p className="text-xs text-fg-subtle">Fica guardado em cada empresa (LGPD).</p>
            </div>
            <fieldset className="flex flex-col gap-1.5 sm:col-span-2">
              <legend className="mb-1.5 text-sm">Quem vai abordar</legend>
              <div className="flex flex-wrap gap-1.5">
                {vendedores.map((v) => (
                  <button key={v.id} type="button" aria-pressed={resp.includes(v.id)}
                    onClick={() => setResp((xs) => (xs.includes(v.id) ? xs.filter((x) => x !== v.id) : [...xs, v.id]))}
                    className={cn("h-8 rounded-full border px-3 text-xs transition-colors", resp.includes(v.id) ? "border-transparent bg-accent-soft text-fg" : "border-border text-fg-muted hover:border-border-strong")}>
                    {v.nome}
                  </button>
                ))}
              </div>
              {resp.length > 1 && <p className="text-xs text-fg-subtle">Dividimos meio a meio, alternando.</p>}
            </fieldset>
          </div>
        </div>
      )}
    </Dialog>
  );
}
