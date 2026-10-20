"use client";
import * as React from "react";
import { Inbox, Mail, MessageCircle, Plus, RefreshCw, Search, Send, Trash2, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { AppearanceControls } from "@/components/layout/appearance-controls";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { toastUndo } from "@/components/ui/toaster";
import { InlineField } from "@/components/domain/inline-field";
import { KanbanCard } from "@/components/domain/kanban-card";
import { KpiCard } from "@/components/domain/kpi-card";
import { LEAD_GRID, LeadRow, type LeadRowData } from "@/components/domain/lead-row";
import { SlaBadge } from "@/components/domain/sla-badge";
import { STAGES } from "@/components/domain/stage";
import { mockDeals, mockLeads } from "@/lib/design/mock";
import { cn, formatProtocolo } from "@/lib/utils";
import { Funnel, LeadsByService, LeadsTrend } from "./charts-demo";

const SECTIONS = [
  ["cores", "Cores"],
  ["tipografia", "Tipografia"],
  ["espaco", "Espaço, raio, sombra"],
  ["botoes", "Botões"],
  ["campos", "Campos e edição inline"],
  ["badges", "Badges e SLA"],
  ["kpis", "Cartões de KPI"],
  ["tabela", "Linha de tabela"],
  ["kanban", "Card de Kanban"],
  ["drawer", "Drawer e hover"],
  ["toast", "Toast e Desfazer"],
  ["graficos", "Gráficos"],
  ["estados", "Vazio, carregando, erro"],
  ["atalhos", "Atalhos"],
] as const;

function Section({ id, title, desc, children }: { id: string; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-border py-10 first:border-t-0 first:pt-2">
      <h2 className="text-md font-semibold">{title}</h2>
      {desc && <p className="mt-1 max-w-2xl text-sm text-fg-muted">{desc}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Swatch({ name, varName, note }: { name: string; varName: string; note?: string }) {
  const [hex, setHex] = React.useState("");
  React.useEffect(() => {
    const read = () => setHex(getComputedStyle(document.documentElement).getPropertyValue(varName).trim());
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, [varName]);
  return (
    <div className="flex items-center gap-3">
      <span className="size-9 shrink-0 rounded-md border border-border" style={{ background: `var(${varName})` }} />
      <div className="min-w-0">
        <p className="text-sm">{name}</p>
        <p className="num truncate text-xs text-fg-subtle">{varName} · {hex}{note ? ` · ${note}` : ""}</p>
      </div>
    </div>
  );
}

export function DesignSystem() {
  const [leads, setLeads] = React.useState<LeadRowData[] | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [drawer, setDrawer] = React.useState(false);
  const [nome, setNome] = React.useState("Marina Albuquerque");
  const [valor, setValor] = React.useState("48000");

  React.useEffect(() => setLeads(mockLeads(new Date())), []);

  const now = Date.now();
  const lead = leads?.[0];

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-border bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-4 px-4 sm:px-6">
          <span className="grid size-7 place-items-center rounded-md bg-accent text-sm font-bold text-accent-fg">S</span>
          <div className="min-w-0">
            <p className="whitespace-nowrap text-sm font-semibold">Painel Stark</p>
            <p className="hidden text-xs text-fg-muted sm:block">Design system · v0.1</p>
          </div>
          <span className="flex-1" />
          <AppearanceControls />
        </div>
      </header>

      <div className="mx-auto flex max-w-[1440px] gap-10 px-4 sm:px-6">
        <nav aria-label="Seções" className="sticky top-14 hidden h-[calc(100dvh-56px)] w-48 shrink-0 overflow-y-auto py-8 lg:block">
          <ul className="flex flex-col gap-0.5">
            {SECTIONS.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="block rounded-md px-2 py-1 text-sm text-fg-muted transition-colors hover:bg-overlay hover:text-fg">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 flex-1 py-8">
          <h1 className="text-xl font-semibold">Design system</h1>
          <p className="mt-2 max-w-2xl text-sm text-fg-muted">
            Feito para ficar aberto o dia todo: base quente, contraste confortável, um único acento. Componentes usam papéis
            (<code className="num text-fg">bg-raised</code>, <code className="num text-fg">text-fg-muted</code>), nunca hex.
            Troque tema e densidade no topo: tudo aqui reage.
          </p>

          <Section id="cores" title="Cores" desc="4 camadas de superfície em tons próximos, profundidade por borda de 1px. Semânticas dessaturadas só para SLA, status e alertas.">
            <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
              <div className="flex flex-col gap-3">
                <p className="text-xs font-medium uppercase tracking-wider text-fg-subtle">Superfícies</p>
                <Swatch name="Canvas" varName="--c-canvas" note="fundo" />
                <Swatch name="Surface" varName="--c-surface" note="sidebar, colunas" />
                <Swatch name="Raised" varName="--c-raised" note="cards, drawer" />
                <Swatch name="Overlay" varName="--c-overlay" note="hover, menus" />
                <Swatch name="Borda" varName="--c-border" />
              </div>
              <div className="flex flex-col gap-3">
                <p className="text-xs font-medium uppercase tracking-wider text-fg-subtle">Texto e acento</p>
                <Swatch name="Texto" varName="--c-fg" />
                <Swatch name="Texto secundário" varName="--c-fg-muted" />
                <Swatch name="Texto sutil" varName="--c-fg-subtle" note="só metadado" />
                <Swatch name="Acento" varName="--c-accent" note="ações e foco" />
              </div>
              <div className="flex flex-col gap-3">
                <p className="text-xs font-medium uppercase tracking-wider text-fg-subtle">Semânticas</p>
                <Swatch name="Sucesso · no prazo" varName="--c-success" />
                <Swatch name="Atenção · vencendo" varName="--c-warning" />
                <Swatch name="Perigo · estourado" varName="--c-danger" />
                <Swatch name="Info" varName="--c-info" />
              </div>
            </div>
            <div className="mt-8">
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-fg-subtle">
                Série de gráficos · ordem fixa, validada para daltonismo nos dois temas
              </p>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div key={n} className="flex items-center gap-2 rounded-md border border-border bg-raised py-1.5 pl-1.5 pr-3">
                    <span className="size-5 rounded-sm" style={{ background: `var(--c-series-${n})` }} />
                    <span className="num text-xs text-fg-muted">series-{n}</span>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          <Section id="tipografia" title="Tipografia" desc="Geist para a interface, Geist Mono com tabular-nums para números, protocolos e valores. No máximo 4 tamanhos.">
            <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-raised">
              {[
                ["text-xl · 28/34", "text-xl font-semibold", "Leads esta semana"],
                ["text-md · 15/22", "text-md font-semibold", "Caixa de entrada"],
                ["text-sm · 13/20", "text-sm", "Agendamento é feito em 3 lugares diferentes e a recepção perde 2h por dia."],
                ["text-xs · 12/16", "text-xs text-fg-muted", "Chegou há 4 min · google / cpc"],
              ].map(([spec, cls, sample]) => (
                <div key={spec} className="grid grid-cols-1 items-baseline gap-1 p-card sm:grid-cols-[140px_1fr] sm:gap-4">
                  <span className="num text-xs text-fg-subtle">{spec}</span>
                  <span className={cls}>{sample}</span>
                </div>
              ))}
              <div className="grid grid-cols-1 items-baseline gap-1 p-card sm:grid-cols-[140px_1fr] sm:gap-4">
                <span className="num text-xs text-fg-subtle">mono · tnum</span>
                <span className="num text-md">#0142 · R$ 48.000 · 23h 59min · 1.234.567</span>
              </div>
            </div>
          </Section>

          <Section id="espaco" title="Espaço, raio, sombra" desc="Grid de 4/8px. Densidade muda altura de linha e padding de card (variáveis --row-h, --pad-card). Sombras só em camadas flutuantes.">
            <div className="flex flex-wrap items-end gap-6">
              {[4, 8, 12, 16, 24, 32, 48].map((s) => (
                <div key={s} className="flex flex-col items-center gap-2">
                  <span className="rounded-sm bg-accent-soft" style={{ width: s, height: s }} />
                  <span className="num text-xs text-fg-subtle">{s}</span>
                </div>
              ))}
              <span className="mx-2 h-12 w-px bg-border" />
              {[["sm", 4], ["md", 6], ["lg", 8], ["xl", 12]].map(([n, r]) => (
                <div key={n} className="flex flex-col items-center gap-2">
                  <span className="size-12 border border-border-strong bg-raised" style={{ borderRadius: Number(r) }} />
                  <span className="num text-xs text-fg-subtle">{n} · {r}</span>
                </div>
              ))}
              <span className="mx-2 h-12 w-px bg-border" />
              <div className="flex flex-col items-center gap-2">
                <span className="size-12 rounded-lg bg-raised shadow-pop" />
                <span className="num text-xs text-fg-subtle">pop</span>
              </div>
            </div>
          </Section>

          <Section id="botoes" title="Botões" desc="Um primário por área. Ação destrutiva não pede confirmação: executa e oferece Desfazer.">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary"><Send /> Responder</Button>
              <Button><Plus /> Novo lead</Button>
              <Button variant="ghost">Cancelar</Button>
              <Button variant="danger"><Trash2 /> Descartar</Button>
              <Button variant="primary" disabled>Desabilitado</Button>
              <Button size="sm">Pequeno</Button>
              <Button size="icon" variant="ghost" aria-label="Buscar"><Search /></Button>
              <Button variant="secondary">
                Buscar <Kbd className="ml-1">⌘K</Kbd>
              </Button>
            </div>
          </Section>

          <Section id="campos" title="Campos e edição inline" desc="Na ficha, nada de formulário: clique no valor, edite, Enter salva, Esc cancela. Salvamento otimista com indicador discreto.">
            <div className="grid gap-8 lg:grid-cols-2">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ds-busca">Busca</Label>
                  <Input id="ds-busca" placeholder="Nome, e-mail, protocolo…" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ds-email">E-mail (inválido)</Label>
                  <Input id="ds-email" defaultValue="marina@" aria-invalid />
                  <span className="text-xs text-danger">Informe um e-mail completo.</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ds-nota">Nota</Label>
                  <Textarea id="ds-nota" placeholder="O que ficou combinado na ligação…" />
                </div>
              </div>
              <Card className="p-card">
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-fg-subtle">Ficha · edição inline</p>
                <dl className="grid grid-cols-[110px_1fr] items-center gap-y-1 text-sm">
                  <dt className="text-fg-muted">Nome</dt>
                  <dd className="min-w-0"><InlineField value={nome} onSave={async (v) => { await new Promise((r) => setTimeout(r, 600)); setNome(v); }} /></dd>
                  <dt className="text-fg-muted">Valor estimado</dt>
                  <dd className="min-w-0"><InlineField mono value={valor} onSave={async (v) => { await new Promise((r) => setTimeout(r, 600)); setValor(v); }} /></dd>
                  <dt className="text-fg-muted">Empresa</dt>
                  <dd className="min-w-0"><InlineField value="" onSave={() => new Promise((r) => setTimeout(r, 600))} /></dd>
                </dl>
              </Card>
            </div>
          </Section>

          <Section id="badges" title="Badges e SLA" desc="Status sempre com ícone + texto, nunca só cor. O cronômetro conta o '1 dia útil' prometido no site, ao vivo, pulando fins de semana e feriados.">
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>Neutro</Badge>
                <Badge tone="outline">Sistemas web</Badge>
                <Badge tone="accent">novo</Badge>
                <Badge tone="success" dot>Ganho</Badge>
                <Badge tone="warning" dot>Parado</Badge>
                <Badge tone="danger" dot>Perdido</Badge>
                <Badge tone="info" dot>Diagnóstico agendado</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-2 text-xs text-fg-subtle">SLA ao vivo:</span>
                <SlaBadge deadline={new Date(now + 20 * 3600_000)} />
                <SlaBadge deadline={new Date(now + 2.4 * 3600_000)} />
                <SlaBadge deadline={new Date(now + 3 * 60_000)} />
                <SlaBadge deadline={new Date(now - 70 * 60_000)} />
                <SlaBadge deadline={new Date(now)} respondedAt={new Date(now)} />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-2 text-xs text-fg-subtle">Etapas:</span>
                {STAGES.map((s) => (
                  <Badge key={s.id} tone={s.id === "ganho" ? "success" : s.id === "perdido" ? "danger" : "neutral"}>{s.label}</Badge>
                ))}
              </div>
            </div>
          </Section>

          <Section id="kpis" title="Cartões de KPI" desc="Valor grande em mono, variação vs. período anterior (cor segue o que é bom, não a direção), mini tendência. Cada cartão leva à lista que compõe o número.">
            <div className="grid gap-gap sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label="Leads recebidos" value="47" delta={0.18} trend={[8, 11, 9, 13, 12, 16, 14, 19]} href="#tabela" />
              <KpiCard label="1ª resposta (média)" value="3h 40min" delta={-0.22} goodWhen="down" trend={[7, 6.5, 6, 5.2, 5, 4.4, 4, 3.7]} color="var(--c-series-2)" href="#tabela" />
              <KpiCard label="Dentro do SLA" value="94%" delta={0.03} trend={[88, 90, 89, 91, 93, 92, 95, 94]} color="var(--c-series-3)" href="#tabela" />
              <KpiCard label="Receita fechada" value="R$ 184 mil" delta={-0.08} trend={[120, 160, 140, 210, 190, 230, 200, 184]} color="var(--c-series-4)" href="#kanban" />
            </div>
          </Section>

          <Section id="tabela" title="Linha de tabela · caixa de entrada" desc="Clique ou Enter abre o drawer. Passe o mouse no nome para o cartão-resumo. Lead novo entra com destaque suave. J/K navegam (Fase 1).">
            <Card className="overflow-x-auto">
              <div className="min-w-[960px]">
                <div role="row" className={cn(LEAD_GRID, "h-8 border-b border-border px-4 text-xs text-fg-subtle")}>
                  <span>Protocolo</span><span>Nome</span><span>Serviços</span><span>Dor</span><span>Origem</span><span>Chegou</span><span>SLA</span><span />
                </div>
                {leads
                  ? leads.map((l) => (
                      <LeadRow key={l.id} lead={l} selected={selected === l.id} onOpen={() => { setSelected(l.id); setDrawer(true); }} />
                    ))
                  : Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 border-b border-border px-4" style={{ height: "var(--row-h)" }}>
                        <Skeleton className="h-3 w-10" /><Skeleton className="h-3 w-32" /><Skeleton className="h-3 flex-1" />
                      </div>
                    ))}
              </div>
            </Card>
          </Section>

          <Section id="kanban" title="Card de Kanban" desc="Valor e probabilidade em mono. Negócio parado além do limite da etapa ganha selo âmbar com texto.">
            <div className="grid max-w-3xl gap-gap sm:grid-cols-3">
              <div className="flex flex-col gap-2 rounded-lg bg-surface p-2">
                <div className="flex items-center justify-between px-1 text-xs">
                  <span className="font-medium">Proposta enviada</span>
                  <span className="num text-fg-subtle">2 · R$ 70 mil</span>
                </div>
                <KanbanCard deal={mockDeals[0]} />
                <KanbanCard deal={mockDeals[1]} />
              </div>
              <div className="flex flex-col gap-2 rounded-lg bg-surface p-2">
                <div className="flex items-center justify-between px-1 text-xs">
                  <span className="font-medium">Negociação</span>
                  <span className="num text-fg-subtle">arrastando</span>
                </div>
                <KanbanCard deal={mockDeals[0]} dragging />
              </div>
              <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border-strong p-2">
                <div className="px-1 text-xs font-medium">Ganho</div>
                <EmptyState title="Solte aqui" className="py-6" />
              </div>
            </div>
          </Section>

          <Section id="drawer" title="Drawer e hover preview" desc="O drawer abre lead ou cliente sem sair da lista. Esc fecha e o foco volta para a linha.">
            <Button onClick={() => setDrawer(true)}>Abrir ficha do lead</Button>
          </Section>

          <Section id="toast" title="Toast e Desfazer" desc="Feedback discreto no canto. Destrutivo = executa já + Desfazer por 6s.">
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => toast.success("Resposta enviada por WhatsApp", { description: "Marina Albuquerque · #0142" })}>Sucesso</Button>
              <Button onClick={() => toastUndo("Lead #0139 descartado: fora de escopo", () => toast("Descarte desfeito"))}>
                <Trash2 /> Descartar com Desfazer
              </Button>
              <Button onClick={() => toast.error("WhatsApp indisponível", { description: "Vamos tentar de novo em 1 min.", action: { label: "Tentar agora", onClick: () => {} } })}>
                Erro com nova tentativa
              </Button>
            </div>
          </Section>

          <Section id="graficos" title="Gráficos" desc="Poucos e legíveis. Linha = tendência, barra = comparação, funil = conversão. Grade recessiva, tooltip no hover, clique abre a lista filtrada.">
            <div className="grid gap-gap xl:grid-cols-2">
              <Card>
                <CardHeader title="Leads por semana" action={
                  <div className="flex items-center gap-3 text-xs text-fg-muted">
                    <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-series-1" />Site</span>
                    <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-series-2" />Indicação</span>
                  </div>
                } />
                <div className="p-card pt-2"><LeadsTrend /></div>
              </Card>
              <Card>
                <CardHeader title="Leads por serviço · 90 dias" />
                <div className="p-card pt-2"><LeadsByService /></div>
              </Card>
              <Card className="xl:col-span-2">
                <CardHeader title="Conversão do funil · trimestre" action={<span className="num text-xs text-fg-subtle">taxa de ganho 8%</span>} />
                <div className="p-card"><Funnel /></div>
              </Card>
            </div>
          </Section>

          <Section id="estados" title="Vazio, carregando, erro" desc="Estado vazio orienta e oferece ação. Carregamento com skeleton no formato real. Erro explica e deixa tentar de novo.">
            <div className="grid gap-gap md:grid-cols-3">
              <Card>
                <EmptyState icon={<Inbox />} title="Nenhum lead hoje" description="Quando o formulário do site enviar um pedido, ele aparece aqui na hora." action={<Button size="sm">Ver o funil</Button>} />
              </Card>
              <Card className="flex flex-col gap-3 p-card">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-3 w-3/5" />
              </Card>
              <Card>
                <EmptyState icon={<WifiOff />} title="Não foi possível carregar" description="Sem conexão com o banco. Seus dados estão seguros." action={<Button size="sm"><RefreshCw /> Tentar de novo</Button>} />
              </Card>
            </div>
          </Section>

          <Section id="atalhos" title="Atalhos" desc="Tudo pelo teclado. ? abre esta lista em qualquer tela.">
            <Card className="grid max-w-2xl gap-x-8 gap-y-2 p-card text-sm sm:grid-cols-2">
              {[
                [["⌘", "K"], "Buscar / comandos"],
                [["N"], "Novo lead / negócio"],
                [["J"], "Próximo item"],
                [["K"], "Item anterior"],
                [["E"], "Responder"],
                [["Enter"], "Abrir no drawer"],
                [["Esc"], "Fechar"],
                [["?"], "Lista de atalhos"],
              ].map(([keys, label]) => (
                <div key={label as string} className="flex items-center justify-between gap-3">
                  <span className="text-fg-muted">{label as string}</span>
                  <span className="flex gap-1">{(keys as string[]).map((k) => <Kbd key={k}>{k}</Kbd>)}</span>
                </div>
              ))}
            </Card>
          </Section>
        </main>
      </div>

      <Drawer
        open={drawer}
        onOpenChange={setDrawer}
        title={lead ? lead.nome : "Lead"}
        subtitle={lead ? `${formatProtocolo(lead.protocolo)} · ${lead.empresa} · chegou via ${lead.origem}` : undefined}
        actions={<Button variant="primary" size="sm"><MessageCircle /> Responder</Button>}
      >
        {lead && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-2">
              <SlaBadge deadline={lead.slaDeadline} />
              <Badge tone="accent">Score {lead.score}</Badge>
              {lead.servicos.map((s) => <Badge key={s} tone="outline">{s}</Badge>)}
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-fg-subtle">O que está custando mais tempo ou dinheiro</p>
              <p className="text-sm leading-6">{lead.dor}</p>
            </div>
            <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
              <dt className="text-fg-muted">Hoje resolve</dt><dd>{lead.situacao}</dd>
              <dt className="text-fg-muted">E-mail</dt><dd className="flex items-center gap-1.5"><Mail className="size-3.5 text-fg-subtle" />{lead.email}</dd>
              <dt className="text-fg-muted">WhatsApp</dt><dd className="num">{lead.whatsapp}</dd>
              <dt className="text-fg-muted">Responsável</dt><dd className="flex items-center gap-2"><Avatar name={lead.responsavel!} size={20} />{lead.responsavel}</dd>
            </dl>
            <div>
              <p className="mb-3 text-xs font-medium text-fg-subtle">Linha do tempo</p>
              <ol className="flex flex-col gap-3 border-l border-border pl-4 text-sm">
                <li><span className="text-fg-muted">Agora há pouco · </span>Confirmação com protocolo enviada por e-mail e WhatsApp <Badge tone="neutral">auto</Badge></li>
                <li><span className="text-fg-muted">Agora há pouco · </span>Atribuído a {lead.responsavel} (rodízio) <Badge tone="neutral">auto</Badge></li>
                <li><span className="text-fg-muted">Agora há pouco · </span>Pedido recebido pelo site</li>
              </ol>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
