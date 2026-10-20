// Dados fictícios do modo offline (PAINEL_OFFLINE=1, só em `next dev`). Nunca usados em produção.
import type { Etapa, MotivoPerda, Servico, Situacao } from "@/lib/rotulos";
import type { Automacao, EtapaConfig, Execucao, Indicadores, LeadDetalhe, LeadInbox, NegocioCard, Notificacao, Perfil, ResultadoBusca } from "./tipos";
import type { Ficha } from "./consultas";

const H = 3_600_000;
const D = 24 * H;
const iso = (ms: number) => new Date(ms).toISOString();

export const perfil: Perfil = { id: "u-ana", nome: "Ana Beatriz", email: "ana@stark.dev.br", papel: "admin", avatar_url: null };
export const equipe: Perfil[] = [
  perfil,
  { id: "u-rafa", nome: "Rafael Costa", email: "rafa@stark.dev.br", papel: "comercial", avatar_url: null },
  { id: "u-dev", nome: "Lucas Prado", email: "lucas@stark.dev.br", papel: "projetos", avatar_url: null },
];

type P = [string, string, Servico[], Situacao, string, string, Etapa, number, number | null, number | null, MotivoPerda | null];
const PESSOAS: P[] = [
  ["Marina Albuquerque", "Clínica Vitta", ["sistemas_web", "automacao_ia"], "sistema_nao_atende", "Agendamento é feito em 3 lugares diferentes e a recepção perde 2h por dia conferindo horários.", "google", "novo", 0.003, null, null, null],
  ["João Pedro Lima", "Transportes Lima", ["dashboards"], "planilhas", "Fechamento do mês leva uma semana porque os dados de frete vêm de 4 planilhas diferentes.", "instagram", "novo", 0.86, null, null, null],
  ["Carla Mendes", "Ateliê Mendes", ["loja_virtual", "site_landing"], "manual_whatsapp", "Vendo pelo WhatsApp e perco pedido quando o volume aumenta no fim do ano.", "site", "novo", 1.05, null, null, null],
  ["Eduardo Furtado", "Furtado Engenharia", ["aplicativo"], "nao_existe", "Equipe de campo preenche relatório em papel e a gente digita tudo de novo no escritório.", "indicacao", "triagem", 1.5, 2, null, null],
  ["Patrícia Rocha", "Rocha Contabilidade", ["automacao_ia", "integracoes_apis"], "planilhas", "Recebemos 300 notas por mês por e-mail e alguém baixa e lança uma por uma no sistema.", "linkedin", "triagem", 3, 5, null, null],
  ["Ricardo Tavares", "Academia Pulso", ["aplicativo", "sistemas_web"], "sistema_nao_atende", "O sistema atual não deixa o aluno remarcar aula pelo celular e a recepção vive no telefone.", "google", "diagnostico", 6, 1, 35000, null],
  ["Fernanda Lopes", "Imobiliária Lopes", ["sistemas_web", "integracoes_apis"], "manual_whatsapp", "Os corretores controlam visitas no WhatsApp e ninguém sabe qual imóvel está reservado.", "campanha", "diagnostico", 9, 3, 22000, null],
  ["Bruno Carvalho", "Distribuidora BC", ["integracoes_apis", "dashboards"], "sistema_nao_atende", "O ERP não conversa com a loja virtual e o estoque fica errado todo dia.", "google", "descoberta", 12, 2, 48000, null],
  ["Juliana Prado", "Escola Viver", ["site_landing"], "nao_existe", "Precisamos de um site para matrículas de 2027; hoje só temos Instagram.", "instagram", "proposta", 18, 1, 42000, null],
  ["Marcelo Antunes", "Antunes Advocacia", ["automacao_ia"], "planilhas", "Controlamos prazos processuais em planilha e já perdemos um prazo este ano.", "indicacao", "proposta", 26, 2, 75000, null],
  ["Aline Souza", "Doce Souza", ["loja_virtual"], "manual_whatsapp", "Encomendas de bolo chegam por WhatsApp, Instagram e telefone e às vezes a gente esquece uma.", "site", "negociacao", 28, 3, 52000, null],
  ["Thiago Martins", "Martins Logística", ["dashboards", "sistemas_web"], "planilhas", "O cliente pede posição da carga e a gente precisa ligar para o motorista para saber.", "linkedin", "ganho", 36, 2, 45000, null],
  ["Camila Reis", "Studio Reis", ["site_landing", "automacao_ia"], "manual_whatsapp", "Respondo as mesmas perguntas de preço no Direct dezenas de vezes por dia.", "instagram", "ganho", 47, 1, 64000, null],
  ["Gustavo Nunes", "Nunes Auto Peças", ["evoluir_existente"], "sistema_nao_atende", "Temos um sistema feito há 6 anos que ninguém consegue mais manter e trava toda semana.", "indicacao", "perdido", 20, 3, 25000, "preco"],
  ["Renata Barros", "Clínica Sorriso Barros", ["sistemas_web"], "planilhas", "Orçamentos de tratamento são feitos no Excel e o paciente demora para receber.", "google", "perdido", 44, 2, 40000, "concorrente"],
];

