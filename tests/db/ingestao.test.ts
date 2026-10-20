import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createDb } from "./harness";

let db: PGlite;
const ANA = "00000000-0000-0000-0000-0000000000a1"; // admin
const RAFA = "00000000-0000-0000-0000-0000000000c1"; // comercial
const BIA = "00000000-0000-0000-0000-0000000000c2"; // comercial

type Res = { ok: boolean; numero: number; lead_id: string; contato_id: string; negocio_id: string; duplicado: boolean; contato_novo: boolean; negocio_novo: boolean };

const base = {
  nome: "Marina Albuquerque",
  email: "Marina@ClinicaVitta.com.br",
  whatsapp: "(11) 98765-4321",
  empresa: "Clínica Vitta",
  servicos: ["sistemas_web", "automacao_ia"],
  situacao_atual: "sistema_nao_atende",
  dor: "Agendamento é feito em 3 lugares e a recepção perde 2h por dia conferindo.",
  consentimento: true,
};

async function registrar(p: Record<string, unknown>) {
  const r = await db.query<{ r: Res }>(`select registrar_lead($1::jsonb) as r`, [JSON.stringify(p)]);
  return r.rows[0].r;
}
const erro = (p: Record<string, unknown>) => registrar(p).then(() => "ok", (e: Error) => e.message);

beforeAll(async () => {
  db = await createDb();
  await db.query(`insert into auth.users (id, email) values ($1, 'ana@stark.dev.br'), ($2, 'rafa@stark.dev.br'), ($3, 'bia@stark.dev.br')`, [ANA, RAFA, BIA]);
}, 60_000);

beforeEach(async () => {
  await db.exec(`truncate leads, negocios, contatos, empresas, atividades, mensagens_saida, notificacoes, automacoes_execucoes, ingest_rate_limit, demo_registros cascade`);
});

