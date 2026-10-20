// Normaliza o corpo enviado pelo formulário do site para o formato de registrar_lead.
// Sem dependências: roda no Deno (Edge Function) e no Vitest.
//
// Aceita dois formatos:
//  • contrato atual do site (função novo-pedido do painel anterior):
//      nome, email, whatsapp, empresa, servico (rótulo único), descricao, prazo,
//      investimento, origem, utm_*, consentimento (bool), website (campo-isca)
//  • formato do briefing: servicos (lista), situacao_atual, dor, simulador, referrer, landing_page

export type Resultado =
  | { tipo: "ok"; payload: Record<string, unknown> }
  | { tipo: "isca" }
  | { tipo: "erro"; status: number; erro: string; mensagem: string; campo?: string };

export const ERROS: Record<string, [number, string, string?]> = {
  nome_invalido: [400, "Informe seu nome.", "nome"],
  email_invalido: [400, "Confira o e-mail informado.", "email"],
  whatsapp_invalido: [400, "Informe o WhatsApp com DDD.", "whatsapp"],
  descricao_invalida: [400, "Conte um pouco mais sobre o que você precisa (mínimo de 10 caracteres).", "descricao"],
  consentimento_obrigatorio: [400, "É preciso aceitar o aviso de privacidade para enviar.", "consentimento"],
  servico_invalido: [400, "Escolha um dos serviços da lista.", "servico"],
  muitos_pedidos: [429, "Recebemos vários pedidos seus em pouco tempo. Aguarde um pouco ou fale conosco por e-mail."],
};

const sem = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Rótulos do site (atual e do briefing) → enum do banco
const SERVICOS: [RegExp, string][] = [
  [/^sistemas? web|^sistema/, "sistemas_web"],
  [/^aplicativ|^app\b/, "aplicativo"],
  [/^automac|\bia\b|inteligencia artificial/, "automacao_ia"],
  [/^integrac|\bapis?\b/, "integracoes_apis"],
  [/^dashboard|^painel|^bi\b/, "dashboards"],
  [/^site|landing/, "site_landing"],
  [/^loja|e commerce|ecommerce/, "loja_virtual"],
  [/^evolu|manutenc|suporte|existe/, "evoluir_existente"],
];
const SLUGS = new Set(SERVICOS.map(([, s]) => s));

export function servicoParaSlug(rotulo: string): string | null {
  const t = sem(rotulo).replace(/ /g, "_");
  if (SLUGS.has(t)) return t;
  const n = sem(rotulo);
  for (const [re, slug] of SERVICOS) if (re.test(n)) return slug;
  return null;
}

const SITUACOES: [RegExp, string][] = [
  [/whatsapp|na mao|manual/, "manual_whatsapp"],
  [/planilha/, "planilhas"],
  [/nao atende|sistema/, "sistema_nao_atende"],
  [/nao existe|ainda nao/, "nao_existe"],
];
export function situacaoParaSlug(rotulo: string): string | null {
  const n = sem(rotulo);
  if (!n) return null;
  if (["manual_whatsapp", "planilhas", "sistema_nao_atende", "nao_existe"].includes(n.replace(/ /g, "_"))) return n.replace(/ /g, "_");
  for (const [re, slug] of SITUACOES) if (re.test(n)) return slug;
  return null;
}

const txt = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function normalizarPedido(
  body: unknown,
  meta: { ipHash?: string; userAgent?: string; idempotencia?: string; origem?: string },
): Resultado {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { tipo: "erro", status: 400, erro: "json", mensagem: "Pedido inválido." };
  }
  const b = body as Record<string, unknown>;

  // Campo-isca: invisível para pessoas; robôs preenchem. Responde sucesso sem gravar.
  if (typeof b.website === "string" && b.website.trim() !== "") return { tipo: "isca" };

  const rotulos: string[] = Array.isArray(b.servicos)
    ? b.servicos.filter((s): s is string => typeof s === "string")
    : typeof b.servico === "string" && b.servico
      ? [b.servico]
      : [];
  const servicos = rotulos.map(servicoParaSlug);
  if (servicos.length === 0 || servicos.some((s) => s === null)) return erro("servico_invalido");

  const simulador =
    b.simulador && typeof b.simulador === "object" && !Array.isArray(b.simulador)
      ? Object.fromEntries(
          Object.entries(b.simulador as Record<string, unknown>)
            .filter(([, v]) => typeof v === "number" || typeof v === "string")
            .slice(0, 20),
        )
      : undefined;

  const conhecidos = new Set([
    "nome", "email", "whatsapp", "empresa", "servico", "servicos", "situacao_atual", "dor", "descricao", "prazo",
    "investimento", "origem", "consentimento", "website", "simulador", "referrer", "landing_page", "porte",
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "id_envio",
  ]);
  // Perguntas novas do site entram em "extras" sem precisar de deploy (só texto curto)
  const extras = Object.fromEntries(
    Object.entries(b)
      .filter(([k, v]) => !conhecidos.has(k) && /^[a-z_]{1,40}$/.test(k) && typeof v === "string")
      .slice(0, 20)
      .map(([k, v]) => [k, (v as string).slice(0, 500)]),
  );

  return {
    tipo: "ok",
    payload: {
      nome: txt(b.nome, 120),
      email: txt(b.email, 254),
      whatsapp: txt(b.whatsapp, 40),
      empresa: txt(b.empresa, 160),
      servicos: Array.from(new Set(servicos)),
      situacao_atual: situacaoParaSlug(txt(b.situacao_atual, 80)) ?? "",
      dor: txt(b.dor ?? b.descricao, 1200),
      prazo: txt(b.prazo, 120),
      investimento: txt(b.investimento, 120),
      porte: txt(b.porte, 120),
      origem: txt(b.origem, 120),
      consentimento: b.consentimento === true,
      simulador,
      extras,
      utm_source: txt(b.utm_source, 200),
      utm_medium: txt(b.utm_medium, 200),
      utm_campaign: txt(b.utm_campaign, 200),
      utm_term: txt(b.utm_term, 200),
      utm_content: txt(b.utm_content, 200),
      referrer: txt(b.referrer, 500),
      landing_page: txt(b.landing_page, 500),
      origem_ingestao: meta.origem ?? "api",
      chave_idempotencia: meta.idempotencia || (typeof b.id_envio === "string" ? `site:${b.id_envio.slice(0, 80)}` : undefined),
      ip_hash: meta.ipHash,
      user_agent: meta.userAgent?.slice(0, 400),
    },
  };
}

export function erro(codigo: string): Resultado & { tipo: "erro" } {
  const [status, mensagem, campo] = ERROS[codigo] ?? [500, "Não conseguimos registrar agora. Tente de novo em instantes."];
  return { tipo: "erro", status, erro: ERROS[codigo] ? codigo : "interno", mensagem, campo };
}

/** Traduz a exceção do banco (raise exception 'codigo') para a resposta ao visitante. */
export function erroDoBanco(mensagem: string) {
  const codigo = Object.keys(ERROS).find((k) => mensagem.includes(k));
  return erro(codigo ?? "interno");
}
