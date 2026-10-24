/**
 * Busca de empresas para prospectar: nicho + cidade + UF.
 * Google Maps (Places API New) quando há GOOGLE_MAPS_API_KEY; senão OpenStreetMap (Overpass, grátis).
 * Funções puras de conversão ficam exportadas para teste.
 */

export interface EmpresaEncontrada {
  fonte: "google" | "osm";
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
export interface ResultadoBusca { fonte: "google" | "osm"; itens: EmpresaEncontrada[]; proxima: string | null }

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

export function consultaOverpass(nicho: string, cidade: string, uf: string, limite = 60) {
  const filtros = TAGS.find(([re]) => re.test(nicho))?.[1] ?? [`"name"~"${escaparRe(nicho)}",i`];
  const sel = filtros.map((f) => `nwr[${f}]["name"](area.c);`).join("");
  return `[out:json][timeout:25];area["ISO3166-2"="BR-${uf}"]->.uf;area["name"="${escaparRe(cidade)}"]["admin_level"="8"](area.uf)->.c;(${sel});out center tags ${limite};`;
}

type ElementoOsm = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };
export function deOsm(json: { elements?: ElementoOsm[] }): ResultadoBusca {
  const itens = (json.elements ?? []).filter((e) => e.tags?.name).map((e) => {
    const t = e.tags!;
    const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
    const rua = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(", ");
    return {
      fonte: "osm" as const, id: `${e.type}/${e.id}`, empresa: t.name,
      telefone: t.phone ?? t["contact:phone"] ?? t["contact:whatsapp"] ?? t.mobile ?? null,
      site: t.website ?? t["contact:website"] ?? null,
      endereco: [rua, t["addr:suburb"], t["addr:city"]].filter(Boolean).join(" · ") || null,
      nota: null, avaliacoes: null,
      mapa: lat && lon ? `https://www.openstreetmap.org/${e.type}/${e.id}` : null,
      categoria: t.shop ?? t.amenity ?? t.office ?? t.leisure ?? t.craft ?? null,
    };
  });
  return { fonte: "osm", itens, proxima: null };
}

async function buscarOsm(nicho: string, cidade: string, uf: string): Promise<ResultadoBusca> {
  const r = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "PainelStark/1.0" },
    body: "data=" + encodeURIComponent(consultaOverpass(nicho, cidade, uf)),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(r.status === 429 ? "osm_ocupado" : `osm_${r.status}`);
  return deOsm(await r.json());
}

export const temGoogle = () => Boolean(process.env.GOOGLE_MAPS_API_KEY);

export async function buscarEmpresasFonte(nicho: string, cidade: string, uf: string, pagina?: string | null, fonte?: "google" | "osm") {
  const chave = process.env.GOOGLE_MAPS_API_KEY;
  if (chave && fonte !== "osm") return buscarGoogle(chave, nicho, cidade, uf, pagina);
  return buscarOsm(nicho, cidade, uf);
}
