import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createDb } from "./harness";
import { slaDeadline } from "@/lib/sla";

let db: PGlite;
const ADMIN = "00000000-0000-0000-0000-00000000000a";
const COMERCIAL = "00000000-0000-0000-0000-00000000000c";
const DEV = "00000000-0000-0000-0000-00000000000d";
const FORA = "00000000-0000-0000-0000-00000000000f";

async function novoContato(email: string, whatsapp: string | null = null) {
  const r = await db.query<{ id: string }>(
    `insert into contatos (nome, email, whatsapp) values ('Teste', $1, $2) returning id`, [email, whatsapp]);
  return r.rows[0].id;
}
async function novoLead(contatoId: string, createdAt = new Date().toISOString()) {
  const r = await db.query<{ id: string; protocolo: number; sla_vence_em: Date }>(
    `insert into leads (contato_id, servicos, dor, nome_informado, created_at)
     values ($1, '{sistemas_web}', 'Planilha manual toma 2h/dia', 'Teste', $2) returning id, protocolo, sla_vence_em`,
    [contatoId, createdAt]);
  return r.rows[0];
}

beforeAll(async () => {
  db = await createDb();
  // Contas criadas pelo admin no Supabase: primeira vira admin, demais comercial, todas ativas.
  await db.query(`insert into auth.users (id, email) values ($1, 'ana@stark.dev.br')`, [ADMIN]);
  await db.query(`insert into auth.users (id, email) values ($1, 'rafa@stark.dev.br')`, [COMERCIAL]);
  await db.query(`insert into auth.users (id, email) values ($1, 'dev@gmail.com')`, [DEV]);
  await db.query(`insert into auth.users (id, email) values ($1, 'ex@stark.dev.br')`, [FORA]);
  await db.query(`update profiles set papel = 'projetos' where id = $1`, [DEV]);
  await db.query(`update profiles set ativo = false where id = $1`, [FORA]); // ex-membro desativado pelo admin
}, 60_000);

describe("migrations", () => {
  it("RLS ligado em todas as tabelas do public", async () => {
    const r = await db.query<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
    expect(r.rows.map((x) => x.relname)).toEqual([]);
  });

  it("perfis: primeira conta é admin, demais comercial, qualquer domínio", async () => {
    const r = await db.query<{ email: string; papel: string; ativo: boolean }>(`select email, papel, ativo from profiles order by email`);
    expect(r.rows).toEqual([
      { email: "ana@stark.dev.br", papel: "admin", ativo: true },
      { email: "dev@gmail.com", papel: "projetos", ativo: true },
      { email: "ex@stark.dev.br", papel: "comercial", ativo: false },
      { email: "rafa@stark.dev.br", papel: "comercial", ativo: true },
    ]);
  });
});

describe("SLA no banco = SLA na UI", () => {
  const casos = [
    "2026-10-20T10:00:00-03:00", "2026-10-23T15:00:00-03:00", "2026-10-24T10:00:00-03:00",
    "2026-11-19T14:00:00-03:00", "2026-02-13T11:00:00-03:00", "2026-12-24T16:30:00-03:00",
    "2026-04-02T09:15:00-03:00", "2026-06-03T10:00:00-03:00", "2026-02-16T08:00:00-03:00", "2027-01-01T08:00:00-03:00", "2026-10-25T23:59:00-03:00",
  ];
  it.each(casos)("%s", async (c) => {
    const r = await db.query<{ d: Date }>(`select sla_deadline($1::timestamptz) as d`, [c]);
    expect(r.rows[0].d.toISOString()).toBe(slaDeadline(new Date(c)).toISOString());
  });

  it("lead recebe protocolo sequencial e prazo calculado pelo banco", async () => {
    const c = await novoContato("sla@cliente.com");
    const a = await novoLead(c, "2026-10-23T15:00:00-03:00");
    const b = await novoLead(c, "2026-10-23T15:05:00-03:00");
    expect(b.protocolo).toBe(a.protocolo + 1);
    expect(a.sla_vence_em.toISOString()).toBe("2026-10-26T18:00:00.000Z");
  });
});

describe("deduplicação", () => {
  it("e-mail é único e sempre minúsculo (a ingestão normaliza)", async () => {
    await novoContato("joao@empresa.com.br");
    await expect(novoContato("joao@empresa.com.br")).rejects.toThrow(/contatos_email_uniq/);
    await expect(novoContato("Maria@Empresa.com.br")).rejects.toThrow(/email_minusculo/);
  });
  it("WhatsApp é único e precisa estar em E.164", async () => {
    await novoContato("a@x.com", "+5511987654321");
    await expect(novoContato("b@x.com", "+5511987654321")).rejects.toThrow(/contatos_whatsapp_uniq/);
    await expect(novoContato("c@x.com", "(11) 98765-4321")).rejects.toThrow(/whatsapp_e164/);
  });
  it("mesmo envio do webhook não vira dois leads (chave de idempotência)", async () => {
    const c = await novoContato("idem@x.com");
    const sql = `insert into leads (contato_id, servicos, dor, nome_informado, chave_idempotencia)
                 values ($1, '{dashboards}', 'x', 'y', 'netlify:abc123') on conflict (chave_idempotencia) do nothing returning id`;
    expect((await db.query(sql, [c])).rows).toHaveLength(1);
    expect((await db.query(sql, [c])).rows).toHaveLength(0);
  });
});

