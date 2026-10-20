"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Clock, Flame } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { KpiCard } from "@/components/domain/kpi-card";
import { BarrasHorizontais, Funil, LinhaSemanal } from "@/components/charts/graficos";
import { formatBRL } from "@/lib/utils";
import { MOTIVOS_PERDA, SERVICOS, SITUACOES, rotuloOrigem } from "@/lib/rotulos";
import type { Indicadores } from "@/lib/dados/tipos";

const variacao = (p: { atual: number | null; anterior: number | null }) =>
  p.atual == null || !p.anterior ? undefined : (p.atual - p.anterior) / p.anterior;

export const horas = (h: number | null) => {
  if (h == null) return "—";
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return hh >= 48 ? `${Math.round(hh / 24)} dias` : hh ? `${hh}h ${String(mm).padStart(2, "0")}min` : `${mm}min`;
};
const mil = (v: number | null) => (v == null ? "—" : v >= 10000 ? `R$ ${Math.round(v / 1000)} mil` : formatBRL(v));
const saudacao = () => {
  const h = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date()));
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
};

export function Inicio({ k, nome }: { k: Indicadores; nome: string }) {
  const router = useRouter();
  const serie = k.serie;
  const hint = "vs. anterior";
  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{saudacao()}, {nome.split(" ")[0]}</h1>
          <p className="text-sm text-fg-muted">Últimos {k.dias} dias, comparados com o período anterior.</p>
        </div>
        <Segmented
          label="Período"
          value={String(k.dias)}
          onChange={(v) => router.push(`/?dias=${v}`)}
          options={[{ value: "7", label: "7 dias" }, { value: "30", label: "30 dias" }, { value: "90", label: "90 dias" }]}
        />
      </div>

      {/* SLA agora: o que precisa de ação */}
      <div className="grid gap-gap sm:grid-cols-3">
        {[
          { rotulo: "Sem resposta agora", n: k.sla_agora.abertos, Icone: Clock, cor: "text-fg", href: "/leads" },
          { rotulo: "Vencendo em menos de 4h", n: k.sla_agora.vencendo, Icone: AlertTriangle, cor: "text-warning", href: "/leads" },
          { rotulo: "SLA estourado", n: k.sla_agora.estourados, Icone: Flame, cor: "text-danger", href: "/leads?visao=estourados" },
        ].map(({ rotulo, n, Icone, cor, href }) => (
          <Link key={rotulo} href={href} className="flex items-center gap-3 rounded-lg border border-border bg-raised px-card py-3 transition-colors hover:border-border-strong">
            <Icone className={`size-4 ${n ? cor : "text-fg-subtle"}`} aria-hidden />
            <span className="flex-1 text-sm text-fg-muted">{rotulo}</span>
            <span className={`num text-md ${n ? cor : "text-fg-subtle"}`}>{n}</span>
          </Link>
        ))}
      </div>

      <div className="grid gap-gap sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Leads recebidos" value={String(k.leads.atual ?? 0)} delta={variacao(k.leads)} hint={hint} trend={serie.map((s) => s.leads)} href="/leads?visao=todos" />
        <KpiCard label="1ª resposta (média)" value={horas(k.primeira_resposta_horas.atual)} delta={variacao(k.primeira_resposta_horas)} goodWhen="down" hint={hint}
          trend={serie.map((s) => s.resposta_horas ?? 0)} color="var(--c-series-2)" href="/leads?visao=todos" />
        <KpiCard label="Dentro do SLA" value={k.sla_pct.atual == null ? "—" : `${k.sla_pct.atual}%`} delta={variacao(k.sla_pct)} hint={hint}
          trend={serie.map((s) => s.sla_pct ?? 0)} color="var(--c-series-3)" href="/leads?visao=estourados" />
        <KpiCard label="Receita fechada" value={mil(k.receita.atual)} delta={variacao(k.receita)} hint={hint}
          trend={serie.map((s) => s.receita)} color="var(--c-series-4)" href="/funil" />
        <KpiCard label="Taxa de ganho" value={k.taxa_ganho_pct.atual == null ? "—" : `${k.taxa_ganho_pct.atual}%`} delta={variacao(k.taxa_ganho_pct)} hint={hint} href="/funil" />
        <KpiCard label="Ticket médio" value={mil(k.ticket_medio.atual)} delta={variacao(k.ticket_medio)} hint={hint} href="/funil" />
        <KpiCard label="Ciclo de venda" value={k.ciclo_dias.atual == null ? "—" : `${String(k.ciclo_dias.atual).replace(".", ",")} dias`} delta={variacao(k.ciclo_dias)} goodWhen="down" hint={hint} href="/funil" />
        <KpiCard label="Previsão (pipeline ponderado)" value={mil(k.pipeline_ponderado)} hint={`de ${mil(k.pipeline_aberto)} em aberto`} href="/funil" />
      </div>

      <div className="grid gap-gap xl:grid-cols-2">
        <Card>
          <CardHeader title="Leads por semana" />
          <div className="p-card pt-2"><LinhaSemanal dados={serie} chave="leads" nome="Leads" /></div>
        </Card>
        <Card>
          <CardHeader title="Tempo de 1ª resposta por semana" action={<span className="text-xs text-fg-subtle">meta: 1 dia útil</span>} />
          <div className="p-card pt-2"><LinhaSemanal dados={serie} chave="resposta_horas" nome="Média" formato={(v) => horas(v)} cor="var(--c-series-2)" /></div>
        </Card>
        <Card>
          <CardHeader title="Leads por serviço" />
          <div className="p-card pt-2">
            <BarrasHorizontais nome="Leads" dados={k.por_servico.map((s) => ({ rotulo: SERVICOS[s.servico], n: s.n, chave: s.servico }))} href={() => "/leads?visao=todos"} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Conversão do funil" action={<span className="text-xs text-fg-subtle">negócios dos últimos {k.dias * 2} dias</span>} />
          <div className="p-card"><Funil etapas={k.funil} /></div>
        </Card>
        <Card>
          <CardHeader title="Origem dos leads" />
          <div className="p-card pt-2">
            <BarrasHorizontais nome="Leads" cor="var(--c-series-2)" dados={k.por_origem.map((o) => ({ rotulo: rotuloOrigem(o.origem), n: o.n, chave: o.origem }))} href={() => "/leads?visao=todos"} />
          </div>
        </Card>
        <div className="grid gap-gap md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <Card>
            <CardHeader title="Como resolvem hoje" />
            <div className="p-card pt-2">
              <BarrasHorizontais nome="Leads" cor="var(--c-series-3)" dados={k.por_situacao.map((s) => ({ rotulo: SITUACOES[s.situacao as keyof typeof SITUACOES] ?? s.situacao, n: s.n, chave: s.situacao }))} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Motivos de perda" />
            <div className="p-card pt-2">
              <BarrasHorizontais nome="Perdas" cor="var(--c-series-5)" dados={k.motivos_perda.map((m) => ({ rotulo: MOTIVOS_PERDA[m.motivo], n: m.n, chave: m.motivo }))} href={() => "/funil"} />
            </div>
          </Card>
        </div>
      </div>
      <p className="text-xs text-fg-subtle">Utilização da equipe (horas × capacidade) e MRR entram com projetos e financeiro (Fases 3 e 4).</p>
    </div>
  );
}
