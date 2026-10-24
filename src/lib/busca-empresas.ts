/**
 * Busca de empresas para prospectar: nicho + cidade + UF.
 * 1º a base do painel (dados abertos de CNPJ da Receita, carregada pelo robô do GitHub);
 * Google Maps (Places API New) quando há GOOGLE_MAPS_API_KEY; senão OpenStreetMap (grátis).
 * Funções puras de conversão ficam exportadas para teste.
 */

export type FonteBusca = "receita" | "google" | "osm";
export interface EmpresaEncontrada {
  fonte: FonteBusca;
  email?: string | null;
  id: string;
  empresa: string;
  telefone: string | null;
  site: string | null;
  endereco: string | null;
  nota: number | null;
  avaliacoes: number | null;
  mapa: string | null;
  categoria: string | null;
}
export interface ResultadoBusca { fonte: FonteBusca; itens: EmpresaEncontrada[]; proxima: string | null; total?: number; atualizado?: string | null }

// ─── Base da Receita (CNPJ) ──────────────────────────────────────────────────
/** Nicho em português → prefixos do CNAE principal. Ordem importa (o mais específico primeiro). */
const CNAE_NICHO: [RegExp, string[]][] = [
  [/odonto|dent/i, ["8630504"]],
  [/est[eé]tica|beleza|sal[aã]o|cabelei|barbear|manicure/i, ["9602"]],
  [/fisio/i, ["8650004"]], [/psic[oó]l/i, ["8650003"]], [/nutri/i, ["8650002"]], [/fono/i, ["8650006"]],
  [/laborat|diagn[oó]st|exame|imagem/i, ["8640"]],
  [/veterin|pet/i, ["7500100", "4789004"]],
  [/cl[ií]nica|consult[oó]rio|m[eé]dic|sa[uú]de/i, ["8630501", "8630502", "8630503", "8630506", "8630507", "8630599", "8650"]],
  [/farm[aá]cia|drogaria/i, ["4771"]],
  [/[oó]tica/i, ["4774100"]],
  [/padaria|confeit/i, ["1091102", "4721102"]],
  [/restaurante|lanchonete|bar\b|pizzaria|hamburg|aliment|delivery/i, ["5611", "5620"]],
  [/supermercado|mercado|mercearia|hortifruti/i, ["4711", "4712", "4724", "4729"]],
  [/roupa|moda|vestu[aá]rio|boutique/i, ["4781"]], [/cal[cç]ado/i, ["4782"]],
  [/m[oó]veis|decora/i, ["4754"]], [/material de constru/i, ["4744"]],
  [/autope[cç]a/i, ["4530"]], [/oficina|mec[aâ]nic|funilaria/i, ["4520"]],
  [/loja|varejo|com[eé]rcio/i, ["47"]],
  [/contab/i, ["6920"]], [/advoc|jur[ií]dic/i, ["6911"]], [/imobili[aá]ri|corretor|im[oó]ve/i, ["682"]],
  [/academia|fitness|crossfit|pilates|muscula/i, ["9313"]],
  [/escola|col[eé]gio|educa|creche/i, ["8511", "8512", "8513", "8520"]], [/curso|idioma|treinamento/i, ["8593", "8599"]],
  [/hotel|pousada|hospedagem/i, ["5510", "5590"]],
  [/lavanderia/i, ["9601"]],
];
export const cnaesDoNicho = (nicho: string) => CNAE_NICHO.find(([re]) => re.test(nicho))?.[1] ?? [];
export const NICHOS_RECEITA = ["dentista", "clínica médica", "estética", "fisioterapia", "psicologia", "laboratório", "veterinária / pet shop", "farmácia", "ótica",
  "padaria", "restaurante", "supermercado", "loja de roupas", "calçados", "móveis", "material de construção", "autopeças", "oficina mecânica",
  "contabilidade", "advocacia", "imobiliária", "academia", "escola", "cursos e idiomas", "hotel / pousada", "lavanderia"];

type LinhaCnpj = { cnpj: string; nome: string; razao: string | null; cnae: string; municipio: string; bairro: string | null; endereco: string | null;
  telefone: string | null; telefone2: string | null; email: string | null; abertura: string | null; porte: number | null };
