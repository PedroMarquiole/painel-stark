import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createDb } from "./harness";

let db: PGlite;
const DONO = "00000000-0000-0000-0000-0000000000a1"; // admin (1ª conta)
const SOCIO = "00000000-0000-0000-0000-0000000000c1"; // comercial
const DEV = "00000000-0000-0000-0000-0000000000d1"; // projetos (só lê)

const q = <T = Record<string, unknown>>(sql: string, args: unknown[] = []) => db.query<T>(sql, args).then((r) => r.rows);
const como = <T>(id: string, fn: () => Promise<T>) => asUser(db, id, fn);
const hoje = async () => (await q<{ d: string }>(`select hoje_sp()::text as d`))[0].d;
const diasUteis = async (n: number) => (await q<{ d: string }>(`select somar_dias_uteis(hoje_sp(), $1)::text as d`, [n]))[0].d;

async function novo(campos: Record<string, unknown> = {}) {
  const c = { empresa: "Construtora Albuquerque Lima", pessoa: "Renata", canal: "linkedin", linkedin: "linkedin.com/in/renata", ...campos };
  const cols = Object.keys(c);
  const r = await q<{ id: string }>(
    `insert into prospects (${cols.join(", ")}, proximo_contato, responsavel_id) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}, hoje_sp(), '${SOCIO}') returning id`,
    Object.values(c),
  );
  return r[0].id;
}
const toque = (id: string, resultado: string, extra: { canal?: string; anotacao?: string; proximo?: string } = {}) =>
  como(SOCIO, () => q<{ r: { situacao: string; proximo_contato: string | null; toques: number } }>(
    `select registrar_toque_prospect($1, $2, $3, $4, $5::date) as r`, [id, extra.canal ?? null, resultado, extra.anotacao ?? null, extra.proximo ?? null],
  )).then((r) => r[0].r);
const estado = async (id: string) => (await q<{ situacao: string; proximo_contato: string | null; toques: number; negocio_id: string | null }>(
  `select situacao, proximo_contato::text, toques, negocio_id from prospects where id = $1`, [id]))[0];

beforeAll(async () => {
  db = await createDb();
  await db.query(`insert into auth.users (id, email) values ($1, 'dono@stark.dev.br'), ($2, 'socio@stark.dev.br'), ($3, 'dev@stark.dev.br')`, [DONO, SOCIO, DEV]);
  await db.query(`update profiles set papel = 'projetos' where id = $1`, [DEV]);
}, 60_000);

beforeEach(async () => {
  await db.exec(`truncate prospeccao_toques, prospects, prospeccao_listas, negocios, contatos, empresas, atividades, notificacoes cascade`);
});

