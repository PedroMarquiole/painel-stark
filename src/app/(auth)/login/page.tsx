import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { OFFLINE } from "@/lib/env";
import { caminhoInterno } from "@/lib/redirect";
import { perfilAtual } from "@/lib/dados/consultas";
import { supabaseServidor } from "@/lib/supabase/server";
import { sair } from "../acoes";
import { LoginForm } from "./form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ voltar?: string; link?: string }> }) {
  const { voltar, link } = await searchParams;
  const destino = caminhoInterno(voltar, "https://painel.interno");

  if (!OFFLINE) {
    const sb = await supabaseServidor();
    const { data } = await sb.auth.getUser();
    if (data.user) {
      if (await perfilAtual()) redirect(destino);
      return (
        <div className="flex flex-col gap-4 rounded-2xl bg-bloco p-7 shadow-bloco">
          <h1 className="text-xl font-semibold">Acesso desativado</h1>
          <p className="text-sm text-fg-muted">A conta {data.user.email} não está ativa no Painel Stark. Fale com o admin da Stark.</p>
          <form action={sair}><Button type="submit">Sair</Button></form>
        </div>
      );
    }
  }

  return (
    <>
      {link === "expirado" && <p role="alert" className="mb-3 text-sm text-warning">O link expirou ou já foi usado. Peça um novo em “Esqueci minha senha”.</p>}
      <LoginForm voltar={destino} />
      <p className="mt-4 text-center text-xs text-fg-subtle">Acesso só da equipe Stark. Contas são criadas pelo admin.</p>
    </>
  );
}