describe("registrar_lead", () => {
  it("cria contato, negócio e lead com protocolo, normalizando e-mail e WhatsApp", async () => {
    const r = await registrar(base);
    expect(r).toMatchObject({ ok: true, duplicado: false, contato_novo: true, negocio_novo: true });
    const c = await db.query(`select email, whatsapp from contatos where id = $1`, [r.contato_id]);
    expect(c.rows[0]).toEqual({ email: "marina@clinicavitta.com.br", whatsapp: "+5511987654321" });
    const n = await db.query<{ titulo: string; servicos: string }>(`select titulo, servicos::text from negocios where id = $1`, [r.negocio_id]);
    expect(n.rows[0].titulo).toBe("Sistemas web · Clínica Vitta");
    const l = await db.query<{ consentimento_lgpd_em: Date | null; sla_vence_em: Date }>(`select consentimento_lgpd_em, sla_vence_em from leads where id = $1`, [r.lead_id]);
    expect(l.rows[0].consentimento_lgpd_em).not.toBeNull();
  });

  it("aceita o contrato antigo do site (servico único em texto vira slug na Edge; descricao = dor)", async () => {
    const r = await registrar({ ...base, servicos: ["dashboards"], dor: undefined, descricao: "Fechamento do mês demora uma semana." });
    expect(r.ok).toBe(true);
  });

  it("mesmo envio (chave de idempotência) devolve o mesmo protocolo sem duplicar nada", async () => {
    const a = await registrar({ ...base, chave_idempotencia: "envio-1" });
    const b = await registrar({ ...base, chave_idempotencia: "envio-1" });
    expect(b).toMatchObject({ duplicado: true, numero: a.numero, lead_id: a.lead_id });
    const n = await db.query<{ n: number }>(`select count(*)::int n from mensagens_saida where destino_tipo = 'cliente'`);
    expect(n.rows[0].n).toBe(1);
  });

  it("dedup: mesmo e-mail ou mesmo WhatsApp = mesmo cliente e mesmo negócio aberto", async () => {
    const a = await registrar(base);
    const b = await registrar({ ...base, email: "outro@email.com", servicos: ["dashboards"] }); // mesmo WhatsApp
    const c = await registrar({ ...base, whatsapp: "+55 21 99999-0000" }); // mesmo e-mail
    expect(new Set([a.contato_id, b.contato_id, c.contato_id]).size).toBe(1);
    expect(new Set([a.negocio_id, b.negocio_id, c.negocio_id]).size).toBe(1);
    expect(b).toMatchObject({ contato_novo: false, negocio_novo: false });
    const n = await db.query<{ servicos: string }>(`select servicos::text from negocios where id = $1`, [a.negocio_id]);
    expect(n.rows[0].servicos).toContain("dashboards");
    expect((await db.query(`select id from leads`)).rows).toHaveLength(3);
  });

  it("cliente com negócio fechado ganha negócio novo", async () => {
    const a = await registrar(base);
    await db.query(`update negocios set etapa = 'perdido', motivo_perda = 'preco' where id = $1`, [a.negocio_id]);
    const b = await registrar(base);
    expect(b.contato_id).toBe(a.contato_id);
    expect(b.negocio_id).not.toBe(a.negocio_id);
  });

  it.each([
    [{ nome: "" }, "nome_invalido"],
    [{ email: "marina@" }, "email_invalido"],
    [{ whatsapp: "123" }, "whatsapp_invalido"],
    [{ whatsapp: "" }, "whatsapp_invalido"],
    [{ dor: "curto" }, "descricao_invalida"],
    [{ consentimento: false }, "consentimento_obrigatorio"],
    [{ servicos: [] }, "servico_invalido"],
    [{ servicos: ["nave_espacial"] }, "servico_invalido"],
    [{ servicos: "sistemas_web" }, "servico_invalido"],
  ])("valida %j → %s", async (patch, codigo) => {
    expect(await erro({ ...base, ...patch })).toContain(codigo);
  });

  it("rate limit: o 6º pedido do mesmo IP em 10 min é barrado", async () => {
    for (let i = 0; i < 5; i++) await registrar({ ...base, email: `p${i}@x.com`, whatsapp: `1198765000${i}`, ip_hash: "ip-a" });
    expect(await erro({ ...base, email: "p9@x.com", whatsapp: "11987650009", ip_hash: "ip-a" })).toContain("muitos_pedidos");
    expect(await erro({ ...base, email: "p8@x.com", whatsapp: "11987650008", ip_hash: "ip-b" })).toBe("ok");
  });

  it("regra 4: rodízio distribui entre quem recebeu há mais tempo", async () => {
    const donos: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await registrar({ ...base, email: `r${i}@x.com`, whatsapp: `1197777000${i}` });
      donos.push((await db.query<{ responsavel_id: string }>(`select responsavel_id from leads where id = $1`, [r.lead_id])).rows[0].responsavel_id);
    }
    expect(new Set(donos).size).toBe(3);
  });

  it("regra 4: cliente que volta fica com o mesmo responsável", async () => {
    const a = await registrar(base);
    await registrar({ ...base, email: "z@x.com", whatsapp: "11911112222" });
    const b = await registrar(base);
    const resp = await db.query<{ responsavel_id: string }>(`select responsavel_id from leads where id = any($1::uuid[]) order by created_at`, [[a.lead_id, b.lead_id]]);
    expect(resp.rows[0].responsavel_id).toBe(resp.rows[1].responsavel_id);
  });

  it("regras 2 e 3: confirmação ao cliente, aviso no painel e e-mail ao responsável", async () => {
    const r = await registrar(base);
    const m = await db.query<{ destino_tipo: string; destinatario: string; assunto: string; corpo: string }>(
      `select destino_tipo, destinatario, assunto, corpo from mensagens_saida order by destino_tipo`);
    const cliente = m.rows.find((x) => x.destino_tipo === "cliente")!;
    expect(cliente.destinatario).toBe("marina@clinicavitta.com.br");
    expect(cliente.assunto).toBe(`Recebemos seu pedido #${String(r.numero).padStart(4, "0")} · Stark`);
    expect(cliente.corpo).toContain("Olá, Marina!");
    expect(cliente.corpo).not.toMatch(/\{\{/);
    expect(m.rows.filter((x) => x.destino_tipo === "equipe")).toHaveLength(1);
    // WhatsApp desligado: nada enfileirado
    expect((await db.query(`select 1 from mensagens_saida where canal = 'whatsapp'`)).rows).toHaveLength(0);
    const notif = await db.query<{ n: number }>(`select count(*)::int n from notificacoes where tipo = 'lead_novo'`);
    expect(notif.rows[0].n).toBe(3);
    const ex = await db.query<{ chave: string; status: string }>(
      `select a.chave, e.status from automacoes_execucoes e join automacoes a on a.id = e.automacao_id order by a.numero`);
    expect(ex.rows).toEqual([
      { chave: "lead_processar", status: "sucesso" },
      { chave: "lead_confirmacao_cliente", status: "sucesso" },
      { chave: "lead_avisar_equipe", status: "sucesso" },
      { chave: "lead_atribuir", status: "sucesso" },
    ]);
  });

  it("opt-out do cliente é honrado", async () => {
    const a = await registrar(base);
    await db.query(`update contatos set opt_out_email = true where id = $1`, [a.contato_id]);
    await db.query(`update mensagens_saida set created_at = now() - interval '2 hours'`); // fora do limite por destinatário
    const b = await registrar(base);
    const m = await db.query<{ status: string }>(`select status from mensagens_saida where chave_idempotencia = $1`, [`lead_confirmacao_cliente:email:${b.lead_id}`]);
    expect(m.rows[0].status).toBe("bloqueada_opt_out");
  });

  it("regra desligada não executa", async () => {
    await db.query(`update automacoes set ativa = false where chave = 'lead_confirmacao_cliente'`);
    await registrar(base);
    expect((await db.query(`select 1 from mensagens_saida where destino_tipo = 'cliente'`)).rows).toHaveLength(0);
    await db.query(`update automacoes set ativa = true where chave = 'lead_confirmacao_cliente'`);
  });
});

describe("correções da revisão: abuso do formulário público", () => {
  it("confirmação não repete o texto livre do visitante nem URLs no nome", async () => {
    await registrar({ ...base, nome: "https://phish.example Fulano", dor: "Clique em https://banco-falso.example/login para regularizar." });
    const m = await db.query<{ corpo: string }>(`select corpo from mensagens_saida where destino_tipo = 'cliente'`);
    expect(m.rows[0].corpo).not.toMatch(/https?:|banco-falso|phish\.example/);
  });

  it("no máximo 1 confirmação por e-mail por hora", async () => {
    await registrar(base);
    await registrar({ ...base, dor: "Outro pedido do mesmo e-mail, logo em seguida." });
    const m = await db.query<{ n: number }>(`select count(*)::int n from mensagens_saida where destino_tipo = 'cliente'`);
    expect(m.rows[0].n).toBe(1);
    const e = await db.query<{ status: string }>(
      `select e.status from automacoes_execucoes e join automacoes a on a.id = e.automacao_id where a.chave = 'lead_confirmacao_cliente' order by e.created_at`);
    expect(e.rows.map((r) => r.status)).toEqual(["sucesso", "ignorada"]);
  });

  it("teto global barra rajada vinda de IPs diferentes; pedido sem IP também conta", async () => {
    await db.query(`update app_config set valor = '3' where chave = 'ingest_limite_global_10min'`);
    for (let i = 0; i < 3; i++) await registrar({ ...base, email: `g${i}@x.com`, whatsapp: `1196666000${i}`, ip_hash: `ip-${i}` });
    expect(await erro({ ...base, email: "g9@x.com", whatsapp: "11966660009" })).toContain("muitos_pedidos");
    await db.query(`update app_config set valor = '60' where chave = 'ingest_limite_global_10min'`);
  });

  it("formulário público não anexa e-mail/WhatsApp novos a um cliente existente", async () => {
    await db.query(`insert into contatos (nome, email) values ('Cliente Antigo', 'antigo@cliente.com')`);
    await registrar({ ...base, email: "antigo@cliente.com", whatsapp: "11955554444" });
    const c = await db.query<{ whatsapp: string | null }>(`select whatsapp from contatos where email = 'antigo@cliente.com'`);
    expect(c.rows[0].whatsapp).toBeNull();
  });

  it("responsável desativado: novo pedido do mesmo cliente passa para alguém ativo", async () => {
    const a = await registrar(base);
    const dono = (await db.query<{ responsavel_id: string }>(`select responsavel_id from negocios where id = $1`, [a.negocio_id])).rows[0].responsavel_id;
    await db.query(`update profiles set ativo = false where id = $1`, [dono]);
    await registrar({ ...base, dor: "Segundo pedido depois que o responsável saiu." });
    const n = await db.query<{ responsavel_id: string }>(`select responsavel_id from negocios where id = $1`, [a.negocio_id]);
    expect(n.rows[0].responsavel_id).not.toBe(dono);
    await db.query(`update profiles set ativo = true where id = $1`, [dono]);
  });
});

describe("regra 5: verificar_sla", () => {
  it("alerta 4h, 1h e estourado uma única vez cada", async () => {
    const r = await registrar(base);
    const sla = async (horas: number) => {
      await db.query(`update leads set sla_vence_em = now() + make_interval(mins => $2) where id = $1`, [r.lead_id, Math.round(horas * 60)]);
      return (await db.query<{ n: number }>(`select verificar_sla() as n`)).rows[0].n;
    };
    expect(await sla(10)).toBe(0);
    expect(await sla(3)).toBe(1);
    expect(await sla(3)).toBe(0); // idempotente
    expect(await sla(0.5)).toBe(1);
    expect(await sla(-1)).toBe(1);
    expect(await sla(-2)).toBe(0);
    const tipos = await db.query<{ tipo: string }>(`select distinct tipo from notificacoes where tipo like 'sla%' order by tipo`);
    expect(tipos.rows.map((x) => x.tipo)).toEqual(["sla_critico", "sla_estourado", "sla_vencendo"]);
  });

  it("lead que já entra vencido na varredura recebe só o alerta de estourado", async () => {
    const r = await registrar(base);
    await db.query(`update leads set sla_vence_em = now() - interval '2 hours' where id = $1`, [r.lead_id]);
    expect((await db.query<{ n: number }>(`select verificar_sla() as n`)).rows[0].n).toBe(1);
    const t = await db.query<{ tipo: string }>(`select distinct tipo from notificacoes where tipo like 'sla%'`);
    expect(t.rows.map((x) => x.tipo)).toEqual(["sla_estourado"]);
    const m = await db.query<{ corpo: string }>(`select corpo from mensagens_saida where template_chave = 'sla.alerta.equipe.email'`);
    expect(m.rows.every((x) => x.corpo.includes("prazo vencido"))).toBe(true);
    expect((await db.query<{ n: number }>(`select verificar_sla() as n`)).rows[0].n).toBe(0);
  });

  it("leads de demonstração não geram alertas", async () => {
    const r = await registrar(base);
    await db.query(`insert into demo_registros values ('leads', $1)`, [r.lead_id]);
    await db.query(`update leads set sla_vence_em = now() - interval '2 hours' where id = $1`, [r.lead_id]);
    expect((await db.query<{ n: number }>(`select verificar_sla() as n`)).rows[0].n).toBe(0);
    await db.exec(`truncate demo_registros`);
  });

  it("lead respondido não gera alerta", async () => {
    const r = await registrar(base);
    await db.query(`update leads set sla_vence_em = now() + interval '1 hour' where id = $1`, [r.lead_id]);
    await db.query(`insert into atividades (tipo, canal, direcao, contato_id, autor_id, titulo) values ('mensagem', 'email', 'saida', $1, $2, 'Oi')`, [r.contato_id, RAFA]);
    expect((await db.query<{ n: number }>(`select verificar_sla() as n`)).rows[0].n).toBe(0);
  });
});

describe("painel: responder e criar manualmente", () => {
  it("responder_lead fecha o SLA e entra na fila", async () => {
    const r = await registrar(base);
    await asUser(db, RAFA, () => db.query(`select responder_lead($1, 'email', 'Oi Marina', 'Vamos conversar?')`, [r.lead_id]));
    const l = await db.query<{ primeira_resposta_por: string; status: string }>(`select primeira_resposta_por, status from leads where id = $1`, [r.lead_id]);
    expect(l.rows[0]).toEqual({ primeira_resposta_por: RAFA, status: "em_atendimento" });
    const m = await db.query(`select 1 from mensagens_saida where assunto = 'Oi Marina' and status = 'pendente'`);
    expect(m.rows).toHaveLength(1);
  });

  it("responder_lead: Projetos/Dev não envia; cliente com opt-out é erro e não fecha o SLA", async () => {
    const r = await registrar(base);
    const DEV = "00000000-0000-0000-0000-0000000000d9";
    await db.query(`insert into auth.users (id, email) values ($1, 'dev9@stark.dev.br') on conflict do nothing`, [DEV]);
    await db.query(`update profiles set papel = 'projetos' where id = $1`, [DEV]);
    await expect(asUser(db, DEV, () => db.query(`select responder_lead($1, 'email', 'x', 'y')`, [r.lead_id]))).rejects.toThrow(/sem_permissao/);
    await db.query(`update contatos set opt_out_email = true where id = $1`, [r.contato_id]);
    await expect(asUser(db, RAFA, () => db.query(`select responder_lead($1, 'email', 'x', 'y')`, [r.lead_id]))).rejects.toThrow(/opt_out/);
    const l = await db.query<{ primeira_resposta_em: Date | null }>(`select primeira_resposta_em from leads where id = $1`, [r.lead_id]);
    expect(l.rows[0].primeira_resposta_em).toBeNull();
  });

  it("criar_lead_manual dispensa consentimento e marca origem manual", async () => {
    const r = await asUser(db, RAFA, () =>
      db.query<{ r: Res }>(`select criar_lead_manual($1::jsonb) as r`, [JSON.stringify({ ...base, consentimento: false, whatsapp: "" })]));
    const l = await db.query(`select origem_ingestao from leads where id = $1`, [r.rows[0].r.lead_id]);
    expect(l.rows[0]).toEqual({ origem_ingestao: "manual" });
  });

  it("usuário comum não chama registrar_lead direto", async () => {
    await expect(asUser(db, RAFA, () => db.query(`select registrar_lead('{}'::jsonb)`))).rejects.toThrow(/permission denied/);
  });
});

describe("outbox", () => {
  it("reserva, conclui com sucesso e registra na linha do tempo; erro reagenda com espera", async () => {
    const r = await registrar(base);
    const lote = await db.query<{ id: string; destino_tipo: string }>(`select id, destino_tipo from reservar_mensagens(10)`);
    expect(lote.rows.length).toBe(2);
    expect((await db.query(`select id from reservar_mensagens(10)`)).rows).toHaveLength(0); // já reservadas
    const cliente = lote.rows.find((x) => x.destino_tipo === "cliente")!;
    const equipe = lote.rows.find((x) => x.destino_tipo === "equipe")!;
    await db.query(`select concluir_mensagem($1, true, 'resend', 'abc')`, [cliente.id]);
    await db.query(`select concluir_mensagem($1, false, null, null, 'timeout')`, [equipe.id]);
    const tl = await db.query(`select 1 from atividades where lead_id = $1 and tipo = 'mensagem' and automatica`, [r.lead_id]);
    expect(tl.rows).toHaveLength(1);
    const e = await db.query<{ status: string; atrasou: boolean }>(`select status, agendada_para > now() as atrasou from mensagens_saida where id = $1`, [equipe.id]);
    expect(e.rows[0]).toEqual({ status: "erro", atrasou: true });
    // confirmação automática NÃO fecha o SLA
    const l = await db.query<{ primeira_resposta_em: Date | null }>(`select primeira_resposta_em from leads where id = $1`, [r.lead_id]);
    expect(l.rows[0].primeira_resposta_em).toBeNull();
  });
});

describe("outbox: travadas e falha definitiva", () => {
  it("mensagem em envio só é retomada 10 min depois da reserva; falha final avisa os admins", async () => {
    await registrar(base);
    const lote = await db.query<{ id: string }>(`select id from reservar_mensagens(10)`);
    expect(lote.rows.length).toBeGreaterThan(0);
    // agendada_para antiga não basta: o que conta é a hora da reserva
    await db.query(`update mensagens_saida set agendada_para = now() - interval '1 hour'`);
    expect((await db.query(`select id from reservar_mensagens(10)`)).rows).toHaveLength(0);
    await db.query(`update mensagens_saida set reservada_em = now() - interval '11 minutes'`);
    expect((await db.query(`select id from reservar_mensagens(10)`)).rows.length).toBe(lote.rows.length);

    const id = lote.rows[0].id;
    await db.query(`update mensagens_saida set tentativas = max_tentativas where id = $1`, [id]);
    await db.query(`select concluir_mensagem($1, false, null, null, 'resend 422: domínio inválido')`, [id]);
    const n = await db.query<{ n: number }>(`select count(*)::int n from notificacoes where tipo = 'envio_falhou'`);
    expect(n.rows[0].n).toBeGreaterThan(0);
    const e = await db.query<{ status: string }>(`select e.status from automacoes_execucoes e join mensagens_saida m on m.execucao_id = e.id where m.id = $1`, [id]);
    expect(e.rows[0].status).toBe("erro");
  });

  it("notificações não vão para quem está desativado", async () => {
    const n = await db.query<{ n: number }>(`select notificar(array[$1, $2]::uuid[], 'teste', 't', null, null) n`, [ANA, RAFA]);
    expect(n.rows[0].n).toBe(2);
    await db.query(`update profiles set ativo = false where id = $1`, [RAFA]);
    const m = await db.query<{ n: number }>(`select notificar(array[$1, $2]::uuid[], 'teste', 't', null, null) n`, [ANA, RAFA]);
    expect(m.rows[0].n).toBe(1);
    await db.query(`update profiles set ativo = true where id = $1`, [RAFA]);
  });
});

describe("utilitários", () => {
  it.each([
    ["(11) 98765-4321", "+5511987654321"],
    ["11987654321", "+5511987654321"],
    ["+55 11 98765-4321", "+5511987654321"],
    ["011 98765-4321", "+5511987654321"],
    ["(31) 3333-4444", "+553133334444"],
    ["+1 415 555 0100", "+14155550100"],
    ["123", null],
  ])("normalizar_whatsapp(%s)", async (entrada, saida) => {
    expect((await db.query<{ v: string | null }>(`select normalizar_whatsapp($1) v`, [entrada])).rows[0].v).toBe(saida);
  });

  it("horário comercial: sábado → segunda 08:00; terça 22h → quarta 08:00; dentro → igual", async () => {
    const q = async (ts: string) =>
      (await db.query<{ v: string }>(`select to_char(proximo_horario_comercial($1::timestamptz) at time zone 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI') v`, [ts])).rows[0].v;
    expect(await q("2026-10-24T10:00:00-03:00")).toBe("2026-10-26 08:00");
    expect(await q("2026-10-20T22:00:00-03:00")).toBe("2026-10-21 08:00");
    expect(await q("2026-10-20T14:30:00-03:00")).toBe("2026-10-20 14:30");
    expect(await q("2026-11-19T20:00:00-03:00")).toBe("2026-11-23 08:00"); // 20/11 feriado
  });
});
