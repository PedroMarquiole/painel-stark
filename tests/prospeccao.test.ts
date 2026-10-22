import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import {
  atrasado, lerTexto, lerXlsx, linkEmail, linkLinkedin, linkWhatsapp, mapearColunas, mensagemSugerida, ordenarHoje, paraHoje, paraImportar, preencher,
} from "@/lib/prospeccao";
import type { ModeloProspeccao, Prospect } from "@/lib/dados/tipos";

const p = (x: Partial<Prospect>): Prospect => ({
  id: "1", empresa: "Construtora Lima", pessoa: "Renata Albuquerque", cargo: null, email: null, whatsapp: null, linkedin: null, instagram: null,
  site: null, cidade: null, segmento: null, porque: null, canal: "linkedin", origem: "x", lista_id: null, lista_nome: null, responsavel_id: null,
  situacao: "contatado", toques: 1, proximo_contato: "2026-10-21", ultimo_contato_em: null, encerrado_em: null, motivo_encerramento: null,
  negocio_id: null, created_at: "2026-10-01T10:00:00Z", ultima_resposta: null, ...x,
});

describe("Hoje", () => {
  it("entra quem está ativo com contato até hoje; encerrado não entra", () => {
    expect(paraHoje(p({}), "2026-10-21")).toBe(true);
    expect(paraHoje(p({ proximo_contato: "2026-10-22" }), "2026-10-21")).toBe(false);
    expect(paraHoje(p({ situacao: "sem_interesse" }), "2026-10-21")).toBe(false);
    expect(atrasado(p({ proximo_contato: "2026-10-19" }), "2026-10-21")).toBe(true);
  });
  it("ordem: atrasados, quem respondeu, acompanhamentos, a abordar", () => {
    const xs = [
      p({ id: "abordar", situacao: "a_abordar", toques: 0 }),
      p({ id: "acomp", situacao: "acompanhamento" }),
      p({ id: "resp", situacao: "respondeu" }),
      p({ id: "atrasado", proximo_contato: "2026-10-18" }),
    ];
    expect(ordenarHoje(xs, "2026-10-21").map((x) => x.id)).toEqual(["atrasado", "resp", "acomp", "abordar"]);
  });
});

describe("mensagem sugerida", () => {
  const modelos: ModeloProspeccao[] = [
    { canal: "linkedin", toque: 1, texto: "Oi, {{pessoa}}! Sou {{seu_nome}}. {{empresa}}" },
    { canal: "linkedin", toque: 2, texto: "2º para {{pessoa}}" },
  ];
  it("usa o modelo do canal e do número do contato, com o primeiro nome", () => {
    expect(mensagemSugerida(p({ toques: 0 }), modelos, "Pedro Marquiole")).toEqual({ n: 1, texto: "Oi, Renata! Sou Pedro. Construtora Lima", assunto: "Stark · Construtora Lima" });
    expect(mensagemSugerida(p({ toques: 1 }), modelos, "Pedro")?.texto).toBe("2º para Renata");
  });
  it("sem pessoa, cumprimento neutro", () => {
    expect(preencher("Oi, {{pessoa}}!", { pessoa: null, empresa: "X" }, "Pedro")).toBe("Oi, pessoal!");
  });
});

describe("links", () => {
  it("monta LinkedIn, WhatsApp com texto e e-mail", () => {
    expect(linkLinkedin("linkedin.com/in/renata")).toBe("https://linkedin.com/in/renata");
    expect(linkLinkedin("renata")).toBe("https://www.linkedin.com/in/renata");
    expect(linkWhatsapp("+5511981234455", "Oi, tudo bem?")).toBe("https://wa.me/5511981234455?text=Oi%2C%20tudo%20bem%3F");
    expect(linkEmail("a@b.com", "Assunto x")).toBe("mailto:a@b.com?subject=Assunto%20x");
  });
});

describe("planilha", () => {
  it("lê CSV com ponto e vírgula, aspas e acentos", () => {
    const t = '﻿Empresa;Nome do contato;E-mail;Observação\r\n"Lima; Filhos";Renata;r@x.com;"disse ""talvez"""\r\n';
    expect(lerTexto(t)).toEqual([["Empresa", "Nome do contato", "E-mail", "Observação"], ["Lima; Filhos", "Renata", "r@x.com", 'disse "talvez"']]);
  });
  it("lê texto colado do Excel (tabulação)", () => {
    expect(lerTexto("Empresa\tCidade\nPadaria\tJundiaí\n\n")).toEqual([["Empresa", "Cidade"], ["Padaria", "Jundiaí"]]);
  });
  it("liga colunas pelo nome do cabeçalho", () => {
    expect(mapearColunas(["Razão social", "Nome", "Cargo", "E-mail", "Celular", "LinkedIn", "Site", "Município", "Setor", "Obs", "Coluna X"]))
      .toEqual(["empresa", "pessoa", "cargo", "email", "whatsapp", "linkedin", "site", "cidade", "segmento", "porque", null]);
  });
  it("transforma linhas em objetos para importar", () => {
    const mapa = mapearColunas(["Empresa", "Contato", "WhatsApp"]);
    expect(paraImportar([["Lima", "Renata", "11 98123-4455"]], mapa)).toEqual([{ empresa: "Lima", pessoa: "Renata", whatsapp: "11 98123-4455" }]);
  });
  it("lê a primeira aba de um .xlsx (textos compartilhados e inline, colunas puladas)", () => {
    const shared = `<sst><si><t>Empresa</t></si><si><t>Cidade</t></si><si><r><t>Lima &amp; </t></r><r><t>Filhos</t></r></si></sst>`;
    const sheet = `<worksheet><sheetData>
      <row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>
      <row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>42</v></c><c r="C2" t="inlineStr"><is><t>Jundiaí</t></is></c></row>
    </sheetData></worksheet>`;
    const z = zipSync({ "xl/sharedStrings.xml": strToU8(shared), "xl/worksheets/sheet1.xml": strToU8(sheet) });
    expect(lerXlsx(z)).toEqual([["Empresa", "", "Cidade"], ["Lima & Filhos", "42", "Jundiaí"]]);
  });
});

describe("simulação do próximo passo (igual ao banco)", () => {
  it("+3 e +4 dias úteis e encerra no 3º sem resposta", async () => {
    const { simularToque, somarDiasUteis } = await import("@/lib/prospeccao");
    // 2026-10-23 é sexta: +3 dias úteis = quarta 28
    expect(somarDiasUteis("2026-10-23", 3)).toBe("2026-10-28");
    const a = p({ toques: 0, situacao: "a_abordar" });
    expect(simularToque(a, "enviada", [3, 4], "2026-10-23")).toMatchObject({ toques: 1, situacao: "contatado", proximo_contato: "2026-10-28" });
    expect(simularToque(p({ toques: 1 }), "enviada", [3, 4], "2026-10-23")).toMatchObject({ toques: 2, situacao: "acompanhamento", proximo_contato: "2026-10-29" });
    expect(simularToque(p({ toques: 2 }), "enviada", [3, 4], "2026-10-23")).toMatchObject({ toques: 3, situacao: "sem_interesse", proximo_contato: null });
    expect(simularToque(p({}), "depois", [3, 4], "2026-10-23", "2026-11-10")).toMatchObject({ proximo_contato: "2026-11-10" });
  });
});
