import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { asUser, createDb } from "./harness";

describe("painel_indicadores", () => {
  it("calcula KPIs coerentes sobre os dados de demonstração e respeita RLS", async () => {
    const db = await createDb();
    const ADMIN = "00000000-0000-0000-0000-0000000000e1";
    await db.query(`insert into auth.users (id, email) values ($1, 'admin@stark.dev.br')`, [ADMIN]);
    await db.exec(readFileSync(path.resolve(import.meta.dirname, "../../supabase/seed_demo.sql"), "utf8"));

    type K = Record<string, any>;
    const k = (await asUser(db, ADMIN, () => db.query<{ k: K }>(`select painel_indicadores(30) k`))).rows[0].k;
    expect(k.leads.atual).toBeGreaterThan(10);
    expect(k.leads.anterior).toBeGreaterThan(5);
    expect(k.sla_pct.atual).toBeGreaterThan(0);
    expect(k.sla_pct.atual).toBeLessThanOrEqual(100);
    expect(k.primeira_resposta_horas.atual).toBeGreaterThan(0);
    expect(k.serie).toHaveLength(8);
    expect(k.funil[0]).toMatchObject({ etapa: "novo" });
    // funil é monotônico (cada etapa ≤ anterior)
    for (let i = 1; i < k.funil.length; i++) expect(k.funil[i].n).toBeLessThanOrEqual(k.funil[i - 1].n);
    expect(k.por_servico.length).toBeGreaterThan(3);
    expect(k.pipeline_ponderado).toBeGreaterThan(0);
    expect(k.sla_agora.abertos).toBeGreaterThanOrEqual(k.sla_agora.estourados);

    // anônimo não executa
    await expect(asUser(db, null, () => db.query(`select painel_indicadores(30)`))).rejects.toThrow(/permission denied/);
  }, 60_000);
});
