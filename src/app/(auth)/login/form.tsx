"use client";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { entrar, esqueciSenha } from "../acoes";

export function LoginForm({ voltar }: { voltar: string }) {
  const [modo, setModo] = useState<"entrar" | "esqueci">("entrar");
  const [estado, acao, enviando] = useActionState(modo === "entrar" ? entrar : esqueciSenha, undefined);
  return (
    <form action={acao} className="flex flex-col gap-4 rounded-xl border border-border bg-raised p-6">
      <h1 className="text-md font-semibold">{modo === "entrar" ? "Entrar" : "Criar nova senha"}</h1>
      <input type="hidden" name="voltar" value={voltar} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </div>
      {modo === "entrar" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="senha">Senha</Label>
          <Input id="senha" name="senha" type="password" autoComplete="current-password" required />
        </div>
      )}
      {estado?.erro && <p role="alert" className="text-sm text-danger">{estado.erro}</p>}
      {estado?.ok && <p role="status" className="text-sm text-success">{estado.ok}</p>}
      <Button variant="primary" size="lg" disabled={enviando} type="submit">
        {enviando ? "Aguarde…" : modo === "entrar" ? "Entrar" : "Enviar link"}
      </Button>
      <button
        type="button"
        onClick={() => setModo(modo === "entrar" ? "esqueci" : "entrar")}
        className="self-start text-xs text-fg-muted hover:text-fg"
      >
        {modo === "entrar" ? "Esqueci minha senha" : "← Voltar para o login"}
      </button>
    </form>
  );
}
