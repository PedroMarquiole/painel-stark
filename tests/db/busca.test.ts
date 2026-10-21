import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createDb } from "./harness";

let db: PGlite;
const DONO = "00000000-0000-0000-0000-0000000000a1";
const busca = (termo: string) =>
  asUser(db, DONO, () => db.query<{ tipo: string; titulo: string; subtitulo: string }>(`select * from buscar_painel($1)`, [termo]).then((r) => r.rows));

beforeAll(async () => {
  db = await createDb();
  await db.query(`insert into auth.users (id, email) values ($1, 'dono@stark.dev.br')`, [DONO]);
  const e = await db.query<{ id: string }>(`insert into empresas (nome) values ('Clínica Vitta') returning id`);
  await db.query(`insert into contatos (nome, email, whatsapp, empresa_id) values ('Márcia Gonçalves', 'marcia@vitta.com', '+5511981234455', $1)`, [e.rows[0].id]);
  await db.query(`insert into prospects (empresa, pessoa, canal, origem) values ('Padaria São João', 'Zé', 'whatsapp', 'teste')`);
}, 60_000);

describe("busca do ⌘K", () => {
  it("ignora acentos e maiúsculas", async () => {
    expect((await busca("marcia goncalves")).map((r) => r.titulo)).toEqual(["Márcia Gonçalves"]);
    expect((await busca("MÁRCIA")).length).toBe(1);
  });
  it("acha o contato pelo nome da empresa e pelo telefone", async () => {
    expect((await busca("clinica vitta"))[0]).toMatchObject({ tipo: "contato", titulo: "Márcia Gonçalves", subtitulo: "Clínica Vitta · marcia@vitta.com" });
    expect((await busca("98123-4455"))[0]?.titulo).toBe("Márcia Gonçalves");
  });
  it("acha empresas da prospecção", async () => {
    expect(await busca("sao joao")).toEqual([expect.objectContaining({ tipo: "prospect", titulo: "Padaria São João" })]);
  });
  it("termo curto não busca", async () => {
    expect(await busca("a")).toEqual([]);
  });
});
