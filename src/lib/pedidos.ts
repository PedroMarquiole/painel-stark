// Em que ponto do caminho está cada pedido. Uma regra só para Início, menu e caixa de entrada,
// para os números baterem em todas as telas.
import { SLA_VENCENDO_MS } from "@/lib/sla";
import type { LeadInbox } from "@/lib/dados/tipos";

/** Negócio fechado (ganho ou perdido) também encerra o pedido. */
export const negocioFechado = (l: LeadInbox) => l.etapa === "ganho" || l.etapa === "perdido";
export const aberto = (l: LeadInbox) => (l.status === "novo" || l.status === "em_atendimento") && !negocioFechado(l);
/** Novos: ainda sem resposta, prazo correndo. */
export const semResposta = (l: LeadInbox) => aberto(l) && !l.primeira_resposta_em;
export const emConversa = (l: LeadInbox) => aberto(l) && Boolean(l.primeira_resposta_em);
export const arquivado = (l: LeadInbox) => l.status === "convertido" || l.status === "descartado" || negocioFechado(l);

const falta = (l: LeadInbox, agora: number) => new Date(l.sla_vence_em).getTime() - agora;
export const vencendo = (l: LeadInbox, agora: number) => semResposta(l) && falta(l, agora) >= 0 && falta(l, agora) < SLA_VENCENDO_MS;
export const estourado = (l: LeadInbox, agora: number) => semResposta(l) && falta(l, agora) < 0;
