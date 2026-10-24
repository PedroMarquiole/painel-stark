"use server";
// Prospecção: tudo passa por funções do banco que conferem o papel (admin/comercial) e registram o histórico.
import { SEM_PERMISSAO, executar } from "@/lib/acao";
import * as q from "@/lib/dados/consultas";
import { CANAIS_PROSPECT, SERVICOS, type CanalProspect, type Servico, type SituacaoProspect } from "@/lib/rotulos";
import type { Prospect, ToqueProspect } from "@/lib/dados/tipos";
import type { CampoPlanilha } from "@/lib/prospeccao";
import { OFFLINE } from "@/lib/env";
import { UFS, buscarEmpresasFonte, cnaesDoNicho, deReceita, ehCelular, temGoogle, type EmpresaEncontrada, type FonteBusca, type ResultadoBusca } from "@/lib/busca-empresas";
import { supabaseServidor } from "@/lib/supabase/server";

const TELAS = ["/prospeccao"];
const ehCanal = (c: unknown): c is CanalProspect => typeof c === "string" && c in CANAIS_PROSPECT;
const limpar = (v: unknown, max = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export async function carregarToques(id: string): Promise<ToqueProspect[]> {
  return q.toquesDoProspect(id);
}

export async function recarregarProspect(id: string): Promise<Prospect | null> {
  return q.buscarProspect(id);
}

export async function registrarToque(id: string, canal: CanalProspect | null, resultado: "enviada" | "respondeu" | "depois" | "sem_interesse" | "nota",
  anotacao: string, proximo: string | null) {
  if (canal && !ehCanal(canal)) return { ok: false as const, erro: "Canal inválido." };
  return executar<{ situacao: SituacaoProspect; proximo_contato: string | null; toques: number }>(
    (sb) => sb.rpc("registrar_toque_prospect", { p_prospect: id, p_canal: (canal ?? null) as never, p_resultado: resultado, p_anotacao: anotacao || undefined, p_proximo: proximo ?? undefined }) as never,
    TELAS);
}

export async function mudarSituacao(id: string, situacao: Exclude<SituacaoProspect, "interessado">, motivo?: string) {
  return executar<{ situacao: SituacaoProspect; proximo_contato: string | null }>(
    (sb) => sb.rpc("mudar_situacao_prospect", { p_prospect: id, p_situacao: situacao, p_motivo: motivo || undefined }) as never, TELAS);
}

/** Desfazer: devolve situação, data e contatos exatamente como estavam. */
export async function desfazerSituacao(id: string, antes: { situacao: SituacaoProspect; proximo_contato: string | null; toques: number; motivo_encerramento?: string | null }) {
  if (antes.situacao === "interessado") return { ok: false as const, erro: "Já virou negócio." };
  return executar<{ situacao: SituacaoProspect; proximo_contato: string | null; toques: number }>(
    (sb) => sb.rpc("desfazer_situacao_prospect" as never, {
      p_prospect: id, p_situacao: antes.situacao, p_proximo: antes.proximo_contato, p_toques: antes.toques, p_motivo: antes.motivo_encerramento ?? null,
    } as never) as never, TELAS);
}

export async function converterEmNegocio(id: string, email: string, whatsapp: string, servicos: Servico[]) {
  const validos = servicos.filter((s) => s in SERVICOS);
  return executar<{ negocio_id: string; contato_id: string; ja_existia: boolean }>(
    (sb) => sb.rpc("converter_prospect", { p_prospect: id, p_email: email || undefined, p_whatsapp: whatsapp || undefined, p_servicos: validos }) as never,
    [...TELAS, "/funil", "/"]);
}

export interface DadosProspect {
  empresa: string; pessoa?: string; cargo?: string; email?: string; whatsapp?: string; linkedin?: string; instagram?: string; site?: string;
  cidade?: string; segmento?: string; porque?: string; canal: CanalProspect; origem?: string; responsavel_id?: string | null;
}

const INVALIDO = "invalido";
/** Mesma regra do banco (normalizar_whatsapp): DDD + número, ou internacional com +. */
const normalizarWhats = (v: string | null) => {
  if (!v) return null;
  const d = v.replace(/\D/g, "").replace(/^0+/, "");
  if (!d) return null;
  if (v.trim().startsWith("+")) return d.length >= 8 && d.length <= 15 ? `+${d}` : INVALIDO;
  if (d.length === 10 || d.length === 11) return `+55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return `+${d}`;
  return INVALIDO;
};
const normalizarSite = (v: string | null) => (v ? v.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "") : null);

function campos(d: Partial<DadosProspect>) {
  const out: Record<string, unknown> = {};
  if (d.empresa !== undefined) out.empresa = limpar(d.empresa, 160);
  if (d.pessoa !== undefined) out.pessoa = limpar(d.pessoa, 120);
  if (d.cargo !== undefined) out.cargo = limpar(d.cargo, 120);
  if (d.email !== undefined) out.email = limpar(d.email, 254)?.toLowerCase() ?? null;
  if (d.whatsapp !== undefined) out.whatsapp = normalizarWhats(limpar(d.whatsapp, 40));
  if (d.linkedin !== undefined) out.linkedin = limpar(d.linkedin, 300);
  if (d.instagram !== undefined) out.instagram = limpar(d.instagram, 120);
  if (d.site !== undefined) out.site = normalizarSite(limpar(d.site, 300));
  if (d.cidade !== undefined) out.cidade = limpar(d.cidade, 120);
  if (d.segmento !== undefined) out.segmento = limpar(d.segmento, 120);
  if (d.porque !== undefined) out.porque = limpar(d.porque, 600);
  if (d.canal !== undefined) out.canal = ehCanal(d.canal) ? d.canal : "linkedin";
  if (d.origem !== undefined) out.origem = limpar(d.origem, 200) ?? "Cadastro manual";
  if (d.responsavel_id !== undefined) out.responsavel_id = d.responsavel_id || null;
  return out;
}

export async function criarProspect(d: DadosProspect) {
  const p = await q.perfilAtual();
  if (!p || p.papel === "projetos") return { ok: false as const, erro: SEM_PERMISSAO };
  if (!limpar(d.empresa)) return { ok: false as const, erro: "Informe a empresa." };
  if (campos(d).whatsapp === INVALIDO) return { ok: false as const, erro: "Confira o WhatsApp: use DDD + número, ex.: (11) 98765-4321." };
  const hoje = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);
  return executar<{ id: string }>((sb) => sb.from("prospects").insert({
    ...campos(d), responsavel_id: d.responsavel_id || p.id, criado_por: p.id, proximo_contato: hoje,
  } as never).select("id").single(), TELAS);
}

export async function atualizarProspect(id: string, d: Partial<DadosProspect>) {
  if (campos(d).whatsapp === INVALIDO) return { ok: false as const, erro: "Confira o WhatsApp: use DDD + número, ex.: (11) 98765-4321." };
  return executar((sb) => sb.from("prospects").update(campos(d) as never).eq("id", id).select("id"), TELAS, true);
}

export type LinhaImportar = Partial<Record<CampoPlanilha, string>>;
export interface ResultadoImportacao {
  lista_id: string | null; linhas: { linha: number; status: "novo" | "repetido" | "cliente" | "nao_abordar" | "sem_contato" | "sem_empresa" }[];
  novos: number; repetidos: number; clientes: number; bloqueados: number; sem_contato: number; sem_empresa: number;
}

/** simular = true só confere (nada é gravado). */
export async function importarPlanilha(linhas: LinhaImportar[], lista: string, origem: string, responsaveis: string[], porDia: number, simular: boolean) {
  if (linhas.length > 2000) return { ok: false as const, erro: "Planilha grande demais: importe até 2.000 linhas por vez." };
  return executar<ResultadoImportacao>((sb) => sb.rpc("importar_prospects", {
    p_linhas: linhas as never, p_lista: lista, p_origem: origem, p_responsaveis: responsaveis, p_por_dia: Math.max(1, Math.min(50, porDia)), p_simular: simular,
  }) as never, simular ? [] : TELAS);
}

export async function salvarModelo(canal: CanalProspect, toque: 1 | 2 | 3, texto: string, assunto?: string | null) {
  if (!ehCanal(canal) || ![1, 2, 3].includes(toque)) return { ok: false as const, erro: "Modelo inválido." };
  if (!texto.trim()) return { ok: false as const, erro: "Escreva a mensagem." };
  return executar((sb) => sb.from("prospeccao_modelos").upsert({
    canal, toque, texto: texto.slice(0, 2000), updated_at: new Date().toISOString(),
    ...(canal === "email" ? { assunto: assunto?.trim().slice(0, 150) || null } : {}),
  } as never).select("canal"), TELAS, true);
}

/** E-mail com 1 clique: entra na fila de envio (Resend) e o contato fica registrado. */
export async function enviarEmail(id: string, assunto: string, corpo: string) {
  if (!assunto.trim() || !corpo.trim()) return { ok: false as const, erro: "Escreva o assunto e a mensagem." };
  return executar<{ situacao: SituacaoProspect; proximo_contato: string | null; toques: number; mensagem_id: string }>(
    (sb) => sb.rpc("enviar_email_prospect" as never, { p_prospect: id, p_assunto: assunto, p_corpo: corpo } as never) as never, TELAS);
}

/** Desfazer logo depois: cancela o e-mail se ainda não saiu. */
export async function cancelarEnvio(mensagemId: string) {
  return executar<boolean>((sb) => sb.rpc("cancelar_envio_prospect" as never, { p_mensagem: mensagemId } as never) as never);
}

/** Ritmo (dias úteis entre os contatos) e meta semanal: só admin (configuração do painel). */
export async function salvarConfig(ritmo: number[], meta: number | null) {
  const r = ritmo.map((n) => Math.round(n)).filter((n) => n >= 1 && n <= 30).slice(0, 5);
  if (!r.length) return { ok: false as const, erro: "Informe ao menos um intervalo entre contatos." };
  return executar(async (sb) => {
    const a = await sb.from("app_config").update({ valor: r as never }).eq("chave", "prospeccao_ritmo").select("chave");
    if (a.error || !a.data?.length) return a;
    // sem meta = 0 (a coluna não aceita vazio)
    return sb.from("app_config").update({ valor: (meta && meta > 0 ? Math.round(meta) : 0) as never }).eq("chave", "prospeccao_meta_semana").select("chave");
  }, TELAS, true);
}

// ─── Buscar empresas (Google Maps / OpenStreetMap) ───────────────────────────
export type StatusEncontrada = ResultadoImportacao["linhas"][number]["status"];
export interface ResultadoEncontradas {
  fonte: FonteBusca; temGoogle: boolean; proxima: string | null; total: number | null; atualizado: string | null;
  /** Estados com a base da Receita carregada (a busca usa a base nesses estados). */
  ufsBase: string[];
  itens: (EmpresaEncontrada & { status: StatusEncontrada; celular: boolean })[];
}

/** Empresa encontrada → linha da importação (mesmas regras de repetido / cliente / não abordar). */
const paraLinha = (e: EmpresaEncontrada, nicho: string, cidade: string): LinhaImportar => {
  const cel = ehCelular(e.telefone);
  // Fixo não é WhatsApp: só vira o contato principal quando não há e-mail; fica anotado em "por que abordar"
  const fixo = e.telefone && !cel ? e.telefone : null;
  return {
    empresa: e.empresa,
    whatsapp: cel || (fixo && !e.email) ? e.telefone ?? undefined : undefined,
    email: e.email ?? undefined,
    site: e.site ?? undefined,
    cidade,
    segmento: nicho,
    porque: [e.categoria, fixo ? `Tel. fixo ${fixo}` : null, e.nota ? `nota ${e.nota.toFixed(1)} (${e.avaliacoes ?? 0} avaliações)` : null, e.endereco]
      .filter(Boolean).join(" · ").slice(0, 600) || undefined,
  };
};

/** Base do painel (Receita): só nos estados carregados e para nichos que viram CNAE. */
async function buscarReceita(nicho: string, cidade: string, uf: string, pagina?: string | null): Promise<ResultadoBusca | null> {
  const cnaes = cnaesDoNicho(nicho);
  if (!cnaes.length) return null;
  const sb = await supabaseServidor();
  const pular = Number(pagina) || 0;
  const { data, error } = await sb.rpc("buscar_empresas_cnpj" as never, { p_uf: uf, p_cidade: cidade, p_cnaes: cnaes, p_limite: 50, p_pular: pular } as never);
  if (error) throw new Error(`base_${error.code ?? "erro"}`);
  const d = data as unknown as { total: number; itens: Parameters<typeof deReceita>[0]; atualizado: string | null };
  return { fonte: "receita", itens: deReceita(d.itens), total: d.total, atualizado: d.atualizado, proxima: d.total > pular + 50 ? String(pular + 50) : null };
}

async function ufsDaBase(): Promise<string[]> {
  if (OFFLINE) return ["MG"];
  const sb = await supabaseServidor();
  const { data } = await sb.rpc("ufs_cnpj" as never);
  return (data as unknown as string[] | null) ?? [];
}

export async function buscarEmpresas(nicho: string, cidade: string, uf: string, pagina?: string | null, fonte?: FonteBusca):
  Promise<{ ok: true; dados: ResultadoEncontradas } | { ok: false; erro: string }> {
  const p = await q.perfilAtual();
  if (!p || p.papel === "projetos") return { ok: false, erro: SEM_PERMISSAO };
  const n = limpar(nicho, 60), c = limpar(cidade, 80);
  if (!n || !c || !UFS.includes(uf as (typeof UFS)[number])) return { ok: false, erro: "Informe o nicho, a cidade e o estado." };
  let res: ResultadoBusca;
  const ufsBase = await ufsDaBase();
  try {
    const base = (!fonte || fonte === "receita") && ufsBase.includes(uf) ? (OFFLINE ? exemploReceita(n, c) : await buscarReceita(n, c, uf, pagina)) : null;
    res = base ?? (OFFLINE ? exemploBusca(n, c) : await buscarEmpresasFonte(n, c, uf, pagina, fonte === "receita" ? undefined : fonte));
  } catch (e) {
    const m = (e as Error).message;
    console.error("buscarEmpresas", { nicho: n, cidade: c, uf, erro: m });
    return { ok: false, erro: m === "google_chave" ? "A chave do Google Maps foi recusada. Confira GOOGLE_MAPS_API_KEY na Vercel e se a Places API (New) está ativada."
      : m === "google_cota" ? "A cota diária do Google Maps acabou. Tente amanhã ou use o OpenStreetMap."
      : m === "osm_ocupado" ? "O OpenStreetMap está ocupado agora. Tente de novo em 1 minuto."
      : `Não consegui buscar agora (${m.slice(0, 60)}). Tente de novo em instantes.` };
  }
  // Confere cada uma contra a prospecção e os contatos (nada é gravado)
  const linhas = res.itens.map((e) => paraLinha(e, n, c));
  const conf = linhas.length ? await importarPlanilha(linhas, "", "Busca", [p.id], 10, true) : null;
  const st = new Map((conf?.ok ? conf.dados?.linhas : undefined)?.map((l) => [l.linha, l.status]) ?? []);
  return {
    ok: true,
    dados: {
      fonte: res.fonte, temGoogle: temGoogle(), proxima: res.proxima, total: res.total ?? null, atualizado: res.atualizado ?? null, ufsBase,
      itens: res.itens.map((e, i) => ({ ...e, celular: ehCelular(e.telefone), status: st.get(i + 1) ?? (e.telefone || e.site || e.email ? "novo" : "sem_contato") })),
    },
  };
}

/** Importa as escolhidas, com a origem da busca registrada (LGPD). */
export async function importarEncontradas(itens: EmpresaEncontrada[], nicho: string, cidade: string, uf: string, responsaveis: string[], porDia: number) {
  const fonte = itens[0]?.fonte === "google" ? "Google Maps" : itens[0]?.fonte === "receita" ? "Receita Federal (dados abertos de CNPJ)" : "OpenStreetMap";
  const rotulo = `${nicho} em ${cidade}/${uf}`;
  return importarPlanilha(itens.map((e) => paraLinha(e, nicho, cidade)), rotulo, `${fonte}: ${rotulo}`, responsaveis, porDia, false);
}

function exemploReceita(nicho: string, cidade: string): ResultadoBusca {
  const nomes = ["Sorriso", "Vida", "Central", "Bem Estar", "Prime", "Santa Luzia"];
  return {
    fonte: "receita", total: 132, atualizado: "2026-10-20", proxima: "50",
    itens: deReceita(nomes.map((s, i) => ({
      cnpj: `1234567800${String(i).padStart(2, "0")}10`.slice(0, 14), nome: `${nicho[0].toUpperCase()}${nicho.slice(1)} ${s}`, razao: null, cnae: "8630504",
      municipio: cidade, bairro: "Centro", endereco: `Rua ${i + 1}, ${100 + i}`, telefone: i % 2 ? `(31) 3${i}22-1100` : `(31) 9${i}876-54${i}1`, telefone2: null,
      email: i % 3 ? `contato${i}@exemplo.com.br` : null, abertura: `20${10 + i}-03-01`, porte: i % 2 ? 1 : 3,
    }))),
  };
}

function exemploBusca(nicho: string, cidade: string): Awaited<ReturnType<typeof buscarEmpresasFonte>> {
  const nomes = ["Central", "do Bairro", "Bem-Estar", "Premium", "Express", "da Vila", "Nova Era", "Prime"];
  return {
    fonte: "osm", proxima: null,
    itens: nomes.map((s, i) => ({
      fonte: "osm" as const, id: `exemplo/${i}`, empresa: `${nicho[0].toUpperCase()}${nicho.slice(1)} ${s}`,
      telefone: i % 3 === 2 ? null : i % 2 ? `(19) 3${i}45-12${i}0` : `(19) 9${i}812-34${i}5`, site: i % 2 ? null : `exemplo${i}.com.br`,
      endereco: `Rua ${i + 1}, Centro · ${cidade}`, nota: i % 2 ? null : 4 + i / 10, avaliacoes: i % 2 ? null : 20 + i * 7,
      mapa: null, categoria: nicho,
    })),
  };
}
