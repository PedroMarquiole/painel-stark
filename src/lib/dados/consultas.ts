import "server-only";
import { cache } from "react";
import { OFFLINE } from "@/lib/env";
import { supabaseServidor } from "@/lib/supabase/server";
import type { Servico } from "@/lib/rotulos";
import * as fx from "./fixtures";
import type {
  Atividade, Automacao, EtapaConfig, Execucao, Indicadores, LeadDetalhe, LeadInbox, NegocioCard, Notificacao, Perfil, ResultadoBusca,
} from "./tipos";

const diasAtras = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

/** Perfil logado (uma consulta por requisição). */
export const perfilAtual = cache(async (): Promise<Perfil | null> => {
  if (OFFLINE) return fx.perfil;
  const sb = await supabaseServidor();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return null;
  const { data } = await sb.from("profiles").select("id, nome, email, papel, avatar_url, ativo").eq("id", u.user.id).single();
  return data?.ativo ? data : null;
});

export const listarEquipe = cache(async (): Promise<Perfil[]> => {
  if (OFFLINE) return fx.equipe;
  const sb = await supabaseServidor();
  const { data } = await sb.from("profiles").select("id, nome, email, papel, avatar_url").eq("ativo", true).order("nome");
  return data ?? [];
});

const SELECT_LEAD =
  "id, protocolo, created_at, status, servicos, situacao_atual, dor, origem_informada, utm_source, sla_vence_em, primeira_resposta_em, responsavel_id, contato_id, negocio_id, score, nome_informado, email_informado, empresa_informada, contato:contatos(nome, email, whatsapp, empresa:empresas(nome))";

type LinhaLead = {
  id: string; protocolo: number; created_at: string; status: string; servicos: Servico[]; situacao_atual: LeadInbox["situacao_atual"];
  dor: string; origem_informada: string | null; utm_source: string | null; sla_vence_em: string; primeira_resposta_em: string | null;
  responsavel_id: string | null; contato_id: string; negocio_id: string | null; score: number | null; nome_informado: string;
  email_informado: string | null; empresa_informada: string | null;
  contato: { nome: string; email: string | null; whatsapp: string | null; empresa: { nome: string } | null } | null;
};

const paraInbox = (l: LinhaLead): LeadInbox => ({
  id: l.id, protocolo: l.protocolo, created_at: l.created_at, status: l.status as LeadInbox["status"], servicos: l.servicos,
  situacao_atual: l.situacao_atual, dor: l.dor, origem: l.utm_source ?? l.origem_informada, sla_vence_em: l.sla_vence_em,
  primeira_resposta_em: l.primeira_resposta_em, responsavel_id: l.responsavel_id, contato_id: l.contato_id, negocio_id: l.negocio_id,
  nome: l.contato?.nome ?? l.nome_informado, email: l.contato?.email ?? l.email_informado, whatsapp: l.contato?.whatsapp ?? null,
  empresa: l.contato?.empresa?.nome ?? l.empresa_informada, score: l.score,
});

/** Caixa de entrada: tudo em aberto + o que chegou nos últimos 14 dias. */
export async function listarLeadsInbox(): Promise<LeadInbox[]> {
  if (OFFLINE) return fx.leads();
  const sb = await supabaseServidor();
  const { data, error } = await sb
    .from("leads")
    .select(SELECT_LEAD)
    .or(`status.in.(novo,em_atendimento),created_at.gte.${diasAtras(14)}`)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  return (data as unknown as LinhaLead[]).map(paraInbox);
}

export async function buscarLeadInbox(id: string): Promise<LeadInbox | null> {
  if (OFFLINE) return fx.leads().find((l) => l.id === id) ?? null;
  const sb = await supabaseServidor();
  const { data } = await sb.from("leads").select(SELECT_LEAD).eq("id", id).maybeSingle();
  return data ? paraInbox(data as unknown as LinhaLead) : null;
}

async function atividadesDoContato(contatoId: string): Promise<Atividade[]> {
  const sb = await supabaseServidor();
  const { data } = await sb
    .from("atividades")
    .select("id, tipo, canal, direcao, automatica, titulo, corpo, ocorreu_em, autor:profiles(nome)")
    .eq("contato_id", contatoId)
    .order("ocorreu_em", { ascending: false })
    .limit(150);
  return (data ?? []).map(({ autor, ...a }) => ({ ...a, autor_nome: (autor as { nome: string } | null)?.nome ?? null }));
}

