import type { CanalProspect, Etapa, MotivoPerda, Papel, Servico, Situacao, SituacaoProspect } from "@/lib/rotulos";

export interface Perfil {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  avatar_url: string | null;
}

export interface LeadInbox {
  id: string;
  protocolo: number;
  created_at: string;
  status: "novo" | "em_atendimento" | "convertido" | "descartado";
  servicos: Servico[];
  situacao_atual: Situacao | null;
  dor: string;
  origem: string | null;
  sla_vence_em: string;
  primeira_resposta_em: string | null;
  responsavel_id: string | null;
  contato_id: string;
  negocio_id: string | null;
  nome: string;
  email: string | null;
  whatsapp: string | null;
  empresa: string | null;
  score: number | null;
  etapa: Etapa | null; // etapa do negócio no funil
}

export interface Atividade {
  id: string;
  tipo: string;
  canal: string;
  direcao: string;
  automatica: boolean;
  titulo: string;
  corpo: string | null;
  ocorreu_em: string;
  autor_nome: string | null;
}

export interface LeadDetalhe extends LeadInbox {
  motivo_descarte: string | null;
  prazo: string | null;
  investimento: string | null;
  porte: string | null;
  respostas_extras: Record<string, string>;
  simulador: Record<string, string | number> | null;
  utm: { source: string | null; medium: string | null; campaign: string | null };
  consentimento_lgpd_em: string | null;
  contato: { id: string; nome: string; email: string | null; whatsapp: string | null; cargo: string | null; opt_out_email: boolean };
  negocio: { id: string; titulo: string; etapa: Etapa; valor_estimado: number | null } | null;
  outros_pedidos: { id: string; protocolo: number; created_at: string; dor: string }[];
  atividades: Atividade[];
}

export interface NegocioCard {
  id: string;
  titulo: string;
  etapa: Etapa;
  etapa_desde: string;
  ordem: number;
  valor_estimado: number | null;
  probabilidade: number;
  servicos: Servico[];
  responsavel_id: string | null;
  contato_id: string;
  contato_nome: string;
  empresa: string | null;
  protocolo: number | null;
  ganho_em: string | null;
  perdido_em: string | null;
  motivo_perda: MotivoPerda | null;
  previsao_fechamento: string | null;
  created_at: string;
  lead_id: string | null;   // pedido de origem (o mais antigo)
  respondido: boolean;      // alguém já respondeu o cliente
  sla_vence_em: string | null; // prazo do pedido ainda sem resposta
  motivo_perda_detalhe: string | null;
  contato_email: string | null;
  contato_whatsapp: string | null;
}

export interface EtapaConfig {
  etapa: Etapa;
  rotulo: string;
  ordem: number;
  probabilidade_padrao: number;
  dias_alerta_parado: number | null;
}

type Par = { atual: number | null; anterior: number | null };
export interface Indicadores {
  dias: number;
  leads: Par;
  primeira_resposta_horas: Par;
  sla_pct: Par;
  ganhos: Par;
  receita: Par;
  ticket_medio: Par;
  taxa_ganho_pct: Par;
  ciclo_dias: Par;
  pipeline_ponderado: number;
  pipeline_aberto: number;
  mrr: number;
  sla_agora: { abertos: number; vencendo: number; estourados: number };
  por_servico: { servico: Servico; n: number }[];
  por_origem: { origem: string; n: number }[];
  por_situacao: { situacao: string; n: number }[];
  motivos_perda: { motivo: MotivoPerda; n: number }[];
  funil: { etapa: Etapa; rotulo: string; n: number }[];
  serie: { semana: string; leads: number; resposta_horas: number | null; sla_pct: number | null; receita: number }[];
}

export interface Automacao {
  id: string;
  numero: number | null;
  chave: string;
  nome: string;
  descricao: string | null;
  gatilho: string;
  ativa: boolean;
  fase: number;
  envia_ao_cliente: boolean;
}

export interface Execucao {
  id: string;
  automacao: string;
  status: string;
  entidade_tipo: string;
  entidade_id: string | null;
  created_at: string;
  resultado: unknown;
  erro: string | null;
}

export interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  corpo: string | null;
  link: string | null;
  lida_em: string | null;
  created_at: string;
}

export interface ResultadoBusca {
  tipo: "lead" | "contato" | "negocio" | "prospect";
  id: string;
  titulo: string;
  subtitulo: string;
  href: string;
}

export interface Resultado<T = undefined> {
  ok: boolean;
  erro?: string;
  dados?: T;
}

// ─── Prospecção ─────────────────────────────────────────────────────────────
export interface Prospect {
  id: string;
  empresa: string;
  pessoa: string | null;
  cargo: string | null;
  email: string | null;
  whatsapp: string | null;
  linkedin: string | null;
  instagram: string | null;
  site: string | null;
  cidade: string | null;
  segmento: string | null;
  porque: string | null;
  canal: CanalProspect;
  origem: string;
  lista_id: string | null;
  lista_nome: string | null;
  responsavel_id: string | null;
  situacao: SituacaoProspect;
  toques: number;
  proximo_contato: string | null; // AAAA-MM-DD
  ultimo_contato_em: string | null;
  encerrado_em: string | null;
  motivo_encerramento: string | null;
  negocio_id: string | null;
  created_at: string;
  ultima_resposta: string | null; // anotação do último "respondeu"
}

export interface ToqueProspect {
  id: string;
  canal: CanalProspect | null;
  resultado: "enviada" | "respondeu" | "depois" | "sem_interesse" | "interessado" | "nao_abordar" | "reaberto" | "nota" | "importado";
  anotacao: string | null;
  autor_nome: string | null;
  ocorreu_em: string;
}

export interface ProspeccaoIndicadores {
  hoje: number;
  atrasados: number;
  a_abordar: number;
  contatos_semana: number;
  meta_semana: number | null;
  resposta_pct: number | null;
  por_canal: { canal: CanalProspect; n: number; pct: number | null }[];
  viraram_negocio: number;
  valor_no_funil: number;
}

export interface ModeloProspeccao { canal: CanalProspect; toque: 1 | 2 | 3; texto: string; assunto?: string | null }
export interface ConfigProspeccao { ritmo: number[]; meta_semana: number | null }
