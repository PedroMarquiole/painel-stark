"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownRight, ArrowUpRight, CircleDollarSign, Clock, Inbox, Minus, Target, type LucideIcon } from "lucide-react";
import { BarrasHorizontais, Funil, LinhaSemanal } from "@/components/charts/graficos";
import { Sparkline } from "@/components/charts/sparkline";
import { cn, formatBRL } from "@/lib/utils";
import { MOTIVOS_PERDA, SERVICOS, SITUACOES, rotuloOrigem } from "@/lib/rotulos";
import type { Indicadores } from "@/lib/dados/tipos";

type Par = { atual: number | null; anterior: number | null };
const variacao = (p: Par) => (p.atual == null || !p.anterior ? undefined : (p.atual - p.anterior) / p.anterior);

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
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Bloco da grade: flutua sobre o fundo (sombra, sem borda). */
function Bloco({ className, href, children }: { className?: string; href?: string; children: React.ReactNode }) {
  const cls = cn("flex flex-col rounded-2xl bg-bloco p-5 shadow-bloco", href && "transition-transform duration-150 hover:-translate-y-px", className);
  return href ? <Link href={href} className={cls}>{children}</Link> : <section className={cls}>{children}</section>;
}

function Titulo({ children, extra }: { children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-2">
      <h2 className="text-md font-medium">{children}</h2>
      {extra && <span className="text-xs text-fg-subtle">{extra}</span>}
    </div>
  );
}

/** Variação vs. período anterior. `bomQuando` diz se subir é bom (receita) ou ruim (tempo de resposta). */
function Variacao({ delta, bomQuando = "sobe" }: { delta?: number; bomQuando?: "sobe" | "desce" }) {
  if (delta == null) return <span className="text-xs text-fg-subtle">sem base de comparação</span>;
  const dir = Math.abs(delta) < 0.005 ? 0 : delta > 0 ? 1 : -1;
  const bom = dir === 0 ? null : (dir > 0) === (bomQuando === "sobe");
  const Icone = dir > 0 ? ArrowUpRight : dir < 0 ? ArrowDownRight : Minus;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-fg-subtle">
      <span className={cn("num inline-flex items-center gap-0.5 rounded-full px-1.5 py-px",
        bom === null ? "bg-overlay text-fg-muted" : bom ? "bg-success/12 text-success" : "bg-danger/12 text-danger")}>
        <Icone className="size-3" aria-hidden />{Math.abs(delta * 100).toFixed(0)}%
      </span>
      vs. anterior
    </span>
  );
}

/** Mini barras por semana; a semana atual em destaque. */
function MiniBarras({ valores }: { valores: (number | null)[] }) {
  const max = Math.max(1, ...valores.map((v) => v ?? 0));
  return (
    <svg viewBox={`0 0 ${valores.length * 8} 40`} className="h-10 w-[72px]" aria-hidden preserveAspectRatio="none">
      {valores.map((v, i) => {
        const h = Math.max(3, ((v ?? 0) / max) * 40);
        return <rect key={i} x={i * 8 + 1.5} y={40 - h} width={5} height={h} rx={2.5}
          fill={i === valores.length - 1 ? "var(--c-accent-fill)" : "var(--c-fg-subtle)"} opacity={i === valores.length - 1 ? 1 : 0.45} />;
      })}
    </svg>
  );
}

function Indicador({ Icone, rotulo, valor, delta, bomQuando, href, grafico }: {
  Icone: LucideIcon; rotulo: string; valor: string; delta?: number; bomQuando?: "sobe" | "desce"; href: string; grafico?: React.ReactNode;
}) {
  return (
    <Bloco href={href} className="gap-4">
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 place-items-center rounded-full bg-bloco-inset text-fg-muted [&_svg]:size-4"><Icone aria-hidden /></span>
        <span className="text-sm text-fg-muted">{rotulo}</span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="num whitespace-nowrap text-xl font-medium">{valor}</div>
          <div className="mt-1.5"><Variacao delta={delta} bomQuando={bomQuando} /></div>
        </div>
        {grafico && <div className="h-10 w-[72px] shrink-0" aria-hidden>{grafico}</div>}
      </div>
    </Bloco>
  );
}

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