const PORTE: Record<number, string> = { 1: "microempresa", 3: "pequena empresa", 5: "média/grande" };
export function deReceita(linhas: LinhaCnpj[]): EmpresaEncontrada[] {
  return linhas.map((l) => {
    const cel = [l.telefone, l.telefone2].find((t) => ehCelular(t)) ?? null;
    return {
      fonte: "receita" as const, id: l.cnpj, empresa: l.nome, email: l.email,
      telefone: cel ?? l.telefone ?? l.telefone2, site: null,
      endereco: [l.endereco, l.bairro].filter(Boolean).join(" · ") || null, nota: null, avaliacoes: null,
      mapa: `https://www.google.com/maps/search/${encodeURIComponent(`${l.nome} ${l.endereco ?? ""} ${l.municipio}`)}`,
      categoria: [l.abertura ? `desde ${l.abertura.slice(0, 4)}` : null, l.porte ? PORTE[l.porte] : null, `CNPJ ${l.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}`].filter(Boolean).join(" · "),
    };
  });
}

export const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"] as const;

/** Celular brasileiro (dá para WhatsApp): DDD + 9 + 8 dígitos. */
export function ehCelular(tel: string | null) {
  const d = (tel ?? "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  return /^\d{2}9\d{8}$/.test(d);
}

// ─── Google ──────────────────────────────────────────────────────────────────
type LugarGoogle = {
  id: string; displayName?: { text?: string }; formattedAddress?: string; nationalPhoneNumber?: string; internationalPhoneNumber?: string;
  websiteUri?: string; rating?: number; userRatingCount?: number; googleMapsUri?: string; primaryTypeDisplayName?: { text?: string };
  businessStatus?: string;
};
export function deGoogle(json: { places?: LugarGoogle[]; nextPageToken?: string }): ResultadoBusca {
  const itens = (json.places ?? [])
    .filter((l) => l.businessStatus !== "CLOSED_PERMANENTLY" && l.displayName?.text)
    .map((l) => ({
      fonte: "google" as const, id: l.id, empresa: l.displayName!.text!,
      telefone: l.nationalPhoneNumber ?? l.internationalPhoneNumber ?? null, site: l.websiteUri ?? null,
      endereco: l.formattedAddress ?? null, nota: l.rating ?? null, avaliacoes: l.userRatingCount ?? null,
      mapa: l.googleMapsUri ?? null, categoria: l.primaryTypeDisplayName?.text ?? null,
    }));
  return { fonte: "google", itens, proxima: json.nextPageToken ?? null };
}

async function buscarGoogle(chave: string, nicho: string, cidade: string, uf: string, pagina?: string | null): Promise<ResultadoBusca> {
  const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": chave,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.googleMapsUri,places.primaryTypeDisplayName,places.businessStatus,nextPageToken",
    },
    body: JSON.stringify({ textQuery: `${nicho} em ${cidade}, ${uf}, Brasil`, languageCode: "pt-BR", regionCode: "BR", pageSize: 20, ...(pagina ? { pageToken: pagina } : {}) }),
    cache: "no-store",
  });
  if (!r.ok) {
    const t = await r.text();
    if (r.status === 403 || /API key|PERMISSION_DENIED/i.test(t)) throw new Error("google_chave");
    if (r.status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(t)) throw new Error("google_cota");
    throw new Error(`google_${r.status}`);
  }
  return deGoogle(await r.json());
}

// ─── OpenStreetMap ───────────────────────────────────────────────────────────
/** Nicho em português → etiquetas do OpenStreetMap. Sem par: procura o nicho no nome. */
const TAGS: [RegExp, string[]][] = [
  [/cl[ií]nica|consult[oó]rio|m[eé]dic/i, ['"amenity"="clinic"', '"amenity"="doctors"', '"healthcare"']],
  [/odonto|dent/i, ['"amenity"="dentist"']],
  [/veterin|pet/i, ['"amenity"="veterinary"', '"shop"="pet"']],
  [/restaurante|lanchonete|hamburg|pizzaria/i, ['"amenity"="restaurant"', '"amenity"="fast_food"']],
  [/padaria|confeit/i, ['"shop"="bakery"', '"shop"="pastry"']],
  [/caf[eé]/i, ['"amenity"="cafe"']],
  [/bar\b/i, ['"amenity"="bar"', '"amenity"="pub"']],
  [/academia|crossfit|pilates/i, ['"leisure"="fitness_centre"', '"sport"="fitness"']],
  [/escola|col[eé]gio/i, ['"amenity"="school"']],
  [/curso|idioma/i, ['"amenity"="language_school"', '"amenity"="training"']],
  [/imobili[aá]ri/i, ['"office"="estate_agent"']],
  [/contab/i, ['"office"="accountant"']],
  [/advoc|jur[ií]dic/i, ['"office"="lawyer"']],
  [/constru|engenharia/i, ['"office"="construction_company"', '"office"="engineer"', '"craft"="builder"']],
  [/farm[aá]cia|drogaria/i, ['"amenity"="pharmacy"']],
  [/[oó]tica/i, ['"shop"="optician"']],
  [/oficina|mec[aâ]nic/i, ['"shop"="car_repair"']],
  [/sal[aã]o|cabelei|barbear|est[eé]tica/i, ['"shop"="hairdresser"', '"shop"="beauty"']],
  [/hotel|pousada/i, ['"tourism"="hotel"', '"tourism"="guest_house"']],
  [/supermercado|mercado/i, ['"shop"="supermarket"', '"shop"="convenience"']],
  [/loja|varejo|roupa|moda/i, ['"shop"="clothes"', '"shop"="shoes"', '"shop"="boutique"']],
  [/transport|log[ií]stic/i, ['"office"="logistics"', '"office"="moving_company"']],
];

