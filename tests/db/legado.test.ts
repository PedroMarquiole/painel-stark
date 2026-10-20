import { describe, expect, it } from "vitest";
import { createDb } from "./harness";

describe("migração a partir do painel anterior (stark-dashboard)", () => {
  it("arquiva o legado no schema legado, mantém o login como admin e preserva jobs alheios", async () => {
    const db = await createDb({ legado: true });

    const antigos = await db.query<{ n: number }>(
      `select count(*)::int as n from pg_tables where schemaname = 'public' and tablename in ('pedidos', 'equipe', 'clientes')`);
    expect(antigos.rows[0].n).toBe(0);
    const arquivadas = await db.query<{ tablename: string }>(`select tablename from pg_tables where schemaname = 'legado' order by 1`);
    expect(arquivadas.rows.map((r) => r.tablename)).toEqual(["atividades", "equipe", "pedidos"]);
    expect((await db.query(`select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where proname = 'registrar_pedido' and nspname = 'public'`)).rows).toHaveLength(0);
    expect((await db.query(`select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where typname = 'perfil_acesso' and nspname = 'legado'`)).rows).toHaveLength(1);
    expect((await db.query<{ jobname: string }>(`select jobname from cron.job`)).rows).toEqual([{ jobname: "outro-job" }]);

    const perfis = await db.query(`select email, papel, ativo from profiles`);
    expect(perfis.rows).toEqual([{ email: "dono@stark.dev.br", papel: "admin", ativo: true }]);

    // novo usuário criado depois usa o gatilho novo
    await db.query(`insert into auth.users (id, email) values ('22222222-2222-2222-2222-222222222222', 'rafa@stark.dev.br')`);
    const novo = await db.query(`select papel, ativo from profiles where email = 'rafa@stark.dev.br'`);
    expect(novo.rows).toEqual([{ papel: "comercial", ativo: true }]);
  }, 60_000);
});
