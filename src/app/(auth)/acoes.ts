"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { supabaseServidor } from "@/lib/supabase/server";
import { caminhoInterno } from "@/lib/redirect";

export type EstadoForm = { erro?: string; ok?: string } | undefined;

export async function entrar(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const senha = String(form.get("senha") ?? "");
  const voltar = String(form.get("voltar") ?? "/");
  if (!email || !senha) return { erro: "Informe e-mail e senha." };

  const supabase = await supabaseServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) {
    return { erro: error.message.includes("Invalid login") ? "E-mail ou senha incorretos." : "Não foi possível entrar agora. Tente de novo." };
  }
  redirect(caminhoInterno(voltar, "https://painel.interno"));
}

export async function esqueciSenha(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!email) return { erro: "Informe seu e-mail." };
  const h = await headers();
  const origem = process.env.PANEL_URL || `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const supabase = await supabaseServidor();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origem}/auth/callback?proximo=/redefinir-senha` });
  // Mesma resposta exista ou não a conta (não revela quem é da equipe)
  return { ok: "Se esse e-mail tiver acesso, enviamos um link para criar uma nova senha." };
}

export async function redefinirSenha(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const senha = String(form.get("senha") ?? "");
  if (senha.length < 10) return { erro: "Use pelo menos 10 caracteres." };
  const supabase = await supabaseServidor();
  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) return { erro: "O link expirou. Peça um novo em “Esqueci minha senha”." };
  redirect("/");
}

export async function sair() {
  const supabase = await supabaseServidor();
  await supabase.auth.signOut();
  redirect("/login");
}
