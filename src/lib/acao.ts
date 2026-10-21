import "server-only";
// Escrita no Supabase com a sessão do usuário: traduz erros do banco para frases e revalida as telas.
import { revalidatePath } from "next/cache";
import { OFFLINE } from "@/lib/env";
import { supabaseServidor } from "@/lib/supabase/server";
import type { Resultado } from "@/lib/dados/tipos";

export const SEM_PERMISSAO = "Seu papel não permite essa ação (ou o item não existe mais).";

// Erros do banco → frase para a pessoa (nunca detalhe técnico na tela)
export function traduzir(msg: string): string {
  if (msg.includes("sem_permissao") || msg.includes("permission denied") || msg.includes("row-level security")) return SEM_PERMISSAO;
  if (msg.includes("opt_out")) return "Este cliente pediu para não receber mensagens por esse canal. Se falou com ele por outro meio, use “Registrar contato”.";
  if (msg.includes("sem_destino")) return "O cliente não tem esse contato cadastrado.";
  if (msg.includes("perda_tem_motivo")) return "Escolha o motivo da perda.";
  if (msg.includes("descarte_tem_motivo")) return "Escolha o motivo do descarte.";
  if (msg.includes("whatsapp_desligado")) return "WhatsApp ainda não está configurado. Use o e-mail.";
  if (msg.includes("mensagem_vazia")) return "Escreva a mensagem.";
  if (msg.includes("contatos_email_uniq")) return "Já existe um cliente com esse e-mail.";
  if (msg.includes("contatos_whatsapp_uniq")) return "Já existe um cliente com esse WhatsApp.";
  if (msg.includes("whatsapp_e164")) return "WhatsApp inválido. Use DDD + número.";
  // Prospecção
  if (msg.includes("prospects_email_uniq")) return "Já existe um prospect com esse e-mail.";
  if (msg.includes("prospects_whatsapp_uniq")) return "Já existe um prospect com esse WhatsApp.";
  if (msg.includes("prospects_linkedin_uniq")) return "Já existe um prospect com esse LinkedIn.";
  if (msg.includes("prospects_site_uniq")) return "Já existe um prospect com esse site.";
  if (msg.includes("nao_abordar")) return "Este prospect pediu para não ser abordado. Reabra antes de registrar contato.";
  if (msg.includes("ja_virou_negocio")) return "Este prospect já virou negócio. Continue pelo Funil.";
  if (msg.includes("data_no_passado")) return "Escolha uma data de hoje em diante.";
  if (msg.includes("informe_a_data")) return "Escolha quando falar de novo.";
  if (msg.includes("precisa_email_ou_whatsapp")) return "Para virar negócio, informe o e-mail ou o WhatsApp do contato.";
  if (msg.includes("informe_lista_e_origem")) return "Dê um nome à lista e diga de onde vieram os contatos.";
  if (msg.includes("planilha_grande_demais")) return "Planilha grande demais: importe até 2.000 linhas por vez.";
  const codigos: Record<string, string> = {
    nome_invalido: "Informe o nome.", email_invalido: "Confira o e-mail.", whatsapp_invalido: "Confira o WhatsApp.",
    descricao_invalida: "Descreva a necessidade (mínimo 10 caracteres).", servico_invalido: "Escolha ao menos um serviço.",
    muitos_pedidos: "Muitos pedidos em pouco tempo. Aguarde alguns minutos.",
  };
  for (const [k, v] of Object.entries(codigos)) if (msg.includes(k)) return v;
  console.error("acao", msg);
  return "Não deu certo agora. Tente de novo.";
}

type Cliente = Awaited<ReturnType<typeof supabaseServidor>>;
type Resposta<T> = { error: { message: string } | null; data?: T | null };

/**
 * Executa a escrita no Supabase (com a sessão do usuário), traduz erros e revalida as telas.
 * `exigeLinha`: UPDATE/DELETE bloqueado pela RLS não dá erro — só afeta 0 linhas. Com `.select("id")`
 * na consulta, 0 linhas vira erro em vez de um "sucesso" falso na tela.
 */
export async function executar<T>(
  fn: (sb: Cliente) => PromiseLike<Resposta<T>>,
  revalidar: string[] = [],
  exigeLinha = false,
): Promise<Resultado<T>> {
  if (OFFLINE) return { ok: true };
  try {
    const { error, data } = await fn(await supabaseServidor());
    if (error) return { ok: false, erro: traduzir(error.message) };
    if (exigeLinha && Array.isArray(data) && data.length === 0) return { ok: false, erro: SEM_PERMISSAO };
    revalidar.forEach((p) => revalidatePath(p));
    return { ok: true, dados: data ?? undefined };
  } catch (e) {
    console.error("acao", e);
    return { ok: false, erro: "Sem conexão com o servidor. Tente de novo." };
  }
}

