"use server";
import { SEM_PERMISSAO, executar } from "@/lib/acao";
import * as q from "@/lib/dados/consultas";
import type { Etapa, MotivoPerda, Servico, Situacao } from "@/lib/rotulos";
import type { LeadDetalhe, LeadInbox, NegocioCard, ResultadoBusca } from "@/lib/dados/tipos";

export async function carregarLead(id: string): Promise<LeadDetalhe | null> {
  return q.detalheLead(id);
}

export async function carregarLeadInbox(id: string): Promise<LeadInbox | null> {
  return q.buscarLeadInbox(id);
}

export async function buscarGlobal(termo: string): Promise<ResultadoBusca[]> {
  return q.buscar(termo);
}

export async function responderLead(leadId: string, canal: "email" | "whatsapp", assunto: string, corpo: string) {
  return executar((sb) => sb.rpc("responder_lead", { p_lead: leadId, p_canal: canal, p_assunto: assunto, p_corpo: corpo }), ["/leads", "/"]);
}

export async function descartarLead(leadId: string, motivo: string) {
  return executar((sb) => sb.from("leads").update({ status: "descartado", motivo_descarte: motivo }).eq("id", leadId).select("id"), ["/leads"], true);
}

export async function restaurarLead(leadId: string, status: "novo" | "em_atendimento") {
  return executar((sb) => sb.from("leads").update({ status, motivo_descarte: null }).eq("id", leadId).select("id"), ["/leads"], true);
}

export async function atribuirLead(leadId: string, negocioId: string | null, profileId: string | null) {
  return executar(async (sb) => {
    const r = await sb.from("leads").update({ responsavel_id: profileId }).eq("id", leadId).select("id");
    if (r.error || !r.data?.length || !negocioId) return r;
    return sb.from("negocios").update({ responsavel_id: profileId }).eq("id", negocioId).select("id");
  }, ["/leads", "/funil"], true);
}

export async function moverNegocio(id: string, etapa: Etapa, ordem: number, motivo?: MotivoPerda | null, detalhe?: string) {
  return executar((sb) =>
    sb.from("negocios").update({
      etapa, ordem,
      motivo_perda: etapa === "perdido" ? (motivo ?? null) : null,
      motivo_perda_detalhe: etapa === "perdido" ? (detalhe ?? null) : null,
    }).eq("id", id).select("id"), ["/funil", "/"], true);
}

/**
 * Desfaz uma movimentação no funil devolvendo o negócio EXATAMENTE como estava.
 * O gatilho de etapa recarimba datas e probabilidade; por isso um segundo update
 * (que não mexe na etapa e não dispara o gatilho) restaura os valores anteriores.
 */
export async function desfazerMovimento(antes: NegocioCard) {
  return executar(async (sb) => {
    const r = await sb.from("negocios").update({
      etapa: antes.etapa, ordem: antes.ordem, motivo_perda: antes.motivo_perda, motivo_perda_detalhe: antes.motivo_perda_detalhe,
    }).eq("id", antes.id).select("id");
    if (r.error || !r.data?.length) return r;
    return sb.from("negocios").update({
      etapa_desde: antes.etapa_desde, ganho_em: antes.ganho_em, perdido_em: antes.perdido_em, probabilidade: antes.probabilidade,
    }).eq("id", antes.id).select("id");
  }, ["/funil", "/"], true);
}

export async function atualizarNegocio(id: string, campos: { titulo?: string; valor_estimado?: number | null; probabilidade?: number; previsao_fechamento?: string | null; responsavel_id?: string | null }) {
  return executar((sb) => sb.from("negocios").update(campos).eq("id", id).select("id"), ["/funil"], true);
}

export async function atualizarContato(id: string, campos: { nome?: string; email?: string | null; whatsapp?: string | null; cargo?: string | null; opt_out_email?: boolean; opt_out_whatsapp?: boolean }) {
  const limpos = { ...campos };
  if (typeof limpos.email === "string") limpos.email = limpos.email.trim().toLowerCase() || null;
  if (typeof limpos.whatsapp === "string") {
    const d = limpos.whatsapp.replace(/\D/g, "").replace(/^0+/, "");
    limpos.whatsapp = !d ? null : limpos.whatsapp.trim().startsWith("+") ? `+${d}` : d.length <= 11 ? `+55${d}` : `+${d}`;
  }
  return executar((sb) => sb.from("contatos").update(limpos).eq("id", id).select("id"), ["/leads", `/clientes/${id}`], true);
}

