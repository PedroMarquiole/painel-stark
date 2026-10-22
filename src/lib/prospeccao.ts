// Regras de tela da Prospecção (sem dependência do servidor): o que entra em "Hoje",
// mensagem sugerida, links para abrir o canal e leitura de planilha (.csv, .xlsx ou colado do Excel).
import { unzipSync, strFromU8 } from "fflate";
import type { CanalProspect, SituacaoProspect } from "@/lib/rotulos";
import type { ModeloProspeccao, Prospect } from "@/lib/dados/tipos";

/** Situações em que ainda há algo a fazer. */
export const ATIVAS: SituacaoProspect[] = ["a_abordar", "contatado", "acompanhamento", "respondeu"];
export const ativo = (p: Pick<Prospect, "situacao">) => ATIVAS.includes(p.situacao);

/** Data de hoje em São Paulo (AAAA-MM-DD), igual ao banco. */
export const hojeSp = (agora = Date.now()) => new Date(agora - 3 * 3_600_000).toISOString().slice(0, 10);

export const paraHoje = (p: Prospect, hoje: string) => ativo(p) && Boolean(p.proximo_contato) && p.proximo_contato! <= hoje;
export const atrasado = (p: Prospect, hoje: string) => ativo(p) && Boolean(p.proximo_contato) && p.proximo_contato! < hoje;

/** Dias entre duas datas AAAA-MM-DD (b - a). */
export const diasEntre = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

/** Ordem de "Hoje": atrasados (mais antigos primeiro), depois quem respondeu, depois o resto pela data. */
export function ordenarHoje(xs: Prospect[], hoje: string) {
  const peso = (p: Prospect) => (atrasado(p, hoje) ? 0 : p.situacao === "respondeu" ? 1 : p.situacao === "a_abordar" ? 3 : 2);
  return [...xs].sort((a, b) => peso(a) - peso(b) || (a.proximo_contato ?? "").localeCompare(b.proximo_contato ?? "") || a.created_at.localeCompare(b.created_at));
}

/** Qual contato vem agora (1º, 2º ou 3º): define a mensagem sugerida. */
export const numeroDoContato = (p: Pick<Prospect, "toques">) => Math.min(3, p.toques + 1) as 1 | 2 | 3;

/** Preenche {{pessoa}}, {{empresa}} e {{seu_nome}}. Sem pessoa, usa um cumprimento neutro. */
export function preencher(texto: string, p: Pick<Prospect, "pessoa" | "empresa">, seuNome: string) {
  const primeiro = p.pessoa?.trim().split(/\s+/)[0];
  return texto
    .replace(/\{\{\s*pessoa\s*\}\}/g, primeiro || "pessoal")
    .replace(/\{\{\s*empresa\s*\}\}/g, p.empresa)
    .replace(/\{\{\s*seu_nome\s*\}\}/g, seuNome.split(/\s+/)[0] || seuNome);
}

export function mensagemSugerida(p: Prospect, modelos: ModeloProspeccao[], seuNome: string) {
  const n = numeroDoContato(p);
  const m = modelos.find((x) => x.canal === p.canal && x.toque === n) ?? modelos.find((x) => x.canal === p.canal);
  return m ? { n, texto: preencher(m.texto, p, seuNome), assunto: preencher(m.assunto || "Stark · {{empresa}}", p, seuNome) } : null;
}

