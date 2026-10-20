import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { asUser, createDb } from "./harness";

describe("dados de demonstração", () => {
  it("seed cria 30 leads coerentes e limpar_demonstracao apaga tudo", async () => {
    const db = await createDb();
    const ADMIN = "00000000-0000-0000-0000-0000000000d1";
    await db.query(`insert into auth.users (id, email) values ($1, 'admin@stark.dev.br'), ('00000000-0000-0000-0000-0000000000d2', 'rafa@stark.dev.br')`, [ADMIN]);
    await db.exec(readFileSync(path.resolve(import.meta.dirname, "../../supabase/seed_demo.sql"), "utf8"));

    const r = await db.query<{ leads: number; ganhos: number; perdidos: number; sem_resp: number; msgs: number; em_dia: number }>(`
      select (select count(*)::int from leads) leads,
             (select count(*)::int from negocios where etapa = 'ganho' and ganho_em < now()) ganhos,
             (select count(*)::int from negocios where etapa = 'perdido' and motivo_perda is not null) perdidos,
             (select count(*)::int from leads where primeira_resposta_em is null) sem_resp,
             (select count(*)::int from mensagens_saida) msgs,
             (select count(*)::int from leads where primeira_resposta_em <= sla_vence_em) em_dia`);
    expect(r.rows[0]).toMatchObject({ leads: 30, ganhos: 6, perdidos: 5, msgs: 0 });
    expect(r.rows[0].sem_resp).toBeGreaterThanOrEqual(6);
    expect(r.rows[0].em_dia).toBeGreaterThan(15);

    const out = await asUser(db, ADMIN, () => db.query<{ r: Record<string, number> }>(`select limpar_demonstracao() r`));
    expect(out.rows[0].r).toEqual({ leads: 30, negocios: 30, contatos: 30, empresas: 30 });
    expect((await db.query(`select 1 from contatos`)).rows).toHaveLength(0);
  }, 60_000);
});