export async function detalheLead(id: string): Promise<LeadDetalhe | null> {
  if (OFFLINE) return fx.detalhe(id);
  const sb = await supabaseServidor();
  const { data: l } = await sb
    .from("leads")
    .select(`${SELECT_LEAD}, motivo_descarte, prazo, investimento, porte, respostas_extras, simulador, utm_medium, utm_campaign, consentimento_lgpd_em,
             contato_full:contatos(id, nome, email, whatsapp, cargo, opt_out_email), negocio:negocios(id, titulo, etapa, valor_estimado)`)
    .eq("id", id)
    .maybeSingle();
  if (!l) return null;
  const linha = l as unknown as LinhaLead & Record<string, unknown>;
  const [atividades, outros] = await Promise.all([
    atividadesDoContato(linha.contato_id),
    sb.from("leads").select("id, protocolo, created_at, dor").eq("contato_id", linha.contato_id).neq("id", id).order("created_at", { ascending: false }),
  ]);
  return {
    ...paraInbox(linha),
    motivo_descarte: linha.motivo_descarte as string | null,
    prazo: linha.prazo as string | null,
    investimento: linha.investimento as string | null,
    porte: linha.porte as string | null,
    respostas_extras: (linha.respostas_extras ?? {}) as Record<string, string>,
    simulador: linha.simulador as LeadDetalhe["simulador"],
    utm: { source: linha.utm_source, medium: linha.utm_medium as string | null, campaign: linha.utm_campaign as string | null },
    consentimento_lgpd_em: linha.consentimento_lgpd_em as string | null,
    contato: linha.contato_full as LeadDetalhe["contato"],
    negocio: linha.negocio as LeadDetalhe["negocio"],
    outros_pedidos: outros.data ?? [],
    atividades,
  };
}

export async function listarEtapas(): Promise<EtapaConfig[]> {
  if (OFFLINE) return fx.etapas;
  const sb = await supabaseServidor();
  const { data } = await sb.from("etapas_config").select("*").order("ordem");
  return data ?? [];
}