describe("ritmo da prospecção", () => {
  it("1º contato: Contatado, próximo em 3 dias úteis; 2º: Em acompanhamento, +4; 3º sem resposta encerra", async () => {
    const id = await novo();
    let r = await toque(id, "enviada");
    expect(r).toMatchObject({ situacao: "contatado", toques: 1, proximo_contato: await diasUteis(3) });
    r = await toque(id, "enviada");
    expect(r).toMatchObject({ situacao: "acompanhamento", toques: 2, proximo_contato: await diasUteis(4) });
    r = await toque(id, "enviada");
    expect(r).toMatchObject({ situacao: "sem_interesse", toques: 3, proximo_contato: null });
    const p = (await q<{ motivo_encerramento: string }>(`select motivo_encerramento from prospects where id = $1`, [id]))[0];
    expect(p.motivo_encerramento).toMatch(/3 contatos/);
  });

  it("respondeu: vai para Respondeu e volta em 1 dia útil; pediu para falar depois usa a data escolhida", async () => {
    const id = await novo();
    await toque(id, "enviada");
    expect(await toque(id, "respondeu")).toMatchObject({ situacao: "respondeu", proximo_contato: await diasUteis(1) });
    const depois = await diasUteis(10);
    expect(await toque(id, "depois", { proximo: depois })).toMatchObject({ situacao: "respondeu", proximo_contato: depois });
    await expect(toque(id, "depois")).rejects.toThrow(/informe_a_data/);
    await expect(toque(id, "enviada", { proximo: "2020-01-01" })).rejects.toThrow(/data_no_passado/);
  });

  it("o ritmo é configurável e o histórico guarda canal, autor e anotação", async () => {
    await q(`update app_config set valor = '[2, 2, 2]' where chave = 'prospeccao_ritmo'`);
    const id = await novo();
    await toque(id, "enviada", { canal: "whatsapp", anotacao: "mandei áudio" });
    expect((await estado(id)).proximo_contato).toBe(await diasUteis(2));
    for (let i = 0; i < 2; i++) await toque(id, "enviada");
    expect((await estado(id)).situacao).toBe("acompanhamento"); // 4 contatos antes de encerrar com ritmo de 3 intervalos
    const t = await q<{ canal: string; autor_id: string; anotacao: string }>(`select canal, autor_id, anotacao from prospeccao_toques where prospect_id = $1 order by ocorreu_em limit 1`, [id]);
    expect(t[0]).toEqual({ canal: "whatsapp", autor_id: SOCIO, anotacao: "mandei áudio" });
    await q(`update app_config set valor = '[3, 4]' where chave = 'prospeccao_ritmo'`);
  });

  it("dias úteis pulam fim de semana e feriado", async () => {
    // 24/12/2026 é quinta; 25/12 é feriado; 26 e 27 são fim de semana → +1 dia útil = 28/12
    expect((await q<{ d: string }>(`select somar_dias_uteis('2026-12-24', 1)::text as d`))[0].d).toBe("2026-12-28");
  });
});

describe("mudar situação e não abordar mais", () => {
  it("encerrado volta para hoje ao reabrir; não abordar bloqueia novos contatos", async () => {
    const id = await novo();
    await como(SOCIO, () => q(`select mudar_situacao_prospect($1, 'sem_interesse', 'agora não')`, [id]));
    expect((await estado(id)).proximo_contato).toBeNull();
    await como(SOCIO, () => q(`select mudar_situacao_prospect($1, 'acompanhamento')`, [id]));
    expect(await estado(id)).toMatchObject({ situacao: "acompanhamento", proximo_contato: await hoje() });
    await como(SOCIO, () => q(`select mudar_situacao_prospect($1, 'nao_abordar', 'pediu para não ser contatado')`, [id]));
    await expect(toque(id, "enviada")).rejects.toThrow(/nao_abordar/);
  });
});

describe("tem interesse: vira negócio no Funil", () => {
  it("cria contato, empresa e negócio em Em triagem, com o histórico na linha do tempo", async () => {
    const id = await novo({ email: "renata@albuquerque.com.br", porque: "3 obras novas, medição em planilha" });
    await toque(id, "enviada", { anotacao: "convite no LinkedIn" });
    await toque(id, "respondeu");
    const r = (await como(SOCIO, () => q<{ r: { negocio_id: string; contato_id: string } }>(
      `select converter_prospect($1, null, '(11) 98123-4455', array['sistemas_web']::servico[]) as r`, [id])))[0].r;
    const n = (await q<{ etapa: string; titulo: string; responsavel_id: string; probabilidade: number }>(`select etapa, titulo, responsavel_id, probabilidade from negocios where id = $1`, [r.negocio_id]))[0];
    expect(n).toEqual({ etapa: "triagem", titulo: "Sistemas web · Construtora Albuquerque Lima", responsavel_id: SOCIO, probabilidade: 10 });
    const c = (await q<{ email: string; whatsapp: string; nome: string }>(`select email, whatsapp, nome from contatos where id = $1`, [r.contato_id]))[0];
    expect(c).toEqual({ email: "renata@albuquerque.com.br", whatsapp: "+5511981234455", nome: "Renata" });
    const a = (await q<{ titulo: string; corpo: string }>(`select titulo, corpo from atividades where negocio_id = $1 and tipo = 'prospeccao'`, [r.negocio_id]))[0];
    expect(a.titulo).toBe("Veio da prospecção");
    expect(a.corpo).toMatch(/3 obras novas/);
    expect(a.corpo).toMatch(/convite no LinkedIn/);
    expect(await estado(id)).toMatchObject({ situacao: "interessado", negocio_id: r.negocio_id, proximo_contato: null });
    // Não fecha prazo de nada nem cria pedido na caixa de entrada
    expect((await q(`select 1 from leads`)).length).toBe(0);
    // Chamar de novo não duplica
    const de_novo = (await como(SOCIO, () => q<{ r: { ja_existia: boolean } }>(`select converter_prospect($1) as r`, [id])))[0].r;
    expect(de_novo.ja_existia).toBe(true);
    expect((await q(`select 1 from negocios`)).length).toBe(1);
  });

  it("sem e-mail nem WhatsApp não converte; contato existente é reaproveitado", async () => {
    const id = await novo();
    await expect(como(SOCIO, () => q(`select converter_prospect($1)`, [id]))).rejects.toThrow(/precisa_email_ou_whatsapp/);
    await q(`insert into contatos (nome, email) values ('Renata A.', 'renata@x.com')`);
    await como(SOCIO, () => q(`select converter_prospect($1, 'Renata@X.com')`, [id]));
    expect((await q(`select 1 from contatos`)).length).toBe(1);
  });
});