const base = () => {
  const agora = Date.now();
  return PESSOAS.map((p, i) => {
    const chegada = agora - p[7] * D;
    const sla = chegada + (i === 1 ? 0.9 * D + 0.5 * H : i === 2 ? 0.95 * D : D);
    return { p, i, chegada, sla: i === 2 ? agora - 1.3 * H : i === 1 ? agora + 2.4 * H : sla };
  });
};

export function leads(): LeadInbox[] {
  return base().map(({ p, i, chegada, sla }) => ({
    id: `lead-${i}`,
    protocolo: 42 - i,
    created_at: iso(chegada),
    status: p[6] === "ganho" ? "convertido" : p[9] ? "em_atendimento" : p[8] ? "em_atendimento" : "novo",
    servicos: p[2],
    situacao_atual: p[3],
    dor: p[4],
    origem: p[5],
    sla_vence_em: iso(sla),
    primeira_resposta_em: p[8] ? iso(chegada + p[8] * H) : null,
    responsavel_id: i === 2 ? null : equipe[i % 2].id,
    contato_id: `contato-${i}`,
    negocio_id: `neg-${i}`,
    nome: p[0],
    email: `${p[0].split(" ")[0].toLowerCase()}@${p[1].toLowerCase().replace(/[^a-z]/g, "")}.exemplo`,
    whatsapp: `+55119${String(70000000 + i * 1379).padStart(8, "0")}`,
    empresa: p[1],
    score: null,
  }));
}

export const etapas: EtapaConfig[] = [
  ["novo", "Novo", 5, 1], ["triagem", "Em triagem", 10, 2], ["diagnostico", "Diagnóstico agendado", 20, 7],
  ["descoberta", "Descoberta feita", 35, 5], ["proposta", "Proposta enviada", 50, 7], ["negociacao", "Negociação", 70, 10],
  ["ganho", "Ganho", 100, null], ["perdido", "Perdido", 0, null],
].map(([etapa, rotulo, prob, alerta], i) => ({
  etapa: etapa as Etapa, rotulo: rotulo as string, ordem: i + 1, probabilidade_padrao: prob as number, dias_alerta_parado: alerta as number | null,
}));

export function negocios(): NegocioCard[] {
  const agora = Date.now();
  return base().map(({ p, i, chegada }) => ({
    id: `neg-${i}`,
    titulo: `${{ sistemas_web: "Sistemas web", aplicativo: "Aplicativo", automacao_ia: "Automação e IA", integracoes_apis: "Integrações e APIs", dashboards: "Dashboards", site_landing: "Site ou landing page", loja_virtual: "Loja virtual", evoluir_existente: "Evoluir o que já existe" }[p[2][0]]} · ${p[1]}`,
    etapa: p[6],
    etapa_desde: iso(i === 9 ? agora - 12 * D : chegada + Math.max(0.5, p[7] / 3) * D),
    ordem: i,
    valor_estimado: p[9],
    probabilidade: etapas.find((e) => e.etapa === p[6])!.probabilidade_padrao,
    servicos: p[2],
    responsavel_id: equipe[i % 2].id,
    contato_id: `contato-${i}`,
    contato_nome: p[0],
    empresa: p[1],
    protocolo: 42 - i,
    ganho_em: p[6] === "ganho" ? iso(chegada + 25 * D) : null,
    perdido_em: p[6] === "perdido" ? iso(chegada + 10 * D) : null,
    motivo_perda: p[10],
    created_at: iso(chegada),
  }));
}

