import type { Database } from "@/lib/supabase/database.types";

type E = Database["public"]["Enums"];
export type Servico = E["servico"];
export type Situacao = E["situacao_atual"];
export type Etapa = E["etapa_negocio"];
export type MotivoPerda = E["motivo_perda"];
export type Papel = E["papel_equipe"];

export const SERVICOS: Record<Servico, string> = {
  sistemas_web: "Sistemas web",
  aplicativo: "Aplicativo",
  automacao_ia: "Automação e IA",
  integracoes_apis: "Integrações e APIs",
  dashboards: "Dashboards",
  site_landing: "Site ou landing page",
  loja_virtual: "Loja virtual",
  evoluir_existente: "Evoluir o que já existe",
};

export const SITUACOES: Record<Situacao | "nao_informado", string> = {
  manual_whatsapp: "Na mão ou no WhatsApp",
  planilhas: "Em planilhas",
  sistema_nao_atende: "Um sistema que não atende",
  nao_existe: "Ainda não existe",
  nao_informado: "Não informado",
};

export const ETAPAS: { id: Etapa; rotulo: string }[] = [
  { id: "novo", rotulo: "Novo" },
  { id: "triagem", rotulo: "Em triagem" },
  { id: "diagnostico", rotulo: "Diagnóstico agendado" },
  { id: "descoberta", rotulo: "Descoberta feita" },
  { id: "proposta", rotulo: "Proposta enviada" },
  { id: "negociacao", rotulo: "Negociação" },
  { id: "ganho", rotulo: "Ganho" },
  { id: "perdido", rotulo: "Perdido" },
];
export const ROTULO_ETAPA = Object.fromEntries(ETAPAS.map((e) => [e.id, e.rotulo])) as Record<Etapa, string>;

export const MOTIVOS_PERDA: Record<MotivoPerda, string> = {
  preco: "Preço",
  prazo: "Prazo",
  sem_resposta: "Sem resposta",
  concorrente: "Foi com concorrente",
  fora_de_escopo: "Fora de escopo",
  outro: "Outro",
};

export const MOTIVOS_DESCARTE = [
  "Não é para a Stark",
  "Spam ou teste",
  "Duplicado",
  "Sem orçamento",
  "Sem contato válido",
  "Outro",
] as const;

export const ORIGENS: Record<string, string> = {
  site: "Direto (site)",
  google: "Google",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  indicacao: "Indicação",
  campanha: "Campanha paga",
  outro: "Outro",
};
/** "site", "direto" e sem origem são a mesma coisa: a pessoa chegou ao site sozinha. */
export const chaveOrigem = (o?: string | null) => (!o || o === "direto" ? "site" : o);
export const rotuloOrigem = (o?: string | null) => ORIGENS[chaveOrigem(o)] ?? o ?? ORIGENS.site;

export const PAPEIS: Record<Papel, string> = { admin: "Admin", comercial: "Comercial", projetos: "Projetos/Dev" };

// ─── Prospecção ─────────────────────────────────────────────────────────────
export type CanalProspect = "linkedin" | "whatsapp" | "email" | "instagram" | "telefone";
export type SituacaoProspect = "a_abordar" | "contatado" | "acompanhamento" | "respondeu" | "interessado" | "sem_interesse" | "nao_abordar";
export const CANAIS_PROSPECT: Record<CanalProspect, string> = {
  linkedin: "LinkedIn", whatsapp: "WhatsApp", email: "E-mail", instagram: "Instagram", telefone: "Ligação",
};
/** Em ordem do caminho. As duas últimas são "Encerrados". */
export const SITUACOES_PROSPECT: { id: SituacaoProspect; rotulo: string; dica: string }[] = [
  { id: "a_abordar", rotulo: "A abordar", dica: "ainda sem contato" },
  { id: "contatado", rotulo: "Contatado", dica: "1º contato feito, esperando" },
  { id: "acompanhamento", rotulo: "Em acompanhamento", dica: "2º ou 3º contato" },
  { id: "respondeu", rotulo: "Respondeu", dica: "em conversa, ainda sem decisão" },
  { id: "interessado", rotulo: "Interessado", dica: "virou negócio no Funil" },
  { id: "sem_interesse", rotulo: "Sem interesse", dica: "encerrado, dá para reabrir" },
  { id: "nao_abordar", rotulo: "Não abordar mais", dica: "bloqueado, inclusive em importações" },
];
export const ROTULO_SITUACAO_PROSPECT = Object.fromEntries(SITUACOES_PROSPECT.map((s) => [s.id, s.rotulo])) as Record<SituacaoProspect, string>;
