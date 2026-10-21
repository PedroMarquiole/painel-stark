"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { redefinirSenha } from "../acoes";

export default function RedefinirSenha() {
  const [estado, acao, enviando] = useActionState(redefinirSenha, undefined);
  return (
    <form action={acao} className="flex flex-col gap-4 rounded-2xl bg-bloco p-7 shadow-bloco">
      <h1 className="text-xl font-semibold">Nova senha</h1>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="senha">Senha (mínimo 10 caracteres)</Label>
        <Input id="senha" name="senha" type="password" autoComplete="new-password" minLength={10} required autoFocus />
      </div>
      {estado?.erro && <p role="alert" className="text-sm text-danger">{estado.erro}</p>}
      <Button variant="primary" size="lg" disabled={enviando} type="submit">Salvar e entrar</Button>
    </form>
  );
}