/** Funil: negócios em aberto + fechados nos últimos 90 dias. */
export async function listarNegocios(): Promise<NegocioCard[]> {
  if (OFFLINE) return fx.negocios();
  const sb = await supabaseServidor();
  const d90 = diasAtras(90);
  const { data, error } = await sb
    .from("negocios")
    .select("id, titulo, etapa, etapa_desde, ordem, valor_estimado, probabilidade, servicos, responsavel_id, contato_id, ganho_em, perdido_em, motivo_perda, created_at, contato:contatos(nome, empresa:empresas(nome)), leads(protocolo)")
    .or(`etapa.not.in.(ganho,perdido),ganho_em.gte.${d90},perdido_em.gte.${d90}`)
    .order("ordem")
    .order("etapa_desde", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(({ contato, leads, ...n }) => {
    const c = contato as unknown as { nome: string; empresa: { nome: string } | null } | null;
    const protocolos = ((leads ?? []) as { protocolo: number }[]).map((x) => x.protocolo);
    return {
      ...n,
      contato_nome: c?.nome ?? "—",
      empresa: c?.empresa?.nome ?? null,
      protocolo: protocolos.length ? Math.min(...protocolos) : null,
    } as NegocioCard;
  });
}

export async function indicadores(dias: number): Promise<Indicadores> {
  if (OFFLINE) return fx.indicadores(dias);
  const sb = await supabaseServidor();
  const { data, error } = await sb.rpc("painel_indicadores", { p_dias: dias });
  if (error) throw new Error(error.message);
  return data as unknown as Indicadores;
}

export async function listarAutomacoes(): Promise<{ regras: Automacao[]; execucoes: Execucao[] }> {
  if (OFFLINE) return fx.automacoes();
  const sb = await supabaseServidor();
  const [regras, execucoes] = await Promise.all([
    sb.from("automacoes").select("id, numero, chave, nome, descricao, gatilho, ativa, fase, envia_ao_cliente").order("numero"),
    sb.from("automacoes_execucoes").select("id, status, entidade_tipo, entidade_id, created_at, resultado, erro, automacao:automacoes(nome)")
      .order("created_at", { ascending: false }).limit(40),
  ]);
  return {
    regras: regras.data ?? [],
    execucoes: (execucoes.data ?? []).map(({ automacao, ...e }) => ({ ...e, automacao: (automacao as { nome: string } | null)?.nome ?? "—" })),
  };
}

export async function listarNotificacoes(): Promise<Notificacao[]> {
  if (OFFLINE) return fx.notificacoes;
  const sb = await supabaseServidor();
  const p = await perfilAtual();
  if (!p) return [];
  const { data } = await sb.from("notificacoes").select("id, tipo, titulo, corpo, link, lida_em, created_at")
    .eq("profile_id", p.id).order("created_at", { ascending: false }).limit(30);
  return data ?? [];
}

export interface Ficha {
  contato: { id: string; nome: string; email: string | null; whatsapp: string | null; cargo: string | null; opt_out_email: boolean; opt_out_whatsapp: boolean; created_at: string; responsavel_id: string | null; empresa: string | null };
  pedidos: LeadInbox[];
  negocios: NegocioCard[];
  atividades: Atividade[];
  ltv: number;
}

export async function fichaContato(id: string): Promise<Ficha | null> {
  if (OFFLINE) return fx.ficha(id);
  const sb = await supabaseServidor();
  const { data: c } = await sb.from("contatos")
    .select("id, nome, email, whatsapp, cargo, opt_out_email, opt_out_whatsapp, created_at, responsavel_id, empresa:empresas(nome)")
    .eq("id", id).maybeSingle();
  if (!c) return null;
  const [pedidos, negocios, atividades] = await Promise.all([
    sb.from("leads").select(SELECT_LEAD).eq("contato_id", id).order("created_at", { ascending: false }),
    sb.from("negocios").select("id, titulo, etapa, etapa_desde, ordem, valor_estimado, probabilidade, servicos, responsavel_id, contato_id, ganho_em, perdido_em, motivo_perda, created_at")
      .eq("contato_id", id).order("created_at", { ascending: false }),
    atividadesDoContato(id),
  ]);
  const negs = (negocios.data ?? []).map((n) => ({ ...n, contato_nome: c.nome, empresa: null, protocolo: null }) as NegocioCard);
  const { empresa, ...resto } = c;
  return {
    contato: { ...resto, empresa: (empresa as unknown as { nome: string } | null)?.nome ?? null },
    pedidos: ((pedidos.data ?? []) as unknown as LinhaLead[]).map(paraInbox),
    negocios: negs,
    atividades,
    ltv: negs.filter((n) => n.etapa === "ganho").reduce((s, n) => s + (n.valor_estimado ?? 0), 0),
  };
}

const limpar = (q: string) => q.replace(/[,()%*\\]/g, " ").trim().slice(0, 60);

export async function buscar(qBruto: string): Promise<ResultadoBusca[]> {
  const q = limpar(qBruto);
  if (q.length < 2) return [];
  if (OFFLINE) return fx.buscar(q);
  const sb = await supabaseServidor();
  const num = Number(q.replace(/^#/, ""));
  const [contatos, negocios, porProtocolo] = await Promise.all([
    sb.from("contatos").select("id, nome, email, empresa:empresas(nome)").or(`nome.ilike.%${q}%,email.ilike.%${q}%`).limit(6),
    sb.from("negocios").select("id, titulo, etapa, contato_id").ilike("titulo", `%${q}%`).limit(4),
    Number.isInteger(num) && num > 0
      ? sb.from("leads").select("id, protocolo, nome_informado").eq("protocolo", num).limit(1)
      : Promise.resolve({ data: [] as { id: string; protocolo: number; nome_informado: string }[] }),
  ]);
  return [
    ...(porProtocolo.data ?? []).map((l) => ({ tipo: "lead" as const, id: l.id, titulo: `#${String(l.protocolo).padStart(4, "0")} · ${l.nome_informado}`, subtitulo: "Pedido", href: `/leads?id=${l.id}` })),
    ...(contatos.data ?? []).map((c) => ({ tipo: "contato" as const, id: c.id, titulo: c.nome, subtitulo: [(c.empresa as unknown as { nome: string } | null)?.nome, c.email].filter(Boolean).join(" · "), href: `/clientes/${c.id}` })),
    ...(negocios.data ?? []).map((n) => ({ tipo: "negocio" as const, id: n.id, titulo: n.titulo, subtitulo: "Negócio", href: `/clientes/${n.contato_id}` })),
  ];
}

export interface FiltroSalvo { id: string; nome: string; filtros: Record<string, string>; compartilhado: boolean }

export async function listarFiltros(escopo: string): Promise<FiltroSalvo[]> {
  if (OFFLINE) return [{ id: "f1", nome: "Automação · Google", filtros: { servico: "automacao_ia", origem: "google" }, compartilhado: true }];
  const sb = await supabaseServidor();
  const { data } = await sb.from("filtros_salvos").select("id, nome, filtros, compartilhado").eq("escopo", escopo).order("ordem").order("created_at");
  return (data ?? []) as FiltroSalvo[];
}