describe("regras de negócio no banco", () => {
  it("resposta humana fecha o SLA; mensagem automática não", async () => {
    const c = await novoContato("resp@x.com");
    const lead = await novoLead(c);
    await db.query(`insert into atividades (tipo, canal, direcao, automatica, contato_id, titulo)
                    values ('mensagem', 'whatsapp', 'saida', true, $1, 'Confirmação automática')`, [c]);
    let r = await db.query<{ primeira_resposta_em: Date | null; status: string }>(`select primeira_resposta_em, status from leads where id = $1`, [lead.id]);
    expect(r.rows[0].primeira_resposta_em).toBeNull();
    await db.query(`insert into atividades (tipo, canal, direcao, contato_id, autor_id, titulo)
                    values ('mensagem', 'whatsapp', 'saida', $1, $2, 'Oi, aqui é o Rafa')`, [c, COMERCIAL]);
    r = await db.query(`select primeira_resposta_em, status from leads where id = $1`, [lead.id]);
    expect(r.rows[0].primeira_resposta_em).not.toBeNull();
    expect(r.rows[0].status).toBe("em_atendimento");
  });

  it("mudar etapa registra atividade, carimba data e aplica probabilidade padrão", async () => {
    const c = await novoContato("funil@x.com");
    const n = await db.query<{ id: string }>(`insert into negocios (titulo, contato_id) values ('Portal', $1) returning id`, [c]);
    const id = n.rows[0].id;
    await db.query(`update negocios set etapa = 'proposta' where id = $1`, [id]);
    const r = await db.query<{ probabilidade: number }>(`select probabilidade from negocios where id = $1`, [id]);
    expect(r.rows[0].probabilidade).toBe(50);
    const a = await db.query<{ titulo: string }>(`select titulo from atividades where negocio_id = $1`, [id]);
    expect(a.rows[0].titulo).toBe("Etapa: Novo → Proposta enviada");
  });

  it("perder negócio exige motivo", async () => {
    const c = await novoContato("perda@x.com");
    const n = await db.query<{ id: string }>(`insert into negocios (titulo, contato_id) values ('App', $1) returning id`, [c]);
    await expect(db.query(`update negocios set etapa = 'perdido' where id = $1`, [n.rows[0].id])).rejects.toThrow(/perda_tem_motivo/);
  });

  it("auditoria guarda só o que mudou", async () => {
    const c = await novoContato("audit@x.com");
    await db.query(`update contatos set cargo = 'CEO' where id = $1`, [c]);
    const r = await db.query<{ alterado: Record<string, unknown> }>(
      `select alterado from auditoria where tabela = 'contatos' and registro_id = $1 and acao = 'UPDATE'`, [c]);
    expect(r.rows[0].alterado).toEqual({ cargo: [null, "CEO"] });
  });
});

describe("RLS", () => {
  it("anon não lê nada", async () => {
    await expect(asUser(db, null, () => db.query(`select * from leads`))).rejects.toThrow(/permission denied/);
  });
  it("membro desativado pelo admin não vê leads", async () => {
    const r = await asUser(db, FORA, () => db.query(`select id from leads`));
    expect(r.rows).toHaveLength(0);
  });
  it("comercial lê e cria leads/contatos", async () => {
    const r = await asUser(db, COMERCIAL, async () => {
      await db.query(`insert into contatos (nome, email) values ('Via RLS', 'rls@x.com')`);
      return db.query(`select id from leads`);
    });
    expect(r.rows.length).toBeGreaterThan(0);
  });
  it("projetos lê o CRM mas não edita contatos", async () => {
    const r = await asUser(db, DEV, () => db.query(`update contatos set cargo = 'x' returning id`));
    expect(r.rows).toHaveLength(0);
  });
  it("financeiro: projetos não vê contratos", async () => {
    await db.query(`insert into contratos (contato_id, tipo, descricao, valor_mensal, inicio)
                    select id, 'recorrente', 'Evolução contínua', 3500, current_date from contatos limit 1`);
    expect((await asUser(db, DEV, () => db.query(`select id from contratos`))).rows).toHaveLength(0);
    expect((await asUser(db, COMERCIAL, () => db.query(`select id from contratos`))).rows).toHaveLength(1);
  });
  it("ninguém se promove a admin", async () => {
    await expect(asUser(db, COMERCIAL, () => db.query(`update profiles set papel = 'admin' where id = $1`, [COMERCIAL])))
      .rejects.toThrow(/Apenas admin/);
  });
  it("auditoria é só do admin", async () => {
    expect((await asUser(db, COMERCIAL, () => db.query(`select id from auditoria`))).rows).toHaveLength(0);
    expect((await asUser(db, ADMIN, () => db.query(`select id from auditoria`))).rows.length).toBeGreaterThan(0);
  });
});