type Importacao = { linhas: { linha: number; status: string }[]; novos: number; repetidos: number; clientes: number; sem_contato: number; sem_empresa: number };

describe("importar planilha", () => {
  const linhas = [
    { empresa: "Metalúrgica Forte Aço", pessoa: "Sérgio", linkedin: "linkedin.com/in/sergio" },
    { empresa: "Plásticos Itupeva", email: "ANA@plasticos.com.br" },
    { empresa: "Plásticos Itupeva (filial)", email: "ana@plasticos.com.br" },          // repetido na própria planilha
    { empresa: "Transportes Lima", whatsapp: "(11) 97000-1379" },                         // já é cliente
    { empresa: "Gráfica Ponto Certo", site: "https://www.pontocerto.com.br/" },            // sem contato
    { pessoa: "Sem empresa", email: "x@y.com" },
    { empresa: "Embalagens Rio Verde", whatsapp: "11998123301" },
  ];
  const importar = (simular: boolean, extra = {}) =>
    como(DONO, () => q<{ r: Importacao }>(
      `select importar_prospects($1::jsonb, 'Indústrias de Jundiaí', 'Pesquisa no LinkedIn', array[$2, $3]::uuid[], 2, $4) as r`,
      [JSON.stringify(linhas), DONO, SOCIO, simular],
    )).then((r) => ({ ...r[0].r, ...extra }));

  beforeEach(async () => {
    await q(`insert into contatos (nome, whatsapp) values ('João', '+5511970001379')`);
  });

  it("simulação mostra o que vai acontecer sem gravar nada", async () => {
    const r = await importar(true);
    expect(r.linhas.map((l) => l.status)).toEqual(["novo", "novo", "repetido", "cliente", "sem_contato", "sem_empresa", "novo"]);
    expect(r).toMatchObject({ novos: 4, repetidos: 1, clientes: 1, sem_contato: 1, sem_empresa: 1 });
    expect((await q(`select 1 from prospects`)).length).toBe(0);
  });

  it("importa, divide entre os dois e espalha 2 por dia útil a partir de amanhã; reimportar não duplica", async () => {
    const r = await importar(false);
    expect(r.novos).toBe(4);
    const ps = await q<{ empresa: string; responsavel_id: string; proximo_contato: string; origem: string; email: string | null; site: string | null }>(
      `select empresa, responsavel_id, proximo_contato::text, origem, email, site from prospects order by created_at, empresa`);
    expect(ps).toHaveLength(4);
    expect(new Set(ps.map((p) => p.responsavel_id))).toEqual(new Set([DONO, SOCIO]));
    expect(ps.every((p) => p.origem === "Pesquisa no LinkedIn")).toBe(true);
    const dias = ps.map((p) => p.proximo_contato).sort();
    expect(dias).toEqual([await diasUteis(1), await diasUteis(1), await diasUteis(2), await diasUteis(2)]);
    expect(ps.find((p) => p.empresa === "Plásticos Itupeva")?.email).toBe("ana@plasticos.com.br");
    expect(ps.find((p) => p.empresa === "Gráfica Ponto Certo")?.site).toBe("pontocerto.com.br");
    expect((await q(`select nome, origem from prospeccao_listas`))).toEqual([{ nome: "Indústrias de Jundiaí", origem: "Pesquisa no LinkedIn" }]);
    const de_novo = await importar(true);
    expect(de_novo.novos).toBe(0);
  });

  it("quem pediu para não ser abordado continua bloqueado em importações futuras", async () => {
    await importar(false);
    const id = (await q<{ id: string }>(`select id from prospects where empresa = 'Metalúrgica Forte Aço'`))[0].id;
    await como(SOCIO, () => q(`select mudar_situacao_prospect($1, 'nao_abordar')`, [id]));
    const r = await importar(true);
    expect(r.linhas[0].status).toBe("nao_abordar");
  });
});

