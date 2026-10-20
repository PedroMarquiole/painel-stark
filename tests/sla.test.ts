import { describe, expect, it } from "vitest";
import { easter, holidays, slaDeadline, slaStatus, formatCountdown } from "@/lib/sla";

// Helpers em horário de Brasília (UTC−3)
const br = (s: string) => new Date(`${s}-03:00`);
const iso = (d: Date) => new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 16);

describe("easter", () => {
  it.each([
    [2024, [3, 31]],
    [2025, [4, 20]],
    [2026, [4, 5]],
    [2027, [3, 28]],
  ])("%i", (y, exp) => expect(easter(y)).toEqual(exp));
});

describe("holidays", () => {
  it("inclui fixos, Sexta Santa, Consciência Negra e facultativos", () => {
    const h = holidays(2026);
    for (const d of ["2026-01-01", "2026-04-03", "2026-04-21", "2026-11-20", "2026-12-25", "2026-02-16", "2026-02-17", "2026-06-04"])
      expect(h.has(d), d).toBe(true);
  });
  it("facultativos podem ser desligados", () => {
    expect(holidays(2026, { incluirFacultativos: false }).has("2026-02-16")).toBe(false);
  });
});

describe("slaDeadline (1 dia útil)", () => {
  it("terça 10h → quarta 10h", () => expect(iso(slaDeadline(br("2026-10-20T10:00")))).toBe("2026-10-21T10:00"));
  it("sexta 15h → segunda 15h", () => expect(iso(slaDeadline(br("2026-10-23T15:00")))).toBe("2026-10-26T15:00"));
  it("sábado → fim de segunda", () => expect(iso(slaDeadline(br("2026-10-24T10:00")))).toBe("2026-10-27T00:00"));
  it("domingo 23h59 → fim de segunda", () => expect(iso(slaDeadline(br("2026-10-25T23:59")))).toBe("2026-10-27T00:00"));
  it("feriado em domingo (15/11) não afeta: sexta 13/11 → segunda 16/11", () =>
    expect(iso(slaDeadline(br("2026-11-13T09:00")))).toBe("2026-11-16T09:00"));
  it("quinta 19/11 → sexta 20/11 é feriado → segunda 23/11", () =>
    expect(iso(slaDeadline(br("2026-11-19T14:00")))).toBe("2026-11-23T14:00"));
  it("antes do Carnaval: sexta 13/02 → quarta 18/02", () =>
    expect(iso(slaDeadline(br("2026-02-13T11:00")))).toBe("2026-02-18T11:00"));
  it("natal em sexta: quinta 24/12/2026 → segunda 28/12", () =>
    expect(iso(slaDeadline(br("2026-12-24T16:30")))).toBe("2026-12-28T16:30"));
  it("independe do fuso da máquina (entrada em UTC)", () =>
    expect(slaDeadline(new Date("2026-10-20T13:00:00Z")).toISOString()).toBe("2026-10-21T13:00:00.000Z"));
});

describe("slaStatus", () => {
  const dl = br("2026-10-21T10:00");
  it("no prazo", () => expect(slaStatus(dl, br("2026-10-21T05:00"))).toBe("no_prazo"));
  it("vencendo (< 4h)", () => expect(slaStatus(dl, br("2026-10-21T06:30"))).toBe("vencendo"));
  it("estourado", () => expect(slaStatus(dl, br("2026-10-21T10:01"))).toBe("estourado"));
  it("respondido vence tudo", () => expect(slaStatus(dl, br("2026-10-22T00:00"), br("2026-10-21T09:00"))).toBe("respondido"));
});

describe("formatCountdown", () => {
  it("formata", () => {
    expect(formatCountdown(3 * 3600_000 + 12 * 60_000)).toBe("3h 12min");
    expect(formatCountdown(-(65 * 60_000))).toBe("−1h 05min");
    expect(formatCountdown(90_000)).toBe("1min 30s");
  });
});
