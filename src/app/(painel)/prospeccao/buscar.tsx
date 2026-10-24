"use client";
import * as React from "react";
import { ExternalLink, Globe, MapPin, Phone, Search, Star } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, Select } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { usePainel } from "@/components/painel/contexto";
import { chamar } from "@/lib/chamar";
import { cn } from "@/lib/utils";
import { UFS } from "@/lib/busca-empresas";
import { buscarEmpresas, importarEncontradas, type ResultadoEncontradas } from "./acoes";

type Item = ResultadoEncontradas["itens"][number];
const NICHOS = ["clínica", "clínica odontológica", "construtora", "restaurante", "padaria", "imobiliária", "academia", "escola", "escritório de contabilidade",
  "escritório de advocacia", "transportadora", "loja de roupas", "ótica", "farmácia", "pet shop", "oficina mecânica", "salão de beleza", "hotel", "indústria"];
const STATUS: Record<Item["status"], { rotulo: string; tom: "success" | "neutral" | "danger" | "warning" } | null> = {
  novo: null,
  sem_contato: { rotulo: "Sem telefone/site", tom: "warning" },
  repetido: { rotulo: "Já na prospecção", tom: "neutral" },
  cliente: { rotulo: "Já é contato", tom: "neutral" },
  nao_abordar: { rotulo: "Não abordar", tom: "danger" },
  sem_empresa: { rotulo: "Sem nome", tom: "warning" },
};
const pode = (i: Item) => i.status === "novo" || i.status === "sem_contato";
const lerPref = (k: string) => { try { return localStorage.getItem(k) ?? ""; } catch { return ""; } };
const gravarPref = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ok */ } };