export function detalhe(id: string): LeadDetalhe | null {
  const l = leads().find((x) => x.id === id);
  if (!l) return null;
  const i = Number(id.split("-")[1]);
  const n = negocios()[i];
  const t0 = new Date(l.created_at).getTime();
  return {
    ...l,
    motivo_descarte: null,
    prazo: "1 a 3 meses",
    investimento: "R$ 20 a 50 mil",
    porte: null,
    respostas_extras: i === 0 ? { decisor: "Sócia-diretora", qtd_usuarios: "6 pessoas na recepção" } : {},
    simulador: i === 0 ? { pessoas: 4, horas_semana: 10 } : null,
    utm: { source: l.origem, medium: l.origem === "google" ? "cpc" : null, campaign: l.origem === "google" ? "sistemas-sob-medida" : null },
    consentimento_lgpd_em: l.created_at,
    contato: { id: l.contato_id, nome: l.nome, email: l.email, whatsapp: l.whatsapp, cargo: null, opt_out_email: false },
    negocio: { id: n.id, titulo: n.titulo, etapa: n.etapa, valor_estimado: n.valor_estimado },
    outros_pedidos: i === 0 ? [{ id: "lead-x", protocolo: 17, created_at: iso(t0 - 80 * D), dor: "Site institucional simples para a clínica." }] : [],
    atividades: [
      ...(l.primeira_resposta_em ? [{ id: "a3", tipo: "mensagem", canal: "whatsapp", direcao: "saida", automatica: false, titulo: "Primeiro contato", corpo: `Oi, ${l.nome.split(" ")[0]}! Aqui é da Stark. Podemos marcar 30 minutos para entender melhor?`, ocorreu_em: l.primeira_resposta_em, autor_nome: "Rafael Costa" }] : []),
      { id: "a2", tipo: "mensagem", canal: "email", direcao: "saida", automatica: true, titulo: `Recebemos seu pedido #00${l.protocolo} · Stark`, corpo: null, ocorreu_em: iso(t0 + 20_000), autor_nome: null },
      { id: "a1b", tipo: "atribuicao", canal: "sistema", direcao: "interna", automatica: true, titulo: "Atribuído a Rafael Costa", corpo: null, ocorreu_em: iso(t0 + 2_000), autor_nome: null },
      { id: "a1", tipo: "lead_recebido", canal: "sistema", direcao: "entrada", automatica: true, titulo: `Pedido #00${l.protocolo} recebido pelo site`, corpo: l.dor, ocorreu_em: l.created_at, autor_nome: null },
    ],
  };
}

export function indicadores(dias: number): Indicadores {
  return {
    dias,
    leads: { atual: 20, anterior: 14 },
    primeira_resposta_horas: { atual: 4.9, anterior: 8.8 },
    sla_pct: { atual: 92, anterior: 85 },
    ganhos: { atual: 6, anterior: 4 },
    receita: { atual: 280000, anterior: 196000 },
    ticket_medio: { atual: 46667, anterior: 49000 },
    taxa_ganho_pct: { atual: 55, anterior: 44 },
    ciclo_dias: { atual: 31.5, anterior: 38 },
    pipeline_ponderado: 196000,
    pipeline_aberto: 412000,
    mrr: 0,
    sla_agora: { abertos: 7, vencendo: 2, estourados: 1 },
    por_servico: [
      { servico: "sistemas_web", n: 9 }, { servico: "automacao_ia", n: 7 }, { servico: "integracoes_apis", n: 6 },
      { servico: "dashboards", n: 5 }, { servico: "aplicativo", n: 5 }, { servico: "site_landing", n: 4 }, { servico: "loja_virtual", n: 3 },
    ],
    por_origem: [{ origem: "google", n: 7 }, { origem: "instagram", n: 5 }, { origem: "indicacao", n: 4 }, { origem: "site", n: 2 }, { origem: "linkedin", n: 2 }],
    por_situacao: [{ situacao: "planilhas", n: 7 }, { situacao: "manual_whatsapp", n: 6 }, { situacao: "sistema_nao_atende", n: 5 }, { situacao: "nao_existe", n: 2 }],
    motivos_perda: [{ motivo: "preco", n: 2 }, { motivo: "concorrente", n: 1 }, { motivo: "sem_resposta", n: 1 }],
    funil: [
      { etapa: "novo", rotulo: "Novo", n: 31 }, { etapa: "triagem", rotulo: "Em triagem", n: 26 }, { etapa: "diagnostico", rotulo: "Diagnóstico agendado", n: 21 },
      { etapa: "descoberta", rotulo: "Descoberta feita", n: 16 }, { etapa: "proposta", rotulo: "Proposta enviada", n: 13 },
      { etapa: "negociacao", rotulo: "Negociação", n: 9 }, { etapa: "ganho", rotulo: "Ganho", n: 6 },
    ],
    serie: ["01/09", "08/09", "15/09", "22/09", "29/09", "06/10", "13/10", "20/10"].map((semana, i) => ({
      semana,
      leads: [2, 3, 3, 4, 3, 5, 6, 4][i],
      resposta_horas: [9.5, 8.1, 7.7, 6.4, 5.2, 4.8, 4.1, 3.9][i],
      sla_pct: [78, 82, 85, 88, 90, 92, 95, 94][i],
      receita: [0, 38000, 0, 15000, 64000, 0, 28000, 45000][i],
    })),
  };
}

