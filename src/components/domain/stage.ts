/** Etapas do funil — espelham o processo do site. Ordem importa. */
export const STAGES = [
  { id: "novo", label: "Novo" },
  { id: "triagem", label: "Em triagem" },
  { id: "diagnostico", label: "Diagnóstico agendado" },
  { id: "descoberta", label: "Descoberta feita" },
  { id: "proposta", label: "Proposta enviada" },
  { id: "negociacao", label: "Negociação" },
  { id: "ganho", label: "Ganho" },
  { id: "perdido", label: "Perdido" },
] as const;
export type StageId = (typeof STAGES)[number]["id"];

export const SERVICOS = [
  "Sistemas web",
  "Aplicativo",
  "Automação e IA",
  "Integrações e APIs",
  "Dashboards",
  "Site ou landing page",
  "Loja virtual",
  "Evoluir o que já existe",
] as const;

export const SITUACOES = ["Na mão ou no WhatsApp", "Em planilhas", "Um sistema que não atende", "Ainda não existe"] as const;