/** Nicho + cidade + estado → lista de empresas (Google Maps ou OpenStreetMap) → escolhe → entra na prospecção. */
export function BuscarEmpresas({ aberto, setAberto, onImportado }: { aberto: boolean; setAberto: (o: boolean) => void; onImportado: () => void }) {
  const { perfil, equipe } = usePainel();
  const vendedores = equipe.filter((x) => x.papel !== "projetos");
  const [nicho, setNicho] = React.useState("");
  const [cidade, setCidade] = React.useState("");
  const [uf, setUf] = React.useState("SP");
  const [busca, setBusca] = React.useState<{ nicho: string; cidade: string; uf: string } | null>(null);
  const [res, setRes] = React.useState<ResultadoEncontradas | null>(null);
  const [marcados, setMarcados] = React.useState<Set<string>>(new Set());
  const [soTelefone, setSoTelefone] = React.useState(false);
  const [soCelular, setSoCelular] = React.useState(false);
  const [notaMin, setNotaMin] = React.useState(0);
  const [usarOsm, setUsarOsm] = React.useState(false);
  const [resp, setResp] = React.useState<string[]>([perfil.id]);
  const [porDia, setPorDia] = React.useState(10);
  const [carregando, setCarregando] = React.useState<"buscar" | "mais" | "importar" | null>(null);

  React.useEffect(() => {
    if (!aberto) return;
    setCidade((c) => c || lerPref("busca:cidade"));
    setUf((u) => lerPref("busca:uf") || u);
  }, [aberto]);

  async function buscar(e?: React.FormEvent, mais = false) {
    e?.preventDefault();
    if (carregando) return;
    const alvo = mais && busca ? busca : { nicho: nicho.trim(), cidade: cidade.trim(), uf };
    if (!alvo.nicho || !alvo.cidade) return void toast.error("Informe o nicho e a cidade.");
    setCarregando(mais ? "mais" : "buscar");
    const r = await chamar(buscarEmpresas(alvo.nicho, alvo.cidade, alvo.uf, mais ? res?.proxima : null, usarOsm ? "osm" : undefined));
    setCarregando(null);
    if (!r.ok) return void toast.error(r.erro);
    gravarPref("busca:cidade", alvo.cidade); gravarPref("busca:uf", alvo.uf);
    setBusca(alvo);
    const d = r.dados!;
    const vistos = new Set(mais ? res?.itens.map((i) => i.id) : []);
    const itens = mais && res ? [...res.itens, ...d.itens.filter((i) => !vistos.has(i.id))] : d.itens;
    setRes({ ...d, itens });
    setMarcados((m) => new Set([...(mais ? m : []), ...d.itens.filter(pode).filter(passa).map((i) => i.id)]));
    if (!d.itens.length) toast.info("Nada encontrado. Tente outro termo para o nicho (ex.: “dentista” em vez de “clínica odontológica”).");
  }

  const passa = (i: Item) => (!soTelefone || Boolean(i.telefone)) && (!soCelular || i.celular) && (!notaMin || (i.nota ?? 0) >= notaMin);
  const visiveis = res?.itens.filter(passa) ?? [];
  const escolhidos = visiveis.filter((i) => marcados.has(i.id) && pode(i));
  const todosMarcados = visiveis.filter(pode).length > 0 && visiveis.filter(pode).every((i) => marcados.has(i.id));

  async function importar() {
    if (!busca || !escolhidos.length || carregando) return;
    if (!resp.length) return void toast.error("Escolha quem vai abordar.");
    setCarregando("importar");
    const r = await chamar(importarEncontradas(escolhidos, busca.nicho, busca.cidade, busca.uf, resp, porDia));
    setCarregando(null);
    if (!r.ok) return void toast.error(r.erro);
    const n = r.dados?.novos ?? escolhidos.length;
    toast.success(`${n} ${n === 1 ? "empresa entrou" : "empresas entraram"} na prospecção`, {
      description: `Lista “${busca.nicho} em ${busca.cidade}/${busca.uf}”, ${porDia} por dia útil a partir do próximo dia útil. A mensagem já vem pronta para o ramo.`,
    });
    setRes((x) => x && { ...x, itens: x.itens.map((i) => (escolhidos.some((e) => e.id === i.id) ? { ...i, status: "repetido" } : i)) });
    setMarcados(new Set());
    onImportado();
  }

  const fonteNome = res?.fonte === "google" ? "Google Maps" : "OpenStreetMap";

  return (
    <Dialog open={aberto} onOpenChange={setAberto} title="Buscar empresas para prospectar" className="max-w-4xl"
      description="Escolha o nicho, a cidade e o estado. O painel traz as empresas e você escolhe quais entram na prospecção."
      footer={res && res.itens.length > 0 ? (
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
            <span>Quem aborda:</span>
            {vendedores.map((v) => (
              <button key={v.id} type="button" aria-pressed={resp.includes(v.id)} onClick={() => setResp((xs) => (xs.includes(v.id) ? xs.filter((x) => x !== v.id) : [...xs, v.id]))}
                className={cn("h-7 rounded-full border px-2.5 transition-colors", resp.includes(v.id) ? "border-transparent bg-accent-soft text-fg" : "border-border hover:border-border-strong")}>
                {v.nome.split(" ")[0]}
              </button>
            ))}
            <label className="flex items-center gap-1.5">· <Input type="number" min={1} max={50} value={porDia} onChange={(e) => setPorDia(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} className="num h-7 w-14" aria-label="Quantas por dia" /> por dia</label>
          </div>
          <Button variant="primary" onClick={importar} disabled={!escolhidos.length || carregando !== null}>
            {carregando === "importar" ? "Importando…" : `Adicionar ${escolhidos.length} à prospecção`}
          </Button>
        </div>
      ) : undefined}>
      <div className="flex flex-col gap-4">
        <form onSubmit={(e) => buscar(e)} className="grid gap-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_96px_auto] sm:items-end">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bz-nicho">Nicho</Label>
            <Input id="bz-nicho" list="bz-nichos" value={nicho} onChange={(e) => setNicho(e.target.value)} placeholder="Ex.: clínica odontológica" autoFocus />
            <datalist id="bz-nichos">{NICHOS.map((n) => <option key={n} value={n} />)}</datalist>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bz-cidade">Cidade</Label>
            <Input id="bz-cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Ex.: Campinas" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bz-uf">Estado</Label>
            <Select id="bz-uf" className="h-9" value={uf} onChange={(e) => setUf(e.target.value)}>{UFS.map((u) => <option key={u} value={u}>{u}</option>)}</Select>
          </div>
          <Button type="submit" variant="primary" disabled={carregando !== null}><Search /> {carregando === "buscar" ? "Buscando…" : "Buscar"}</Button>
        </form>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-fg-muted">Filtros:</span>
          {([["Com telefone", soTelefone, setSoTelefone], ["Celular (WhatsApp)", soCelular, setSoCelular]] as const).map(([r, v, set]) => (
            <button key={r} type="button" aria-pressed={v} onClick={() => set(!v)}
              className={cn("h-7 rounded-full border px-2.5 transition-colors", v ? "border-transparent bg-accent-soft text-fg" : "border-border text-fg-muted hover:border-border-strong")}>{r}</button>
          ))}
          <Select aria-label="Nota mínima" value={String(notaMin)} onChange={(e) => setNotaMin(Number(e.target.value))} className="h-7 text-xs">
            <option value="0">Qualquer nota</option><option value="4">Nota 4+</option><option value="4.5">Nota 4,5+</option>
          </Select>
          <span className="ml-auto text-fg-subtle">
            {res ? `Fonte: ${fonteNome}` : "Fonte: Google Maps se a chave estiver configurada; senão OpenStreetMap (grátis)"}
            {res?.temGoogle && (
              <label className="ml-2 inline-flex items-center gap-1"><input type="checkbox" checked={usarOsm} onChange={(e) => setUsarOsm(e.target.checked)} /> usar OpenStreetMap</label>
            )}
          </span>
        </div>
        {res && !res.temGoogle && (
          <p className="rounded-xl bg-bloco-inset px-3 py-2 text-xs text-fg-muted">
            Buscando no OpenStreetMap (grátis): no Brasil ele tem menos empresas e quase nunca telefone. Com a chave do Google Maps na Vercel (GOOGLE_MAPS_API_KEY), a busca traz telefone, site e nota de quase todas.
          </p>
        )}

        {res && (visiveis.length === 0 ? (
          <p className="py-8 text-center text-sm text-fg-muted">{res.itens.length ? "Nenhuma empresa passa nos filtros." : "Nada encontrado."}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-bloco-inset text-left text-xs text-fg-muted">
                <tr>
                  <th className="w-10 px-3 py-2"><input type="checkbox" aria-label="Marcar todas" checked={todosMarcados}
                    onChange={(e) => setMarcados(e.target.checked ? new Set(visiveis.filter(pode).map((i) => i.id)) : new Set())} /></th>
                  <th className="px-2 py-2 font-medium">Empresa</th>
                  <th className="px-2 py-2 font-medium">Contato</th>
                  <th className="px-2 py-2 font-medium">Nota</th>
                  <th className="px-2 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {visiveis.map((i) => (
                  <tr key={i.id} className={cn("border-t border-border", !pode(i) && "opacity-55")}>
                    <td className="px-3 py-2"><input type="checkbox" aria-label={`Escolher ${i.empresa}`} disabled={!pode(i)} checked={marcados.has(i.id) && pode(i)}
                      onChange={(e) => setMarcados((m) => { const n = new Set(m); if (e.target.checked) n.add(i.id); else n.delete(i.id); return n; })} /></td>
                    <td className="max-w-72 px-2 py-2">
                      <span className="block truncate font-medium">{i.empresa}</span>
                      <span className="flex items-center gap-1 truncate text-xs text-fg-muted">{i.endereco && <MapPin className="size-3 shrink-0" />}{[i.categoria, i.endereco].filter(Boolean).join(" · ")}</span>
                    </td>
                    <td className="px-2 py-2 text-xs">
                      {i.telefone && <span className="flex items-center gap-1"><Phone className="size-3" /> <span className="num">{i.telefone}</span>{i.celular && <Badge tone="success">WhatsApp</Badge>}</span>}
                      {i.site && <a href={/^https?:/.test(i.site) ? i.site : `https://${i.site}`} target="_blank" rel="noreferrer" className="flex max-w-48 items-center gap-1 truncate text-fg-muted hover:text-fg"><Globe className="size-3 shrink-0" /> {i.site.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</a>}
                      {!i.telefone && !i.site && <span className="text-fg-subtle">—</span>}
                    </td>
                    <td className="num px-2 py-2 text-xs">{i.nota ? <span className="flex items-center gap-1"><Star className="size-3 text-warning" /> {i.nota.toFixed(1)} <span className="text-fg-subtle">({i.avaliacoes ?? 0})</span></span> : "—"}</td>
                    <td className="px-2 py-2 text-right">
                      <span className="inline-flex items-center gap-1.5">
                        {STATUS[i.status] && <Badge tone={STATUS[i.status]!.tom}>{STATUS[i.status]!.rotulo}</Badge>}
                        {i.mapa && <a href={i.mapa} target="_blank" rel="noreferrer" aria-label={`Ver ${i.empresa} no mapa`} className="text-fg-muted hover:text-fg"><ExternalLink className="size-3.5" /></a>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {res && (
          <div className="flex items-center justify-between text-xs text-fg-muted">
            <span>{visiveis.length} de {res.itens.length} {res.itens.length === 1 ? "empresa" : "empresas"} · {escolhidos.length} {escolhidos.length === 1 ? "escolhida" : "escolhidas"}</span>
            {res.proxima && <Button size="sm" onClick={() => buscar(undefined, true)} disabled={carregando !== null}>{carregando === "mais" ? "Carregando…" : "Carregar mais 20"}</Button>}
          </div>
        )}
      </div>
    </Dialog>
  );
}