function AtencaoAgora({ abertos, vencendo, estourados }: { abertos: number; vencendo: number; estourados: number }) {
  const itens = [
    { rotulo: "Sem resposta", n: abertos, cor: "text-fg", href: "/leads" },
    { rotulo: "Vencendo em menos de 4h", n: vencendo, cor: "text-warning", href: "/leads?visao=vencendo" },
    { rotulo: "Prazo estourado", n: estourados, cor: "text-danger", href: "/leads?visao=estourados" },
  ];
  return (
    <Bloco>
      <Titulo>Precisa de você agora</Titulo>
      {abertos === 0 ? (
        <p className="my-auto py-6 text-center text-sm text-fg-muted">Todos os pedidos foram respondidos.</p>
      ) : (
        <ul className="flex flex-1 flex-col gap-1.5">
          {itens.map(({ rotulo, n, cor, href }) => (
            <li key={rotulo}>
              <Link href={href} className="flex items-center justify-between gap-3 rounded-xl bg-bloco-inset px-3.5 py-3 transition-colors hover:bg-overlay">
                <span className="text-sm text-fg-muted">{rotulo}</span>
                <span className={cn("num text-md font-medium", n ? cor : "text-fg-subtle")}>{n}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Bloco>
  );
}

function Periodo({ dias }: { dias: number }) {
  const router = useRouter();
  return (
    <div role="radiogroup" aria-label="Período" className="inline-flex h-10 items-center gap-0.5 rounded-full bg-bloco p-1 shadow-bloco">
      {[7, 30, 90].map((d) => (
        <button key={d} role="radio" aria-checked={dias === d} onClick={() => router.push(`/?dias=${d}`)}
          className={cn("h-full rounded-full px-3.5 text-xs font-medium transition-colors",
            dias === d ? "bg-invert text-invert-fg" : "text-fg-muted hover:text-fg")}>
          {d} dias
        </button>
      ))}
    </div>
  );
}

export function Inicio({ k, nome }: { k: Indicadores; nome: string }) {
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
        <MedidorSla pct={k.sla_pct.atual} delta={variacao(k.sla_pct)} href={todos} />
        <AtencaoAgora abertos={abertos} vencendo={vencendo} estourados={estourados} />

        <Bloco className="sm:col-span-2">
          <Titulo extra={`negócios dos últimos ${k.dias * 2} dias`}>Conversão do funil</Titulo>
          <Funil etapas={k.funil} destacarFim />
        </Bloco>
        <Bloco>
          <Titulo>Vendas</Titulo>
          <dl className="flex flex-1 flex-col gap-1.5">
            {[
              { rotulo: "Taxa de ganho", valor: k.taxa_ganho_pct.atual == null ? "—" : `${k.taxa_ganho_pct.atual}%`, delta: variacao(k.taxa_ganho_pct), bom: "sobe" as const },
              { rotulo: "Ticket médio", valor: mil(k.ticket_medio.atual), delta: variacao(k.ticket_medio), bom: "sobe" as const },
              { rotulo: "Ciclo de venda", valor: k.ciclo_dias.atual == null ? "—" : `${String(k.ciclo_dias.atual).replace(".", ",")} dias`, delta: variacao(k.ciclo_dias), bom: "desce" as const },
            ].map((i) => (
              <Link key={i.rotulo} href="/funil" className="flex items-center justify-between gap-3 rounded-xl bg-bloco-inset px-3.5 py-2.5 transition-colors hover:bg-overlay">
                <dt className="text-sm text-fg-muted">{i.rotulo}</dt>
                <dd className="text-right">
                  <span className="num block text-md font-medium">{i.valor}</span>
                  {i.delta != null && <Variacao delta={i.delta} bomQuando={i.bom} />}
                </dd>
              </Link>
            ))}
          </dl>
        </Bloco>
        <Bloco>
          <Titulo extra="meta: 1 dia útil">Tempo de 1ª resposta</Titulo>
          <LinhaSemanal dados={serie} chave="resposta_horas" nome="Média" formato={(v) => horas(v)} cor="var(--c-series-2)" />
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
