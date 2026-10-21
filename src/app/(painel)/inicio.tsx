"use client";
import Link from "next/link";
import { CircleDollarSign, Clock, Inbox, Target } from "lucide-react";
import { Funil, LinhaSemanal } from "@/components/charts/graficos";
import { Sparkline } from "@/components/charts/sparkline";
import { SlaBadge } from "@/components/domain/sla-badge";
import { Bloco, Indicador, MiniBarras, Periodo, Titulo, Variacao, horas, mil, plural, saudacao, variacao } from "@/components/painel/blocos";
import { SERVICOS } from "@/lib/rotulos";
import type { Indicadores, LeadInbox } from "@/lib/dados/tipos";

const protocolo = (n: number) => `#${String(n).padStart(4, "0")}`;

/** Medidor em semicírculo: a promessa do site (resposta em 1 dia útil), em uma imagem. */
function MedidorSla({ pct, delta, href }: { pct: number | null; delta?: number; href: string }) {
  const r = 78, c = Math.PI * r, v = Math.max(0, Math.min(100, pct ?? 0));
  return (
    <Bloco href={href} className="items-center text-center">
      <div className="mb-1 flex w-full items-baseline justify-between">
        <h2 className="text-md font-medium">Dentro do SLA</h2>
        <span className="text-xs text-fg-subtle">meta: 1 dia útil</span>
      </div>
      <svg viewBox="0 0 200 112" className="mt-2 w-full max-w-[240px]" role="img"
        aria-label={pct == null ? "Sem pedidos no período" : `${pct}% dos pedidos respondidos no prazo`}>
        <path d={`M ${100 - r} 100 A ${r} ${r} 0 0 1 ${100 + r} 100`} fill="none" stroke="var(--c-bloco-inset)" strokeWidth={16} strokeLinecap="round" />
        {pct != null && v > 0 && (
          <path d={`M ${100 - r} 100 A ${r} ${r} 0 0 1 ${100 + r} 100`} fill="none" stroke="var(--c-accent-fill)" strokeWidth={16}
            strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} />
        )}
        <text x="100" y="92" textAnchor="middle" className="num" fill="var(--c-fg)" fontSize="34" fontWeight="500">
          {pct == null ? "—" : `${pct}%`}
        </text>
      </svg>
      <p className="mt-1 text-sm text-fg-muted">dos pedidos respondidos no prazo</p>
      <div className="mt-3"><Variacao delta={delta} /></div>
    </Bloco>
  );
}

/** Quem está esperando resposta, do prazo mais apertado para o mais folgado. */
function Fila({ leads, vencendo, estourados }: { leads: LeadInbox[]; vencendo: number; estourados: number }) {
  const MAX = 5;
  return (
    <Bloco className="sm:col-span-2 xl:col-span-3">
      <Titulo extra={leads.length > 0 && (
        <>
          {estourados > 0 && <span className="text-danger">{estourados} estourado{estourados > 1 ? "s" : ""}</span>}
          {estourados > 0 && vencendo > 0 && ", "}
          {vencendo > 0 && <span className="text-warning">{vencendo} vencendo</span>}
        </>
      )}>
        Precisa de você agora
      </Titulo>
      {leads.length === 0 ? (
        <p className="my-auto py-8 text-center text-sm text-fg-muted">Todos os pedidos foram respondidos.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {leads.slice(0, MAX).map((l) => (
            <li key={l.id}>
              <Link href={`/leads?id=${l.id}`}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 rounded-xl bg-bloco-inset px-3.5 py-2.5 transition-colors hover:bg-overlay sm:grid-cols-[52px_minmax(0,1fr)_minmax(0,1.3fr)_auto]">
                <span className="num text-xs text-fg-subtle">{protocolo(l.protocolo)}</span>
                <span className="min-w-0 truncate text-sm">
                  {l.nome}{l.empresa && <span className="text-fg-subtle">, {l.empresa}</span>}
                </span>
                <span className="hidden min-w-0 truncate text-sm text-fg-muted sm:block">{l.servicos.map((s) => SERVICOS[s]).join(", ")}</span>
                <SlaBadge deadline={new Date(l.sla_vence_em)} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {leads.length > 0 && (
        <Link href="/leads" className="mt-3 self-start text-sm text-accent hover:underline">
          {leads.length > MAX ? `Ver todos os ${leads.length} na caixa de entrada` : "Abrir a caixa de entrada"}
        </Link>
      )}
    </Bloco>
  );
}

export function Inicio({ k, nome, pendentes }: { k: Indicadores; nome: string; pendentes: LeadInbox[] }) {
  const serie = k.serie;
  const { abertos, vencendo, estourados } = k.sla_agora;
  const resumo = abertos === 0
    ? `Nenhum pedido esperando resposta. Estes são os números dos últimos ${k.dias} dias.`
    : `${plural(abertos, "pedido espera", "pedidos esperam")} resposta${estourados ? `, ${estourados} com prazo estourado` : vencendo ? `, ${vencendo} vencendo em menos de 4h` : ""}.`;
  const todos = `/leads?visao=todos&dias=${k.dias}`;

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-4 pb-8 pt-2 sm:px-6 lg:pl-1">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{saudacao()}, {nome.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-fg-muted">{resumo}</p>
        </div>
        <Periodo dias={k.dias} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Fila leads={pendentes} vencendo={vencendo} estourados={estourados} />
        <MedidorSla pct={k.sla_pct.atual} delta={variacao(k.sla_pct)} href={todos} />

        <Indicador Icone={Inbox} rotulo="Leads recebidos" valor={String(k.leads.atual ?? 0)} delta={variacao(k.leads)} href={todos}
          grafico={<MiniBarras valores={serie.map((s) => s.leads)} />} />
        <Indicador Icone={Clock} rotulo="1ª resposta (média)" valor={horas(k.primeira_resposta_horas.atual)} delta={variacao(k.primeira_resposta_horas)}
          bomQuando="desce" href={todos} grafico={<Sparkline data={serie.map((s) => s.resposta_horas)} color="var(--c-series-2)" />} />
        <Indicador Icone={CircleDollarSign} rotulo="Receita fechada" valor={mil(k.receita.atual)} delta={variacao(k.receita)} href="/funil"
          grafico={<Sparkline data={serie.map((s) => s.receita)} color="var(--c-series-3)" />} />
        <Bloco href="/funil" className="gap-4">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-full bg-bloco-inset text-fg-muted [&_svg]:size-4"><Target aria-hidden /></span>
            <span className="text-sm text-fg-muted">Previsão de vendas</span>
          </div>
          <div>
            <div className="num text-xl font-medium">{mil(k.pipeline_ponderado)}</div>
            <p className="mt-1.5 text-xs text-fg-subtle">ponderada pela chance de cada negócio, de {mil(k.pipeline_aberto)} em aberto</p>
          </div>
        </Bloco>

        <Bloco className="sm:col-span-2">
          <Titulo extra="por semana">Leads recebidos</Titulo>
          <LinhaSemanal dados={serie} chave="leads" nome="Leads" />
        </Bloco>
        <Bloco className="sm:col-span-2">
          <Titulo extra={`negócios dos últimos ${k.dias * 2} dias`}>Conversão do funil</Titulo>
          <Funil etapas={k.funil} destacarFim />
        </Bloco>
      </div>
      <Link href={`/relatorios?dias=${k.dias}`} className="self-start text-sm text-fg-muted hover:text-fg">
        Origem dos leads, serviços, motivos de perda e tempo de resposta por semana estão em <span className="text-accent">Relatórios</span>.
      </Link>
    </div>
  );
}