// ─── Links para abrir o canal (nada é enviado pelo painel) ───────────────────
const comHttps = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u.replace(/^\/+/, "")}`);
export const linkLinkedin = (v: string) => (/linkedin\.com/i.test(v) ? comHttps(v) : `https://www.linkedin.com/in/${v.replace(/^@/, "")}`);
export const linkInstagram = (v: string) => (/instagram\.com/i.test(v) ? comHttps(v) : `https://www.instagram.com/${v.replace(/^@/, "")}`);
export const linkWhatsapp = (e164: string, texto?: string) =>
  `https://wa.me/${e164.replace(/\D/g, "")}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
export const linkEmail = (email: string, assunto?: string, corpo?: string) =>
  `mailto:${email}?${new URLSearchParams({ ...(assunto ? { subject: assunto } : {}), ...(corpo ? { body: corpo } : {}) }).toString().replace(/\+/g, "%20")}`;
export const linkSite = (v: string) => comHttps(v);

/** Onde abrir o contato pelo canal escolhido (ou o primeiro disponível). */
export function linkDoCanal(p: Prospect, canal: CanalProspect = p.canal, texto?: string): { href: string; rotulo: string } | null {
  if (canal === "linkedin" && p.linkedin) return { href: linkLinkedin(p.linkedin), rotulo: "Abrir LinkedIn" };
  if (canal === "whatsapp" && p.whatsapp) return { href: linkWhatsapp(p.whatsapp, texto), rotulo: "Abrir WhatsApp" };
  if (canal === "email" && p.email) return { href: linkEmail(p.email, `Stark · ${p.empresa}`, texto), rotulo: "Escrever e-mail" };
  if (canal === "instagram" && p.instagram) return { href: linkInstagram(p.instagram), rotulo: "Abrir Instagram" };
  if (canal === "telefone" && p.whatsapp) return { href: `tel:${p.whatsapp}`, rotulo: "Ligar" };
  return null;
}

// ─── Planilha ────────────────────────────────────────────────────────────────
export type CampoPlanilha = "empresa" | "pessoa" | "cargo" | "email" | "whatsapp" | "linkedin" | "instagram" | "site" | "cidade" | "segmento" | "porque";
export const CAMPOS_PLANILHA: Record<CampoPlanilha, string> = {
  empresa: "Empresa", pessoa: "Pessoa", cargo: "Cargo", email: "E-mail", whatsapp: "WhatsApp / telefone", linkedin: "LinkedIn",
  instagram: "Instagram", site: "Site", cidade: "Cidade", segmento: "Segmento", porque: "Por que abordar",
};
const sem = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const APELIDOS: [CampoPlanilha, RegExp][] = [
  ["email", /\be ?mail\b/],
  ["whatsapp", /whats|zap|telefone|celular|\bfone\b|phone|\btel\b/],
  ["linkedin", /linkedin|linked in/],
  ["instagram", /instagram|\binsta\b/],
  ["site", /\bsite\b|website|\burl\b|dominio/],
  ["cargo", /cargo|funcao|\btitle\b|posicao/],
  ["cidade", /cidade|municipio|\bcity\b|localidade/],
  ["segmento", /segmento|setor|\bramo\b|industry|categoria|nicho/],
  ["porque", /por que|porque|motivo|observ|\bobs\b|nota|comentario/],
  ["empresa", /empresa|razao social|fantasia|company|organizacao|negocio|\bloja\b/],
  ["pessoa", /\bnome\b|contato|pessoa|responsavel|\bname\b|decisor/],
];

/** Liga cada coluna da planilha a um campo, pelo nome do cabeçalho. Coluna sem par fica de fora. */
export function mapearColunas(cabecalho: string[]): (CampoPlanilha | null)[] {
  const usados = new Set<CampoPlanilha>();
  return cabecalho.map((h) => {
    const n = sem(h);
    const achado = APELIDOS.find(([campo, re]) => !usados.has(campo) && re.test(n))?.[0] ?? null;
    if (achado) usados.add(achado);
    return achado;
  });
}

/** CSV (vírgula ou ponto e vírgula) ou texto colado do Excel/Google Planilhas (tabulação). Aceita aspas. */
export function lerTexto(texto: string): string[][] {
  const limpo = texto.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const primeira = limpo.split("\n")[0] ?? "";
  const sep = ["\t", ";", ","].map((s) => [s, primeira.split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const linhas: string[][] = [];
  let linha: string[] = [], campo = "", aspas = false;
  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i];
    if (aspas) {
      if (c === '"' && limpo[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"' && campo === "") aspas = true;
    else if (c === sep) { linha.push(campo); campo = ""; }
    else if (c === "\n") { linha.push(campo); linhas.push(linha); linha = []; campo = ""; }
    else campo += c;
  }
  if (campo !== "" || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas.map((l) => l.map((x) => x.trim())).filter((l) => l.some(Boolean));
}

const xml = (s: string) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const colunaIdx = (ref: string) => [...ref.replace(/\d+/g, "")].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

/** Primeira aba de um .xlsx, como linhas de texto. */
export function lerXlsx(bytes: Uint8Array): string[][] {
  const zip = unzipSync(bytes);
  const shared = zip["xl/sharedStrings.xml"] ? strFromU8(zip["xl/sharedStrings.xml"]) : "";
  const textos = [...shared.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => xml([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")));
  const nome = Object.keys(zip).filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort()[0];
  if (!nome) throw new Error("planilha_vazia");
  const folha = strFromU8(zip[nome]);
  const linhas: string[][] = [];
  for (const row of folha.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const l: string[] = [];
    for (const c of row[1].matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1];
      const tipo = /t="(\w+)"/.exec(attrs)?.[1];
      const corpo = c[2] ?? "";
      const v = /<v>([\s\S]*?)<\/v>/.exec(corpo)?.[1];
      let valor = "";
      if (tipo === "s" && v != null) valor = textos[Number(v)] ?? "";
      else if (tipo === "inlineStr") valor = xml([...corpo.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(""));
      else if (v != null) valor = xml(v);
      const idx = ref ? colunaIdx(ref) : l.length;
      while (l.length < idx) l.push("");
      l[idx] = valor.trim();
    }
    if (l.some(Boolean)) linhas.push(l);
  }
  return linhas;
}

/** Linhas da planilha → objetos para importar_prospects, pelas colunas ligadas. */
export function paraImportar(linhas: string[][], mapa: (CampoPlanilha | null)[]) {
  return linhas.map((l) => {
    const o: Partial<Record<CampoPlanilha, string>> = {};
    mapa.forEach((campo, i) => {
      if (campo && l[i]) o[campo] = o[campo] ? `${o[campo]} ${l[i]}` : l[i];
    });
    return o;
  });
}

/** Soma dias úteis pulando fim de semana (feriados o banco confere e corrige na volta). */
export function somarDiasUteis(dia: string, n: number) {
  const d = new Date(`${dia}T12:00:00Z`);
  let k = 0;
  while (k < n) {
    d.setUTCDate(d.getUTCDate() + 1);
    const w = d.getUTCDay();
    if (w !== 0 && w !== 6) k++;
  }
  return d.toISOString().slice(0, 10);
}

export type ResultadoToque = "enviada" | "respondeu" | "depois" | "sem_interesse" | "nota";

/** Mesmas regras de registrar_toque_prospect, para a tela mudar na hora (o banco confirma em seguida). */
export function simularToque(p: Prospect, resultado: ResultadoToque, ritmo: number[], hoje: string, proximo?: string | null): Partial<Prospect> {
  if (resultado === "nota") return {};
  const base: Partial<Prospect> = { ultimo_contato_em: new Date().toISOString() };
  // contato com quem estava encerrado reabre, com mais um ciclo
  if (p.situacao === "sem_interesse" && resultado !== "sem_interesse") {
    const toques = Math.min(p.toques, ritmo.length);
    p = { ...p, toques, situacao: toques === 0 ? "a_abordar" : "acompanhamento", encerrado_em: null, motivo_encerramento: null };
    Object.assign(base, { encerrado_em: null, motivo_encerramento: null });
  }
  if (resultado === "enviada") {
    const toques = p.toques + 1;
    if (toques >= ritmo.length + 1) {
      return { ...base, toques, situacao: "sem_interesse", proximo_contato: null, encerrado_em: new Date().toISOString(), motivo_encerramento: `Sem resposta depois de ${toques} contatos` };
    }
    return { ...base, toques, situacao: toques === 1 ? "contatado" : "acompanhamento", proximo_contato: proximo || somarDiasUteis(hoje, ritmo[toques - 1]) };
  }
  if (resultado === "respondeu") return { ...base, toques: Math.max(p.toques, 1), situacao: "respondeu", proximo_contato: proximo || somarDiasUteis(hoje, 1) };
  if (resultado === "depois") {
    return { ...base, toques: Math.max(p.toques, 1), situacao: p.situacao === "a_abordar" || p.situacao === "contatado" ? "contatado" : p.situacao, proximo_contato: proximo ?? p.proximo_contato };
  }
  return { ...base, situacao: "sem_interesse", proximo_contato: null, encerrado_em: new Date().toISOString() };
}

/** "hoje", "amanhã", "qui, 24/10" para a data do próximo contato. */
export function rotuloDia(dia: string, hoje: string) {
  const n = diasEntre(hoje, dia);
  if (n === 0) return "hoje";
  if (n === 1) return "amanhã";
  if (n === -1) return "ontem";
  const d = new Date(`${dia}T12:00:00Z`);
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(d).replace(".", "");
}
