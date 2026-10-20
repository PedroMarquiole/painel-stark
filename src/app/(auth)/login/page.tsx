import type { Metadata } from "next";
import { LoginForm } from "./form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ voltar?: string }> }) {
  const { voltar = "/" } = await searchParams;
  return (
    <>
      <LoginForm voltar={voltar} />
      <p className="mt-4 text-center text-xs text-fg-subtle">Acesso só da equipe Stark. Contas são criadas pelo admin.</p>
    </>
  );
}