describe("números e aviso das 8h", () => {
  it("indicadores contam hoje, atrasados, contatos da semana e resposta por canal", async () => {
    const a = await novo();
    const b = await novo({ empresa: "Padaria", linkedin: null, canal: "whatsapp", whatsapp: "+5511911112222" });
    await q(`update prospects set proximo_contato = hoje_sp() - 2 where id = $1`, [b]);
    await toque(a, "enviada");
    await toque(a, "respondeu");
    const k = (await como(SOCIO, () => q<{ k: Record<string, unknown> }>(`select prospeccao_indicadores() as k`)))[0].k;
    expect(k).toMatchObject({ hoje: 1, atrasados: 1, contatos_semana: 1, meta_semana: 20, resposta_pct: 100 });
    expect(k.por_canal).toEqual([{ canal: "linkedin", n: 1, pct: 100 }]);
  });

  it("aviso das 8h notifica cada responsável com seus contatos do dia", async () => {
    await novo();
    await novo({ empresa: "Outra", linkedin: "linkedin.com/in/outra" });
    const n = (await q<{ n: number }>(`select avisar_prospeccao_hoje() as n`))[0].n;
    const util = (await q<{ u: boolean }>(`select extract(isodow from hoje_sp()) < 6 and not exists (select 1 from feriados where data = hoje_sp() and conta_no_sla) as u`))[0].u;
    if (!util) return expect(n).toBe(0);
    expect(n).toBe(1);
    expect((await q<{ titulo: string; profile_id: string }>(`select titulo, profile_id from notificacoes`))).toEqual([{ titulo: "2 contatos de prospecção para hoje", profile_id: SOCIO }]);
  });
});

describe("permissões", () => {
  it("Projetos/Dev lê, mas não registra, não muda situação, não converte e não importa", async () => {
    const id = await novo();
    expect((await como(DEV, () => q(`select id from prospects`))).length).toBe(1);
    await expect(como(DEV, () => q(`select registrar_toque_prospect($1, null, 'enviada')`, [id]))).rejects.toThrow(/sem_permissao/);
    await expect(como(DEV, () => q(`select mudar_situacao_prospect($1, 'nao_abordar')`, [id]))).rejects.toThrow(/sem_permissao/);
    await expect(como(DEV, () => q(`select converter_prospect($1, 'a@b.com')`, [id]))).rejects.toThrow(/sem_permissao/);
    await expect(como(DEV, () => q(`select importar_prospects('[]'::jsonb, 'x', 'y', '{}', 5, false)`))).rejects.toThrow(/sem_permissao/);
    const editados = await como(DEV, () => q(`update prospects set empresa = 'X' where id = $1 returning id`, [id]));
    expect(editados).toHaveLength(0);
  });

  it("visitante sem login não lê nada", async () => {
    await novo();
    expect((await asUser(db, null, () => q(`select id from prospects`).catch(() => [])))).toHaveLength(0);
  });
});

