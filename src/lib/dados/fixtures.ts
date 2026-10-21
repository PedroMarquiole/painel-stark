// Dados fictícios do modo offline (PAINEL_OFFLINE=1, só em `next dev`). Nunca usados em produção.
import type { CanalProspect, Etapa, MotivoPerda, Servico, Situacao, SituacaoProspect } from "@/lib/rotulos";
import type {
  Automacao, ConfigProspeccao, EtapaConfig, Execucao, Indicadores, LeadDetalhe, LeadInbox, ModeloProspeccao, NegocioCard, Notificacao, Perfil,
  ProspeccaoIndicadores, Prospect, ResultadoBusca, ToqueProspect,
} from "./tipos";
import type { Ficha } from "./consultas";

const H = 3_600_000;
const D = 24 * H;
const iso = (ms: number) => new Date(ms).toISOString();

// A equipe de hoje: você e seu sócio
export const perfil: Perfil = { id: "u-pedro", nome: "Pedro Marquiole", email: "pedro@stark.dev.br", papel: "admin", avatar_url: null };
export const equipe: Perfil[] = [
  perfil,
  { id: "u-socio", nome: "Sócio Stark", email: "socio@stark.dev.br", papel: "comercial", avatar_url: null },
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
    etapa: (p[8] && p[6] === "novo" ? "triagem" : p[6]) as Etapa,
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
    etapa: (p[8] && p[6] === "novo" ? "triagem" : p[6]) as Etapa,
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
    previsao_fechamento: i === 10 ? iso(agora + 6 * D).slice(0, 10) : null,
    created_at: iso(chegada),
    lead_id: `lead-${i}`,
    respondido: Boolean(p[8]) || p[6] !== "novo",
    sla_vence_em: !p[8] && p[6] === "novo" ? leads()[i].sla_vence_em : null,
    motivo_perda_detalhe: null,
    contato_email: leads()[i].email,
    contato_whatsapp: leads()[i].whatsapp,
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
      ...(l.primeira_resposta_em ? [{ id: "a3", tipo: "mensagem", canal: "whatsapp", direcao: "saida", automatica: false, titulo: "Primeiro contato", corpo: `Oi, ${l.nome.split(" ")[0]}! Aqui é da Stark. Podemos marcar 30 minutos para entender melhor?`, ocorreu_em: l.primeira_resposta_em, autor_nome: "Sócio Stark" }] : []),
      { id: "a2", tipo: "mensagem", canal: "email", direcao: "saida", automatica: true, titulo: `Recebemos seu pedido #00${l.protocolo} · Stark`, corpo: null, ocorreu_em: iso(t0 + 20_000), autor_nome: null },
      { id: "a1b", tipo: "atribuicao", canal: "sistema", direcao: "interna", automatica: true, titulo: "Atribuído a Sócio Stark", corpo: null, ocorreu_em: iso(t0 + 2_000), autor_nome: null },
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
    [5, "sla_alerta", "Alerta de prazo", "sla.vencendo", 1], [6, "lead_followup", "Follow-up sem resposta", "lead.sem_resposta", 2],
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
      ["Processar lead novo", "sucesso", 4], ["Alerta de prazo", "sucesso", 95], ["Avisar a equipe", "sucesso", 1240],
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

// ─── Prospecção (offline) ────────────────────────────────────────────────────
type PP = [string, string | null, string | null, CanalProspect, SituacaoProspect, number, number | null, string, string | null, string | null];
// empresa, pessoa, cargo, canal, situação, toques, dias até o próximo contato (negativo = atrasado), cidade/segmento, resposta, lista
const PROSPECTS: PP[] = [
  ["Construtora Albuquerque Lima", "Renata Albuquerque", "Diretora de operações", "linkedin", "acompanhamento", 2, -2, "Jundiaí|Construção civil", null, "Indústrias de Jundiaí"],
  ["Laticínios Serra Azul", "Marcos Teixeira", "Sócio", "whatsapp", "acompanhamento", 2, -1, "Itatiba|Alimentos", null, null],
  ["Clínica Odonto Viva", "Paula Rezende", "Proprietária", "email", "respondeu", 1, 0, "Campinas|Saúde", "Me liga quinta à tarde", null],
  ["Transportes Rota Sul", "Diego Fontana", "Gerente de logística", "linkedin", "acompanhamento", 2, 0, "Jundiaí|Logística", null, "Indústrias de Jundiaí"],
  ["Padaria Pão da Vila", null, null, "instagram", "a_abordar", 0, 0, "Sorocaba|Alimentos", null, null],
  ["Escola Pequeno Saber", "Juliana Moraes", "Coordenadora", "whatsapp", "contatado", 1, 0, "Campinas|Educação", null, null],
  ["Ótica Visão Clara", "Fernanda Luz", null, "whatsapp", "a_abordar", 0, 1, "Campinas|Varejo", null, null],
  ["Metalúrgica Forte Aço", "Sérgio Lima", "Diretor industrial", "linkedin", "a_abordar", 0, 1, "Jundiaí|Indústria", null, "Indústrias de Jundiaí"],
  ["Academia Corpo em Forma", null, null, "instagram", "a_abordar", 0, 2, "Sorocaba|Serviços", null, null],
  ["Contabilidade Nunes", "Carla Nunes", "Sócia", "email", "contatado", 1, 3, "Valinhos|Serviços", null, null],
  ["Distribuidora Bom Grão", "Felipe Andrade", "Compras", "linkedin", "respondeu", 1, 2, "Louveira|Distribuição", "Manda um material", "Indústrias de Jundiaí"],
  ["Imobiliária Casa Nova", "Rodrigo Pires", "Sócio", "whatsapp", "interessado", 2, null, "Campinas|Imobiliário", null, null],
  ["Gráfica Ponto Certo", null, null, "telefone", "sem_interesse", 3, null, "Várzea Paulista|Indústria", null, "Indústrias de Jundiaí"],
  ["Pet Shop Amigo Fiel", "Bruno Sales", "Dono", "instagram", "nao_abordar", 1, null, "Jundiaí|Varejo", null, null],
];

export function prospects(): Prospect[] {
  const hoje = Date.now();
  const dia = (n: number) => new Date(hoje - 3 * H + n * D).toISOString().slice(0, 10);
  return PROSPECTS.map(([empresa, pessoa, cargo, canal, situacao, toques, prox, cs, resp, lista], i) => {
    const [cidade, segmento] = cs.split("|");
    const slug = empresa.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]+/g, "");
    return {
      id: `prosp-${i}`, empresa, pessoa, cargo,
      email: canal === "email" ? `${(pessoa ?? "contato").split(" ")[0].toLowerCase()}@${slug}.exemplo` : null,
      whatsapp: canal === "whatsapp" || canal === "telefone" ? `+55119${String(81000000 + i * 4231).padStart(8, "0")}` : null,
      linkedin: canal === "linkedin" ? `linkedin.com/in/${(pessoa ?? slug).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-")}` : null,
      instagram: canal === "instagram" ? `@${slug.slice(0, 16)}` : null,
      site: `${slug}.exemplo`, cidade, segmento,
      porque: i === 0 ? "Abriu 3 obras novas este ano; controla medições em planilha (post no LinkedIn)." : null,
      canal, origem: lista ? "Pesquisa no LinkedIn e sites das empresas" : "Cadastro manual", lista_id: lista ? "lista-1" : null, lista_nome: lista,
      responsavel_id: equipe[i % 2].id, situacao, toques, proximo_contato: prox == null ? null : dia(prox),
      ultimo_contato_em: toques ? iso(hoje - (3 + i % 4) * D) : null,
      encerrado_em: ["interessado", "sem_interesse", "nao_abordar"].includes(situacao) ? iso(hoje - 2 * D) : null,
      motivo_encerramento: situacao === "sem_interesse" ? "Sem resposta depois de 3 contatos" : situacao === "nao_abordar" ? "Pediu para não ser contatado" : null,
      negocio_id: situacao === "interessado" ? "neg-3" : null,
      created_at: iso(hoje - (20 - i) * D), ultima_resposta: resp,
    };
  });
}

