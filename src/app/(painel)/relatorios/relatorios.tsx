"use client";
import Link from "next/link";
import { BarrasHorizontais, LinhaSemanal } from "@/components/charts/graficos";
import { Bloco, Periodo, Titulo, Variacao, horas, mil, variacao } from "@/components/painel/blocos";
import { MOTIVOS_PERDA, SERVICOS, SITUACOES, rotuloOrigem } from "@/lib/rotulos";
import type { Indicadores } from "@/lib/dados/tipos";

/** Análises para consultar de vez em quando. O dia a dia fica na Início. */
export function Relatorios({ k }: { k: Indicadores }) {
  const todos = `/leads?visao=todos&dias=${k.dias}`;
  const vendas = [
    { rotulo: "Taxa de ganho", valor: k.taxa_ganho_pct.atual == null ? "—" : `${k.taxa_ganho_pct.atual}%`, delta: variacao(k.taxa_ganho_pct), bom: "sobe" as const },
    { rotulo: "Ticket médio", valor: mil(k.ticket_medio.atual), delta: variacao(k.ticket_medio), bom: "sobe" as const },
    { rotulo: "Ciclo de venda", valor: k.ciclo_dias.atual == null ? "—" : `${String(k.ciclo_dias.atual).replace(".", ",")} dias`, delta: variacao(k.ciclo_dias), bom: "desce" as const },
  ];
  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-4 pb-8 pt-2 sm:px-6 lg:pl-1">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Relatórios</h1>
          <p className="mt-1 text-sm text-fg-muted">Últimos {k.dias} dias, comparados com o período anterior. Clique numa barra para ver os leads.</p>
        </div>
        <Periodo dias={k.dias} base="/relatorios" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Bloco>
          <Titulo extra="meta: 1 dia útil">Tempo de 1ª resposta por semana</Titulo>
          <LinhaSemanal dados={k.serie} chave="resposta_horas" nome="Média" formato={(v) => horas(v)} cor="var(--c-series-2)" />
        </Bloco>
        <Bloco>
          <Titulo>Vendas</Titulo>
          <dl className="flex flex-1 flex-col justify-center gap-1.5">
            {vendas.map((i) => (
              <Link key={i.rotulo} href="/funil" className="flex items-center justify-between gap-3 rounded-xl bg-bloco-inset px-3.5 py-3 transition-colors hover:bg-overlay">
                <dt className="text-sm text-fg-muted">{i.rotulo}</dt>
                <dd className="flex items-center gap-3">
                  {i.delta != null && <Variacao delta={i.delta} bomQuando={i.bom} />}
                  <span className="num text-md font-medium">{i.valor}</span>
                </dd>
              </Link>
            ))}
          </dl>
        </Bloco>
        <Bloco>
          <Titulo>Leads por serviço</Titulo>
          <BarrasHorizontais nome="Leads" dados={k.por_servico.map((s) => ({ rotulo: SERVICOS[s.servico], n: s.n, chave: s.servico }))}
            href={(c) => `${todos}&servico=${c}`} />
        </Bloco>
        <Bloco>
          <Titulo>Origem dos leads</Titulo>
          <BarrasHorizontais nome="Leads" cor="var(--c-series-2)" dados={k.por_origem.map((o) => ({ rotulo: rotuloOrigem(o.origem), n: o.n, chave: o.origem }))}
            href={(c) => `${todos}&origem=${c}`} />
        </Bloco>
        <Bloco>
          <Titulo>Como resolvem hoje</Titulo>
          <BarrasHorizontais nome="Leads" cor="var(--c-series-3)"
            dados={k.por_situacao.map((s) => ({ rotulo: SITUACOES[s.situacao as keyof typeof SITUACOES] ?? s.situacao, n: s.n, chave: s.situacao }))}
            href={(c) => `${todos}&situacao=${c}`} />
        </Bloco>
        <Bloco>
          <Titulo>Motivos de perda</Titulo>
          <BarrasHorizontais nome="Perdas" cor="var(--c-series-5)" dados={k.motivos_perda.map((m) => ({ rotulo: MOTIVOS_PERDA[m.motivo], n: m.n, chave: m.motivo }))}
            href={() => "/funil"} />
        </Bloco>
      </div>
      <p className="text-xs text-fg-subtle">Utilização da equipe e MRR entram com projetos e financeiro (Fases 3 e 4).</p>
    </div>
  );
}