describe("ajustes do pente fino (0016)", () => {
  it("contato com quem estava em Sem interesse reabre; 'depois' volta para a lista na data", async () => {
    const id = await novo();
    await toque(id, "sem_interesse");
    const d = await diasUteis(5);
    expect(await toque(id, "depois", { proximo: d })).toMatchObject({ situacao: "contatado", toques: 1, proximo_contato: d });
    const [p] = await q<{ encerrado_em: string | null }>(`select encerrado_em from prospects where id = $1`, [id]);
    expect(p.encerrado_em).toBeNull();
  });
  it("reaberto depois de 3 contatos ganha mais um ciclo", async () => {
    const id = await novo();
    for (let i = 0; i < 3; i++) await toque(id, "enviada");
    expect((await estado(id)).situacao).toBe("sem_interesse");
    await como(SOCIO, () => q(`select mudar_situacao_prospect($1, 'acompanhamento')`, [id]));
    expect((await estado(id)).toques).toBe(2);
    expect(await toque(id, "enviada")).toMatchObject({ situacao: "sem_interesse" }); // um contato a mais, não fecha no reabrir
  });
  it("desfazer devolve data e contatos como estavam", async () => {
    const id = await novo();
    await toque(id, "enviada");
    const antes = await estado(id);
    await como(SOCIO, () => q(`select mudar_situacao_prospect($1, 'sem_interesse')`, [id]));
    await como(SOCIO, () => q(`select desfazer_situacao_prospect($1, $2, $3::date, $4)`, [id, antes.situacao, antes.proximo_contato, antes.toques]));
    expect(await estado(id)).toMatchObject({ situacao: "contatado", proximo_contato: antes.proximo_contato, toques: 1 });
  });
  it("quem respondeu já no 1º contato conta como abordado no % de resposta", async () => {
    const id = await novo({ canal: "whatsapp" });
    await toque(id, "respondeu", { canal: "whatsapp" });
    const [r] = await como(DONO, () => q<{ i: { resposta_pct: number; por_canal: { canal: string; pct: number }[] } }>(`select prospeccao_indicadores() as i`));
    expect(r.i.resposta_pct).toBe(100);
    expect(r.i.por_canal).toEqual([expect.objectContaining({ canal: "whatsapp", pct: 100 })]);
  });
});

describe("enviar e-mail com 1 clique (0017)", () => {
  it("põe o e-mail na fila e registra o contato", async () => {
    const id = await novo({ email: "renata@lima.com.br" });
    const [r] = await como(SOCIO, () => q<{ r: { situacao: string; toques: number; mensagem_id: string } }>(
      `select enviar_email_prospect($1, 'Assunto', 'Corpo') as r`, [id]));
    expect(r.r).toMatchObject({ situacao: "contatado", toques: 1 });
    const [m] = await q<{ destinatario: string; status: string; assunto: string }>(`select destinatario, status, assunto from mensagens_saida where id = $1`, [r.r.mensagem_id]);
    expect(m).toEqual({ destinatario: "renata@lima.com.br", status: "pendente", assunto: "Assunto" });
  });
  it("sem e-mail ou não abordar: recusa", async () => {
    const sem = await novo();
    await expect(como(SOCIO, () => q(`select enviar_email_prospect($1, 'A', 'B')`, [sem]))).rejects.toThrow(/sem_email/);
    const bloq = await novo({ email: "x@y.com", linkedin: "linkedin.com/in/outro" });
    await como(SOCIO, () => q(`select mudar_situacao_prospect($1, 'nao_abordar')`, [bloq]));
    await expect(como(SOCIO, () => q(`select enviar_email_prospect($1, 'A', 'B')`, [bloq]))).rejects.toThrow(/nao_abordar/);
  });
  it("Resend em modo de teste: para na hora e o aviso explica", async () => {
    const [m] = await q<{ id: string }>(`insert into mensagens_saida (canal, destino_tipo, destinatario, corpo, chave_idempotencia) values ('email', 'cliente', 'a@b.com', 'x', 'k1') returning id`);
    await q(`select concluir_mensagem($1, false, null, null, 'resend 403: You can only send testing emails to your own email address')`, [m.id]);
    const [s] = await q<{ tentativas: number; max_tentativas: number }>(`select tentativas, max_tentativas from mensagens_saida where id = $1`, [m.id]);
    expect(s.tentativas).toBe(s.max_tentativas);
    const [n] = await q<{ corpo: string }>(`select corpo from notificacoes where tipo = 'envio_falhou' order by created_at desc limit 1`);
    expect(n.corpo).toMatch(/verifique o domínio/);
  });
});