export function toquesProspect(id: string): ToqueProspect[] {
  const p = prospects().find((x) => x.id === id);
  if (!p) return [];
  const t0 = Date.parse(p.created_at);
  const xs: ToqueProspect[] = [{ id: `${id}-t0`, canal: null, resultado: "importado", anotacao: p.lista_nome ? `Entrou pela lista “${p.lista_nome}”` : "Cadastrado no painel", autor_nome: perfil.nome, ocorreu_em: iso(t0) }];
  for (let k = 0; k < p.toques; k++) xs.push({ id: `${id}-t${k + 1}`, canal: p.canal, resultado: "enviada", anotacao: k === 0 ? "1º contato" : null, autor_nome: equipe[k % 2].nome, ocorreu_em: iso(t0 + (k + 1) * 4 * D) });
  if (p.ultima_resposta) xs.push({ id: `${id}-r`, canal: p.canal, resultado: "respondeu", anotacao: p.ultima_resposta, autor_nome: perfil.nome, ocorreu_em: iso(Date.now() - D) });
  return xs.reverse();
}

export const modelosProspeccao: ModeloProspeccao[] = (["linkedin", "whatsapp", "email", "instagram", "telefone"] as CanalProspect[]).flatMap((canal) =>
  ([1, 2, 3] as const).map((toque) => ({
    canal, toque,
    texto: toque === 1 ? "Oi, {{pessoa}}! Sou {{seu_nome}}, da Stark. A gente cria sistemas sob medida para empresas como a {{empresa}} tirarem processos da planilha.\nFaz sentido uma conversa de 20 minutos?"
      : toque === 2 ? "Oi, {{pessoa}}, tudo bem? Retomando minha mensagem sobre sistemas sob medida para a {{empresa}}. Tem 20 minutos esta semana?"
      : "Oi, {{pessoa}}! Passando uma última vez por aqui. Se fizer sentido para a {{empresa}} no futuro, é só chamar.",
  })));

export const configProspeccao: ConfigProspeccao = { ritmo: [3, 4], meta_semana: 20 };

export function indicadoresProspeccao(): ProspeccaoIndicadores {
  const xs = prospects();
  const hoje = new Date(Date.now() - 3 * H).toISOString().slice(0, 10);
  const ativos = xs.filter((p) => ["a_abordar", "contatado", "acompanhamento", "respondeu"].includes(p.situacao));
  return {
    hoje: ativos.filter((p) => p.proximo_contato && p.proximo_contato <= hoje).length,
    atrasados: ativos.filter((p) => p.proximo_contato && p.proximo_contato < hoje).length,
    a_abordar: xs.filter((p) => p.situacao === "a_abordar").length,
    contatos_semana: 11, meta_semana: 20, resposta_pct: 18,
    por_canal: [{ canal: "whatsapp", n: 13, pct: 31 }, { canal: "linkedin", n: 18, pct: 22 }, { canal: "instagram", n: 7, pct: 14 }, { canal: "email", n: 11, pct: 9 }],
    viraram_negocio: 1, valor_no_funil: 48000,
  };
}
