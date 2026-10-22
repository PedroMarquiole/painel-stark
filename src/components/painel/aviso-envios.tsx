"use client";
import * as React from "react";
import { AlertTriangle, X } from "lucide-react";
import type { FalhaEnvio } from "@/lib/dados/consultas";

/** Traduz o erro do provedor para o que fazer. */
function motivo(erro: string) {
  if (/verify a domain|own email address|testing emails/i.test(erro)) {
    return { titulo: "Os e-mails não estão chegando aos clientes", texto: "O Resend ainda está em modo de teste: só entrega para o seu próprio e-mail. Verifique o domínio da Stark em resend.com/domains e configure o remetente (EMAIL_FROM) no Supabase.", link: "https://resend.com/domains" };
  }
  if (/api key|unauthorized|401/i.test(erro)) return { titulo: "Envio de e-mail parado", texto: "A chave do Resend é inválida ou expirou. Gere outra em resend.com e atualize RESEND_API_KEY no Supabase.", link: "https://resend.com/api-keys" };
  return { titulo: "Alguns envios falharam", texto: erro.slice(0, 200), link: null };
}

export function AvisoEnvios({ falhas }: { falhas: FalhaEnvio[] }) {
  const chave = falhas.map((f) => f.ultimo).join("|");
  const [fechado, setFechado] = React.useState<string | null>(null);
  React.useEffect(() => { try { setFechado(sessionStorage.getItem("aviso-envios")); } catch { /* sem armazenamento */ } }, []);
  if (!falhas.length || fechado === chave) return null;
  const total = falhas.reduce((s, f) => s + f.n, 0);
  const m = motivo(falhas[0].erro);
  return (
    <div role="alert" className="mx-4 mt-4 flex items-start gap-3 rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm lg:mx-8">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{m.titulo} <span className="font-normal text-fg-muted">({total} {total === 1 ? "envio falhou" : "envios falharam"} nos últimos 7 dias)</span></p>
        <p className="mt-0.5 text-fg-muted">{m.texto} {m.link && <a href={m.link} target="_blank" rel="noreferrer" className="text-accent underline">Abrir</a>}</p>
      </div>
      <button aria-label="Fechar aviso" className="rounded-md p-1 text-fg-muted hover:text-fg"
        onClick={() => { setFechado(chave); try { sessionStorage.setItem("aviso-envios", chave); } catch { /* ok */ } }}><X className="size-4" /></button>
    </div>
  );
}
