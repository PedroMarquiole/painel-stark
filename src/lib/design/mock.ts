import type { DealCardData } from "@/components/domain/kanban-card";
import type { LeadRowData } from "@/components/domain/lead-row";

const H = 3_600_000;

/** Leads fictícios com prazos relativos a `now`, para exibir os 4 estados de SLA ao vivo. */
export function mockLeads(now: Date): LeadRowData[] {
  const t = now.getTime();
  return [
    {
      id: "1", protocolo: 142, nome: "Marina Albuquerque", empresa: "Clínica Vitta", email: "marina@clinicavitta.com.br", whatsapp: "(11) 98765-4321",
      servicos: ["Sistemas web", "Automação e IA", "Integrações e APIs"], situacao: "Um sistema que não atende",
      dor: "Agendamento é feito em 3 lugares diferentes e a recepção perde 2h por dia conferindo horários.",
      origem: "google / cpc", createdAt: new Date(t - 4 * 60_000), slaDeadline: new Date(t + 23.9 * H), responsavel: "Rafael Costa", score: 86, isNew: true,
    },
    {
      id: "2", protocolo: 141, nome: "João Pedro Lima", empresa: "Transportes Lima", email: "joao@translima.com.br", whatsapp: "(31) 99812-0044",
      servicos: ["Dashboards"], situacao: "Em planilhas",
      dor: "Fechamento do mês leva uma semana porque os dados de frete vêm de 4 planilhas.",
      origem: "instagram", createdAt: new Date(t - 21 * H), slaDeadline: new Date(t + 2.6 * H), responsavel: "Ana Beatriz", score: 72,
    },
    {
      id: "3", protocolo: 139, nome: "Carla Mendes", empresa: "Ateliê Mendes", email: "carla@ateliemendes.com", whatsapp: "(41) 98100-2233",
      servicos: ["Loja virtual", "Site ou landing page"], situacao: "Na mão ou no WhatsApp",
      dor: "Vendo pelo WhatsApp e perco pedido quando o volume aumenta no fim do ano.",
      origem: "direto", createdAt: new Date(t - 26 * H), slaDeadline: new Date(t - 1.2 * H), score: 58,
    },
    {
      id: "4", protocolo: 137, nome: "Eduardo Furtado", empresa: "Furtado Engenharia", email: "edu@furtado.eng.br", whatsapp: "(21) 97777-1212",
      servicos: ["Aplicativo"], situacao: "Ainda não existe",
      dor: "Equipe de campo preenche relatório em papel e a gente digita tudo de novo no escritório.",
      origem: "indicação", createdAt: new Date(t - 30 * H), slaDeadline: new Date(t - 6 * H), respondedAt: new Date(t - 26 * H), responsavel: "Rafael Costa", score: 79,
    },
  ];
}

export const mockDeals: DealCardData[] = [
  { id: "d1", protocolo: 128, titulo: "Portal de agendamento + integração com prontuário", empresa: "Clínica Vitta", valor: 48000, probabilidade: 60, servico: "Sistemas web", diasNaEtapa: 3, limiteParado: 7, responsavel: "Rafael Costa", proximo: "Enviar proposta revisada até qui" },
  { id: "d2", protocolo: 117, titulo: "Dashboard financeiro de frotas", empresa: "Transportes Lima", valor: 22000, probabilidade: 40, servico: "Dashboards", diasNaEtapa: 12, limiteParado: 7, responsavel: "Ana Beatriz" },
];

export const weeks = ["01/09", "08/09", "15/09", "22/09", "29/09", "06/10", "13/10", "20/10"];
export const leadsPorSemana = weeks.map((w, i) => ({ semana: w, site: [9, 12, 10, 14, 13, 17, 15, 19][i], indicacao: [3, 2, 4, 3, 5, 4, 6, 5][i] }));
export const leadsPorServico = [
  { servico: "Sistemas web", leads: 34 },
  { servico: "Automação e IA", leads: 27 },
  { servico: "Dashboards", leads: 19 },
  { servico: "Aplicativo", leads: 15 },
  { servico: "Integrações", leads: 12 },
  { servico: "Loja virtual", leads: 8 },
];
