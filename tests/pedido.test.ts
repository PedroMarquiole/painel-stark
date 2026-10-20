import { describe, expect, it } from "vitest";
import { erroDoBanco, normalizarPedido, servicoParaSlug, situacaoParaSlug } from "../supabase/functions/_shared/pedido.ts";
import { emailHtml } from "../supabase/functions/_shared/email.ts";

describe("servicoParaSlug: rótulos do site atual e do briefing", () => {
  it.each([
    ["Sistemas web", "sistemas_web"],
    ["Aplicativos Android e iOS", "aplicativo"],
    ["Aplicativo", "aplicativo"],
    ["Automação e IA", "automacao_ia"],
    ["Integrações e APIs", "integracoes_apis"],
    ["Sites e landing pages", "site_landing"],
    ["Site ou landing page", "site_landing"],
    ["Lojas virtuais", "loja_virtual"],
    ["Dashboards", "dashboards"],
    ["Evolução contínua (suporte e manutenção)", "evoluir_existente"],
    ["Evoluir o que já existe", "evoluir_existente"],
    ["sistemas_web", "sistemas_web"],
    ["Foguete", null],
  ])("%s → %s", (r, s) => expect(servicoParaSlug(r)).toBe(s));
});

describe("situacaoParaSlug", () => {
  it.each([
    ["Na mão ou no WhatsApp", "manual_whatsapp"],
    ["Em planilhas", "planilhas"],
    ["Um sistema que não atende", "sistema_nao_atende"],
    ["Ainda não existe", "nao_existe"],
    ["", null],
  ])("%s → %s", (r, s) => expect(situacaoParaSlug(r)).toBe(s));
});

describe("normalizarPedido", () => {
  const atual = {
    nome: "Marina", email: "m@x.com", whatsapp: "11987654321", empresa: "Vitta", servico: "Sistemas web",
    descricao: "Agendamento em 3 lugares", prazo: "1 mês", investimento: "R$ 20–50 mil", origem: "google",
    utm_source: "google", consentimento: true, website: "",
  };

  it("contrato atual do site", () => {
    const r = normalizarPedido(atual, { ipHash: "h", userAgent: "UA" });
    expect(r.tipo).toBe("ok");
    if (r.tipo !== "ok") return;
    expect(r.payload).toMatchObject({ servicos: ["sistemas_web"], dor: "Agendamento em 3 lugares", origem: "google", consentimento: true, ip_hash: "h" });
  });

  it("formato do briefing com vários serviços, situação e simulador", () => {
    const r = normalizarPedido(
      { ...atual, servico: undefined, servicos: ["Automação e IA", "Dashboards", "Dashboards"], situacao_atual: "Em planilhas",
        dor: "Planilhas", simulador: { pessoas: 4, horas_semana: 6, lixo: { a: 1 } }, id_envio: "abc" },
      {},
    );
    if (r.tipo !== "ok") throw new Error(r.tipo);
    expect(r.payload).toMatchObject({
      servicos: ["automacao_ia", "dashboards"], situacao_atual: "planilhas", dor: "Planilhas",
      simulador: { pessoas: 4, horas_semana: 6 }, chave_idempotencia: "site:abc",
    });
  });

  it("perguntas novas do site vão para extras", () => {
    const r = normalizarPedido({ ...atual, decisor: "Sócio", qtd_usuarios: "10", "<script>": "x" }, {});
    if (r.tipo !== "ok") throw new Error(r.tipo);
    expect(r.payload.extras).toEqual({ decisor: "Sócio", qtd_usuarios: "10" });
  });

  it("campo-isca preenchido = robô", () => expect(normalizarPedido({ ...atual, website: "spam.com" }, {}).tipo).toBe("isca"));
  it("serviço desconhecido", () => expect(normalizarPedido({ ...atual, servico: "Foguete" }, {})).toMatchObject({ erro: "servico_invalido", status: 400 }));
  it("corpo inválido", () => expect(normalizarPedido([1, 2], {})).toMatchObject({ erro: "json" }));
  it("consentimento só vale como booleano true", () => {
    const r = normalizarPedido({ ...atual, consentimento: "sim" }, {});
    if (r.tipo !== "ok") throw new Error(r.tipo);
    expect(r.payload.consentimento).toBe(false);
  });
});

describe("erroDoBanco", () => {
  it("traduz códigos e esconde o resto", () => {
    expect(erroDoBanco("ERROR: muitos_pedidos")).toMatchObject({ status: 429, erro: "muitos_pedidos" });
    expect(erroDoBanco("relation x does not exist")).toMatchObject({ status: 500, erro: "interno" });
  });
});

describe("emailHtml", () => {
  it("ao cliente: escapa HTML e não cria links", () => {
    const h = emailHtml("Oi <b>Marina</b>\n\nVeja https://phish.example");
    expect(h).toContain("Oi &lt;b&gt;Marina&lt;/b&gt;");
    expect(h).not.toContain("<a ");
  });
  it("à equipe: transforma links do painel", () => {
    const h = emailHtml("Oi <b>Marina</b>\n\nVeja https://painel.stark/leads?id=1", { equipe: true });
    expect(h).toContain("Oi &lt;b&gt;Marina&lt;/b&gt;");
    expect(h).toContain('<a href="https://painel.stark/leads?id=1"');
  });
});