const escaparRe = (s: string) => s.replace(/[\\".*+?^${}()|[\]]/g, "\\$&");

/** "sao paulo" casa com "São Paulo": ignora maiúsculas e acentos no nome da cidade. */
export function nomeFlexivel(nome: string) {
  const grupos: Record<string, string> = { a: "aáàâãä", e: "eéèêë", i: "iíìîï", o: "oóòôõö", u: "uúùûü", c: "cç", n: "nñ" };
  const base = nome.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ");
  return "^" + [...base].map((ch) => (grupos[ch] ? `[${grupos[ch]}${grupos[ch].toUpperCase()}]` : ch === " " ? "\\s+" : escaparRe(ch))).join("") + "$";
}

export function consultaOverpass(nicho: string, cidade: string, uf: string, limite = 80) {
  const filtros = TAGS.find(([re]) => re.test(nicho))?.[1] ?? [`"name"~"${escaparRe(nicho)}",i`];
  const sel = filtros.map((f) => `nwr[${f}]["name"](area.c);`).join("");
  return `[out:json][timeout:20];area["ISO3166-2"="BR-${uf}"]->.uf;area["name"~"${nomeFlexivel(cidade)}",i]["admin_level"="8"](area.uf)->.c;(${sel});out center tags ${limite};`;
}

type ElementoOsm = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };
export function deOsm(json: { elements?: ElementoOsm[] }): ResultadoBusca {
  const itens = (json.elements ?? []).filter((e) => e.tags?.name).map((e) => {
    const t = e.tags!;
    const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
    const rua = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(", ");
    return {
      fonte: "osm" as const, id: `${e.type}/${e.id}`, empresa: t.name,
      telefone: t.phone ?? t["contact:phone"] ?? t["contact:whatsapp"] ?? t.mobile ?? t["contact:mobile"] ?? null,
      site: t.website ?? t["contact:website"] ?? null,
      endereco: [rua, t["addr:suburb"], t["addr:city"]].filter(Boolean).join(" · ") || null,
      nota: null, avaliacoes: null,
      mapa: lat && lon ? `https://www.openstreetmap.org/${e.type}/${e.id}` : null,
      categoria: t.shop ?? t.amenity ?? t.office ?? t.leisure ?? t.craft ?? null,
    };
  });
  return { fonte: "osm", itens, proxima: null };
}

type LugarNominatim = { osm_type: string; osm_id: number; name?: string; display_name?: string; type?: string; extratags?: Record<string, string> | null };
export function deNominatim(lista: LugarNominatim[]): ResultadoBusca {
  const itens = lista.filter((l) => l.name).map((l) => {
    const t = l.extratags ?? {};
    return {
      fonte: "osm" as const, id: `${l.osm_type}/${l.osm_id}`, empresa: l.name!,
      telefone: t.phone ?? t["contact:phone"] ?? t["contact:whatsapp"] ?? t.mobile ?? null,
      site: t.website ?? t["contact:website"] ?? null,
      endereco: l.display_name?.split(",").slice(1, 4).join(",").trim() || null,
      nota: null, avaliacoes: null, mapa: `https://www.openstreetmap.org/${l.osm_type}/${l.osm_id}`, categoria: l.type ?? null,
    };
  });
  return { fonte: "osm", itens, proxima: null };
}

const UA = { "User-Agent": "PainelStark/1.0 (prospeccao)", "Accept-Language": "pt-BR" };
async function comTempo(url: string, init: RequestInit, ms: number) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...init, signal: c.signal, cache: "no-store" }); } finally { clearTimeout(t); }
}
const SERVIDORES_OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"];