export function automacoes(): { regras: Automacao[]; execucoes: Execucao[] } {
  const nomes: [number, string, string, string, number][] = [
    [1, "lead_processar", "Processar lead novo", "lead.criado", 1], [2, "lead_confirmacao_cliente", "Confirmação ao cliente", "lead.criado", 1],
    [3, "lead_avisar_equipe", "Avisar a equipe", "lead.criado", 1], [4, "lead_atribuir", "Atribuir responsável", "lead.criado", 1],
    [5, "sla_alerta", "Alerta de SLA", "sla.vencendo", 1], [6, "lead_followup", "Follow-up sem resposta", "lead.sem_resposta", 2],
    [7, "negocio_parado", "Negócio parado", "negocio.parado", 2], [8, "reuniao_lembretes", "Lembretes de reunião", "reuniao.agendada", 2],
    [9, "proposta_visualizada", "Proposta visualizada", "proposta.visualizada", 3], [10, "proposta_followup", "Follow-up de proposta", "proposta.sem_resposta", 3],
    [11, "proposta_aceita", "Proposta aceita", "proposta.aceita", 3], [12, "fatura_lembrete", "Lembrete de cobrança", "fatura.vencimento", 4],
    [13, "projeto_entregue", "Projeto entregue", "projeto.entregue", 4], [14, "relatorio_semanal", "Relatório semanal", "cron:seg_07h", 2],
    [15, "resumo_diario", "Resumo do dia", "cron:diario_07h", 2],
  ];
  const agora = Date.now();
  return {
    regras: nomes.map(([numero, chave, nome, gatilho, fase]) => ({
      id: chave, numero, chave, nome, gatilho, fase, descricao: null, ativa: numero <= 5, envia_ao_cliente: [2, 6, 8, 10, 11, 12, 13].includes(numero),
    })),
    execucoes: [
      ["Avisar a equipe", "sucesso", 4], ["Confirmação ao cliente", "sucesso", 4], ["Atribuir responsável", "sucesso", 4],
      ["Processar lead novo", "sucesso", 4], ["Alerta de SLA", "sucesso", 95], ["Avisar a equipe", "sucesso", 1240],
    ].map(([automacao, status, min], i) => ({
      id: `e${i}`, automacao: automacao as string, status: status as string, entidade_tipo: "lead", entidade_id: "lead-0",
      created_at: iso(agora - (min as number) * 60_000), resultado: {}, erro: null,
    })),
  };
}

export const notificacoes: Notificacao[] = [
  { id: "n1", tipo: "lead_novo", titulo: "Novo pedido #0042 · Marina Albuquerque", corpo: "Agendamento é feito em 3 lugares diferentes…", link: "/leads?id=lead-0", lida_em: null, created_at: iso(Date.now() - 4 * 60_000) },
  { id: "n2", tipo: "sla_vencendo", titulo: "SLA vencendo · #0041 João Pedro Lima", corpo: "Menos de 4h para responder.", link: "/leads?id=lead-1", lida_em: null, created_at: iso(Date.now() - 40 * 60_000) },
];

export function ficha(id: string): Ficha | null {
  const i = Number(id.split("-")[1]);
  const l = leads()[i];
  if (!l) return null;
  const n = negocios()[i];
  return {
    contato: { id, nome: l.nome, email: l.email, whatsapp: l.whatsapp, cargo: null, opt_out_email: false, opt_out_whatsapp: false, created_at: l.created_at, responsavel_id: l.responsavel_id, empresa: l.empresa },
    pedidos: [l],
    negocios: [n],
    atividades: detalhe(l.id)!.atividades,
    ltv: n.etapa === "ganho" ? n.valor_estimado ?? 0 : 0,
  };
}

export function buscar(q: string): ResultadoBusca[] {
  const t = q.toLowerCase();
  return leads()
    .filter((l) => l.nome.toLowerCase().includes(t) || (l.empresa ?? "").toLowerCase().includes(t) || `#00${l.protocolo}`.includes(t))
    .slice(0, 6)
    .map((l) => ({ tipo: "contato" as const, id: l.contato_id, titulo: l.nome, subtitulo: `${l.empresa} · #00${l.protocolo}`, href: `/clientes/${l.contato_id}` }));
}
