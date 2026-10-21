"use client";
import Link from "next/link";
import * as React from "react";
import * as Switch from "@radix-ui/react-switch";
import { CheckCircle2, CircleSlash, Clock, Send, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { usePainel } from "@/components/painel/contexto";
import { cn, formatRelative } from "@/lib/utils";
import type { Automacao, Execucao } from "@/lib/dados/tipos";
import { useNow } from "@/hooks/use-now";
import { chamar } from "@/lib/chamar";
import { alternarAutomacao } from "../acoes";

const GATILHOS: Record<string, string> = {
  "lead.criado": "Novo lead", "sla.vencendo": "Prazo perto de vencer", "lead.sem_resposta": "Lead sem resposta",
  "negocio.parado": "Negócio parado", "reuniao.agendada": "Reunião agendada", "proposta.visualizada": "Proposta visualizada",
  "proposta.sem_resposta": "Proposta sem resposta", "proposta.aceita": "Proposta aceita", "fatura.vencimento": "Fatura vencendo",
  "projeto.entregue": "Projeto entregue", "cron:seg_07h": "Toda segunda, 7h", "cron:diario_07h": "Todo dia, 7h",
};
const FASE_ATUAL = 1;
const statusIcone = { sucesso: CheckCircle2, erro: XCircle, executando: Clock, pendente: Clock, ignorada: CircleSlash } as const;

export function Automacoes({ regras: iniciais, execucoes }: { regras: Automacao[]; execucoes: Execucao[] }) {
  const { perfil } = usePainel();
  const [regras, setRegras] = React.useState(iniciais);
  const admin = perfil.papel === "admin";
  const agora = useNow();

  async function alternar(r: Automacao, ativa: boolean) {
    setRegras((xs) => xs.map((x) => (x.id === r.id ? { ...x, ativa } : x)));
    const res = await chamar(alternarAutomacao(r.id, ativa));
    if (!res.ok) {
      setRegras((xs) => xs.map((x) => (x.id === r.id ? { ...x, ativa: !ativa } : x)));
      toast.error(res.erro);
    } else toast.success(`${r.nome}: ${ativa ? "ligada" : "desligada"}`);
  }

  const interruptor = (r: (typeof regras)[number]) => {
    const disponivel = r.fase <= FASE_ATUAL;
    return disponivel ? (
                      <Switch.Root
                        checked={r.ativa}
                        disabled={!admin}
                        onCheckedChange={(v) => alternar(r, v)}
                        aria-label={`${r.ativa ? "Desligar" : "Ligar"} ${r.nome}`}
                        className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-border-strong bg-overlay transition-colors data-[state=checked]:border-accent-fill data-[state=checked]:bg-accent-fill disabled:opacity-50"
                      >
                        <Switch.Thumb className="block size-3.5 translate-x-0.5 rounded-full bg-fg transition-transform duration-150 data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-accent-fg" />
                      </Switch.Root>
                    ) : (
                      <Tooltip content="Entra numa próxima fase do painel"><span><Badge tone="outline">Fase {r.fase}</Badge></span></Tooltip>
                    );
  };

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-4 pb-8 pt-2 sm:px-6 lg:pl-1">
      <div>
        <h1 className="text-xl font-semibold">Automações</h1>
        <p className="mt-1 max-w-2xl text-sm text-fg-muted">
          O sistema trabalha, a equipe decide. Cada regra roda uma vez por ocorrência (nada é enviado duas vezes), tenta de novo se der erro e respeita o opt-out do cliente.
          {!admin && " Só o admin liga e desliga regras."}
        </p>
      </div>

      {/* Celular: uma regra por cartão, com o interruptor sempre à vista */}
      <ul className="flex flex-col gap-2 sm:hidden">
        {regras.map((r) => (
          <li key={r.id} className={cn("flex items-start gap-3 rounded-2xl bg-bloco p-4 shadow-bloco", r.fase > FASE_ATUAL && "text-fg-subtle")}>
            <span className="num w-5 shrink-0 pt-0.5 text-xs text-fg-subtle">{r.numero}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{r.nome}</span>
              <span className="block text-xs text-fg-muted">{GATILHOS[r.gatilho] ?? r.gatilho}{r.envia_ao_cliente ? ", fala com o cliente" : ""}</span>
            </span>
            {interruptor(r)}
          </li>
        ))}
      </ul>

      <Card className="hidden overflow-x-auto px-1 py-1.5 sm:block">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-fg-subtle [&>th]:py-3">
              <th className="w-10 px-4 py-2 font-normal">#</th>
              <th className="px-2 py-2 font-normal">Regra</th>
              <th className="px-2 py-2 font-normal">Quando</th>
              <th className="px-2 py-2 font-normal">Fala com o cliente</th>
              <th className="w-28 px-4 py-2 text-right font-normal">Ligada</th>
            </tr>
          </thead>
          <tbody>
            {regras.map((r) => {
              const disponivel = r.fase <= FASE_ATUAL;
              return (
                <tr key={r.id} style={{ height: "var(--row-h)" }} className={cn("border-b border-border/70 last:border-0", !disponivel && "text-fg-subtle")}>
                  <td className="num px-4 text-xs text-fg-subtle">{r.numero}</td>
                  <td className="px-2 py-2">
                    <p className={cn("font-medium", !disponivel && "font-normal")}>{r.nome}</p>
                    {r.descricao && <p className="text-xs text-fg-muted">{r.descricao}</p>}
                  </td>
                  <td className="px-2 text-fg-muted">{GATILHOS[r.gatilho] ?? r.gatilho}</td>
                  <td className="px-2">{r.envia_ao_cliente ? <Badge tone="info"><Send aria-hidden />sim</Badge> : <span className="text-xs text-fg-subtle">não</span>}</td>
                  <td className="px-4 text-right">
                    {interruptor(r)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <section>
        <h2 className="mb-3 text-md font-semibold">Últimas execuções</h2>
        <Card className="p-1.5">
          {execucoes.length === 0 && <p className="px-4 py-8 text-center text-sm text-fg-muted">Nenhuma execução ainda. Elas aparecem quando chega o primeiro pedido.</p>}
          <ul>
            {execucoes.map((e) => {
              const I = statusIcone[e.status as keyof typeof statusIcone] ?? Clock;
              return (
                <li key={e.id} className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm hover:bg-bloco-inset">
                  <I className={cn("size-4 shrink-0", e.status === "sucesso" ? "text-success" : e.status === "erro" ? "text-danger" : "text-fg-subtle")} aria-label={e.status} />
                  <span className="flex-1 truncate">{e.automacao}</span>
                  {e.entidade_tipo === "lead" && e.entidade_id && <Link href={`/leads?id=${e.entidade_id}`} className="text-xs text-fg-muted hover:text-fg hover:underline">ver pedido</Link>}
                  {e.erro && <span className="max-w-60 truncate text-xs text-danger" title={e.erro}>{e.erro}</span>}
                  <span className="num w-16 text-right text-xs text-fg-subtle">{agora ? formatRelative(new Date(e.created_at), agora) : ""}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      </section>
    </div>
  );
}