/** Overpass (3 servidores, um depois do outro) e, se vier vazio, a busca por texto do Nominatim. */
type FotonFeature = { properties: { osm_type: string; osm_id: number; osm_key?: string; osm_value?: string; name?: string; street?: string; housenumber?: string; district?: string; locality?: string; city?: string; state?: string } };
export function dePhoton(json: { features?: FotonFeature[] }): { fonte: "osm"; itens: (EmpresaEncontrada & { _cidade: string | null })[]; proxima: null } {
  const tipo: Record<string, string> = { N: "node", W: "way", R: "relation" };
  const itens = (json.features ?? []).filter((f) => f.properties.name).map((f) => {
    const p = f.properties;
    const t = tipo[p.osm_type] ?? "node";
    return {
      fonte: "osm" as const, id: `${t}/${p.osm_id}`, empresa: p.name!, telefone: null, site: null,
      endereco: [[p.street, p.housenumber].filter(Boolean).join(", "), p.district ?? p.locality, p.city].filter(Boolean).join(" · ") || null,
      nota: null, avaliacoes: null, mapa: `https://www.openstreetmap.org/${t}/${p.osm_id}`, categoria: p.osm_value ?? null,
      _cidade: p.city ?? null,
    };
  });
  return { fonte: "osm", itens, proxima: null };
}

const semAcento = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
/** Etiquetas do nicho no formato do Photon ("shop:bakery"). */
const tagsPhoton = (nicho: string) => (TAGS.find(([re]) => re.test(nicho))?.[1] ?? [])
  .map((f) => /"(\w+)"="([^"]+)"/.exec(f)).filter(Boolean).map((m) => `${m![1]}:${m![2]}`);

async function json<T>(p: Promise<Response>): Promise<T | null> {
  try { const r = await p; return r.ok ? ((await r.json()) as T) : null; } catch { return null; }
}

/**
 * Fontes grátis do OpenStreetMap, todas ao mesmo tempo (em poucos segundos):
 * Nominatim (traz telefone/site quando há), Photon e Overpass (este costuma demorar; entra só se responder a tempo).
 */
async function buscarOsm(nicho: string, cidade: string, uf: string): Promise<ResultadoBusca> {
  const q = `${nicho} ${cidade}`;
  const nomin = new URLSearchParams({ q: `${q} ${uf} Brasil`, format: "jsonv2", limit: "50", countrycodes: "br", extratags: "1", addressdetails: "1" });
  const photon = new URLSearchParams({ q, limit: "50", lang: "default" });
  tagsPhoton(nicho).forEach((t) => photon.append("osm_tag", t));
  const [a, b, c] = await Promise.all([
    json<LugarNominatim[]>(comTempo(`https://nominatim.openstreetmap.org/search?${nomin}`, { headers: UA }, 15_000)),
    json<{ features?: FotonFeature[] }>(comTempo(`https://photon.komoot.io/api/?${photon}`, { headers: UA }, 15_000)),
    json<{ elements?: ElementoOsm[] }>(comTempo(SERVIDORES_OVERPASS[0], {
      method: "POST", headers: { ...UA, "Content-Type": "application/x-www-form-urlencoded" }, body: "data=" + encodeURIComponent(consultaOverpass(nicho, cidade, uf)),
    }, 18_000)),
  ]);
  if (!a && !b && !c) throw new Error("osm_ocupado");

  // Junta sem repetir (mesmo lugar do OSM ou mesmo nome), preferindo quem tem telefone/site
  const alvo = semAcento(cidade);
  const fotons = (b ? dePhoton(b).itens : []).filter((i) => !i._cidade || semAcento(i._cidade) === alvo).map(({ _cidade, ...i }) => i);
  const noms = (a ? deNominatim(a.filter((l) => !l.display_name || semAcento(l.display_name).includes(alvo))).itens : []);
  const todos = [...(c ? deOsm(c).itens : []), ...noms, ...fotons];
  const porId = new Map<string, EmpresaEncontrada>();
  for (const i of todos) {
    const chave = semAcento(i.empresa);
    const ja = porId.get(i.id) ?? porId.get(chave);
    const junto = ja ? { ...ja, telefone: ja.telefone ?? i.telefone, site: ja.site ?? i.site, endereco: ja.endereco ?? i.endereco } : i;
    porId.set(i.id, junto); porId.set(chave, junto);
  }
  const itens = [...new Set(porId.values())].sort((x, y) => Number(Boolean(y.telefone)) - Number(Boolean(x.telefone)));
  return { fonte: "osm", itens, proxima: null };
}

export const temGoogle = () => Boolean(process.env.GOOGLE_MAPS_API_KEY);

export async function buscarEmpresasFonte(nicho: string, cidade: string, uf: string, pagina?: string | null, fonte?: "google" | "osm") {
  const chave = process.env.GOOGLE_MAPS_API_KEY;
  if (chave && fonte !== "osm") return buscarGoogle(chave, nicho, cidade, uf, pagina);
  return buscarOsm(nicho, cidade, uf);
}
