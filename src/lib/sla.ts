/**
 * SLA de primeira resposta: "retorno em até 1 dia útil" (promessa do site).
 *
 * Regra adotada  [CONFIRMAR com a Stark]:
 *  - O relógio só corre em dias úteis (seg–sex, exceto feriados), 24h por dia.
 *  - Prazo = 24h de relógio útil a partir da chegada.
 *    Sex 15:00 → Seg 15:00 · Sáb 10:00 → fim de Seg (Ter 00:00) · véspera de feriado pula o feriado.
 *  - Fuso America/Sao_Paulo (UTC−3 fixo; sem horário de verão desde 2019).
 *
 * A mesma regra existe no banco (função public.sla_deadline) — o banco grava
 * leads.sla_vence_em na chegada; esta versão serve à UI e aos testes.
 * Mantenha as duas em sincronia (ver tests/sla.test.ts e supabase/tests).
 */

export const TZ_OFFSET_MIN = -180; // UTC−3
const DAY = 86_400_000;
const HOUR = 3_600_000;

export type SlaStatus = "no_prazo" | "vencendo" | "estourado" | "respondido";
export const SLA_VENCENDO_MS = 4 * HOUR;

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). Retorna [mês 1-12, dia]. */
export function easter(year: number): [number, number] {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return [month, day];
}

const key = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export interface HolidayOptions {
  /** Carnaval (seg/ter) e Corpus Christi são ponto facultativo. Padrão: contam como folga. [CONFIRMAR] */
  incluirFacultativos?: boolean;
  /** Feriados extras (estaduais/municipais/recesso), formato YYYY-MM-DD. */
  extras?: string[];
}

const cache = new Map<string, Set<string>>();

export function holidays(year: number, opts: HolidayOptions = {}): Set<string> {
  const { incluirFacultativos = true, extras = [] } = opts;
  const ck = `${year}|${incluirFacultativos}|${extras.join(",")}`;
  const hit = cache.get(ck);
  if (hit) return hit;

  const fixed: [number, number][] = [
    [1, 1], [4, 21], [5, 1], [9, 7], [10, 12], [11, 2], [11, 15], [11, 20], [12, 25],
  ];
  const set = new Set(fixed.map(([m, d]) => key(year, m, d)));

  const [em, ed] = easter(year);
  const easterUtc = Date.UTC(year, em - 1, ed);
  const shift = (days: number) => {
    const dt = new Date(easterUtc + days * DAY);
    return key(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  };
  set.add(shift(-2)); // Sexta-feira Santa
  if (incluirFacultativos) {
    set.add(shift(-48)); // Carnaval (segunda)
    set.add(shift(-47)); // Carnaval (terça)
    set.add(shift(60)); // Corpus Christi
  }
  extras.forEach((e) => e.startsWith(String(year)) && set.add(e));
  cache.set(ck, set);
  return set;
}

/** "Hora local" representada como epoch deslocado: getUTC* devolve campos locais. */
const toLocal = (d: Date) => d.getTime() + TZ_OFFSET_MIN * 60_000;
const fromLocal = (ms: number) => new Date(ms - TZ_OFFSET_MIN * 60_000);

export function isBusinessDay(localMs: number, opts?: HolidayOptions) {
  const d = new Date(localMs);
  const wd = d.getUTCDay();
  if (wd === 0 || wd === 6) return false;
  const y = d.getUTCFullYear();
  return !holidays(y, opts).has(key(y, d.getUTCMonth() + 1, d.getUTCDate()));
}

/** Prazo de 1 dia útil (24h de relógio útil) a partir de `arrival`. */
export function slaDeadline(arrival: Date, opts?: HolidayOptions, businessHours = 24): Date {
  let cursor = toLocal(arrival);
  let remaining = businessHours * HOUR;
  // Avança dia a dia consumindo só o tempo de dias úteis.
  for (let guard = 0; guard < 60; guard++) {
    const dayStart = Math.floor(cursor / DAY) * DAY;
    const dayEnd = dayStart + DAY;
    if (isBusinessDay(dayStart, opts)) {
      const available = dayEnd - cursor;
      if (remaining <= available) return fromLocal(cursor + remaining);
      remaining -= available;
    }
    cursor = dayEnd;
  }
  throw new Error("slaDeadline: não convergiu");
}

export function slaStatus(deadline: Date, now = new Date(), respondedAt?: Date | null): SlaStatus {
  if (respondedAt) return "respondido";
  const left = deadline.getTime() - now.getTime();
  if (left < 0) return "estourado";
  if (left < SLA_VENCENDO_MS) return "vencendo";
  return "no_prazo";
}

/** "3h 12min", "-1h 05min" */
export function formatCountdown(ms: number) {
  const sign = ms < 0 ? "−" : "";
  const abs = Math.abs(ms);
  const h = Math.floor(abs / HOUR);
  const m = Math.floor((abs % HOUR) / 60_000);
  if (h >= 24) return `${sign}${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${sign}${h}h ${String(m).padStart(2, "0")}min`;
  const s = Math.floor((abs % 60_000) / 1000);
  return `${sign}${m}min ${String(s).padStart(2, "0")}s`;
}