export async function adicionarNota(contatoId: string, texto: string, ids: { leadId?: string; negocioId?: string } = {}) {
  if (!texto.trim()) return { ok: false, erro: "Escreva a nota." };
  const p = await q.perfilAtual();
  return executar((sb) =>
    sb.from("atividades").insert({
      tipo: "nota", canal: "nota", direcao: "interna", contato_id: contatoId, lead_id: ids.leadId ?? null,
      negocio_id: ids.negocioId ?? null, autor_id: p?.id ?? null, titulo: "Nota", corpo: texto.trim(),
    }), ["/leads", `/clientes/${contatoId}`]);
}

/**
 * Contato feito por fora do painel (WhatsApp do celular, ligação, reunião): conta como resposta e fecha o SLA.
 * `quando`: hora em que o contato aconteceu (padrão: agora). Uma resposta dada no prazo e registrada
 * depois não deve virar SLA estourado.
 */
export async function registrarContato(
  contatoId: string, canal: "whatsapp" | "ligacao" | "reuniao", resumo: string,
  ids: { leadId?: string; negocioId?: string } = {}, quando?: string,
) {
  const p = await q.perfilAtual();
  if (p?.papel === "projetos") return { ok: false, erro: SEM_PERMISSAO };
  const momento = quando ? new Date(quando) : new Date();
  if (Number.isNaN(momento.getTime()) || momento.getTime() > Date.now() + 60_000) return { ok: false, erro: "Informe uma data e hora que já passou." };
  const titulos = { whatsapp: "Respondeu pelo WhatsApp", ligacao: "Ligação", reuniao: "Reunião" };
  return executar((sb) =>
    sb.from("atividades").insert({
      tipo: canal === "whatsapp" ? "mensagem" : canal, canal, direcao: "saida", contato_id: contatoId, lead_id: ids.leadId ?? null,
      negocio_id: ids.negocioId ?? null, autor_id: p?.id ?? null, titulo: titulos[canal], corpo: resumo.trim() || null,
      ocorreu_em: momento.toISOString(),
    }), ["/leads", `/clientes/${contatoId}`]);
}

export interface NovoLead {
  nome: string; email: string; whatsapp: string; empresa: string; servicos: Servico[]; situacao_atual: Situacao | ""; dor: string; origem: string;
}

export async function criarLead(d: NovoLead) {
  return executar<{ numero: number }>((sb) => sb.rpc("criar_lead_manual", { p: { ...d } as never }) as never, ["/leads", "/funil", "/"]);
}

export async function alternarAutomacao(id: string, ativa: boolean) {
  return executar((sb) => sb.from("automacoes").update({ ativa }).eq("id", id).select("id"), ["/automacoes"], true);
}

export async function marcarNotificacoesLidas() {
  const p = await q.perfilAtual();
  if (!p) return { ok: false };
  return executar((sb) => sb.from("notificacoes").update({ lida_em: new Date().toISOString() }).eq("profile_id", p.id).is("lida_em", null));
}

export async function salvarPreferencias(prefs: Record<string, unknown>) {
  const p = await q.perfilAtual();
  if (!p) return { ok: false };
  return executar((sb) => sb.from("profiles").update({ preferencias: prefs as never }).eq("id", p.id).select("id"), [], true);
}

export async function salvarFiltro(escopo: string, nome: string, filtros: Record<string, string>, compartilhado: boolean) {
  return executar((sb) => sb.from("filtros_salvos").insert({ escopo, nome: nome.trim().slice(0, 40), filtros, compartilhado }).select("id").single(), ["/leads"]);
}

/** Só quem criou remove (RLS); 0 linhas afetadas vira erro em vez de sumir só da tela. */
export async function removerFiltro(id: string) {
  return executar((sb) => sb.from("filtros_salvos").delete().eq("id", id).select("id"), ["/leads"], true);
}
