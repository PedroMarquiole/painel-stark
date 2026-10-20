export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      apontamentos_horas: {
        Row: {
          created_at: string
          data: string
          descricao: string | null
          fase: Database["public"]["Enums"]["fase_projeto"] | null
          faturavel: boolean
          horas: number
          id: string
          profile_id: string
          projeto_id: string
          tarefa_id: string | null
        }
        Insert: {
          created_at?: string
          data?: string
          descricao?: string | null
          fase?: Database["public"]["Enums"]["fase_projeto"] | null
          faturavel?: boolean
          horas: number
          id?: string
          profile_id?: string
          projeto_id: string
          tarefa_id?: string | null
        }
        Update: {
          created_at?: string
          data?: string
          descricao?: string | null
          fase?: Database["public"]["Enums"]["fase_projeto"] | null
          faturavel?: boolean
          horas?: number
          id?: string
          profile_id?: string
          projeto_id?: string
          tarefa_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apontamentos_horas_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apontamentos_horas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apontamentos_horas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "v_projeto_orcado_realizado"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "apontamentos_horas_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      app_config: {
        Row: {
          chave: string
          descricao: string | null
          updated_at: string
          valor: Json
        }
        Insert: {
          chave: string
          descricao?: string | null
          updated_at?: string
          valor: Json
        }
        Update: {
          chave?: string
          descricao?: string | null
          updated_at?: string
          valor?: Json
        }
        Relationships: []
      }
      atividades: {
        Row: {
          automatica: boolean
          autor_id: string | null
          canal: Database["public"]["Enums"]["canal"]
          contato_id: string | null
          corpo: string | null
          created_at: string
          direcao: Database["public"]["Enums"]["direcao"]
          id: string
          lead_id: string | null
          meta: Json
          negocio_id: string | null
          ocorreu_em: string
          projeto_id: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          automatica?: boolean
          autor_id?: string | null
          canal?: Database["public"]["Enums"]["canal"]
          contato_id?: string | null
          corpo?: string | null
          created_at?: string
          direcao?: Database["public"]["Enums"]["direcao"]
          id?: string
          lead_id?: string | null
          meta?: Json
          negocio_id?: string | null
          ocorreu_em?: string
          projeto_id?: string | null
          tipo: string
          titulo: string
        }
        Update: {
          automatica?: boolean
          autor_id?: string | null
          canal?: Database["public"]["Enums"]["canal"]
          contato_id?: string | null
          corpo?: string | null
          created_at?: string
          direcao?: Database["public"]["Enums"]["direcao"]
          id?: string
          lead_id?: string | null
          meta?: Json
          negocio_id?: string | null
          ocorreu_em?: string
          projeto_id?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "atividades_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_projeto_fk"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_projeto_fk"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "v_projeto_orcado_realizado"
            referencedColumns: ["projeto_id"]
          },
        ]
      }
      auditoria: {
        Row: {
          acao: string
          alterado: Json | null
          antes: Json | null
          ator_id: string | null
          depois: Json | null
          em: string
          id: number
          registro_id: string | null
          tabela: string
        }
        Insert: {
          acao: string
          alterado?: Json | null
          antes?: Json | null
          ator_id?: string | null
          depois?: Json | null
          em?: string
          id?: never
          registro_id?: string | null
          tabela: string
        }
        Update: {
          acao?: string
          alterado?: Json | null
          antes?: Json | null
          ator_id?: string | null
          depois?: Json | null
          em?: string
          id?: never
          registro_id?: string | null
          tabela?: string
        }
        Relationships: []
      }
      automacoes: {
        Row: {
          acoes: Json
          ativa: boolean
          chave: string
          condicoes: Json
          descricao: string | null
          envia_ao_cliente: boolean
          fase: number
          gatilho: string
          id: string
          nome: string
          numero: number | null
          respeita_horario_comercial: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          acoes?: Json
          ativa?: boolean
          chave: string
          condicoes?: Json
          descricao?: string | null
          envia_ao_cliente?: boolean
          fase?: number
          gatilho: string
          id?: string
          nome: string
          numero?: number | null
          respeita_horario_comercial?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          acoes?: Json
          ativa?: boolean
          chave?: string
          condicoes?: Json
          descricao?: string | null
          envia_ao_cliente?: boolean
          fase?: number
          gatilho?: string
          id?: string
          nome?: string
          numero?: number | null
          respeita_horario_comercial?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automacoes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      automacoes_execucoes: {
        Row: {
          automacao_id: string
          chave_idempotencia: string
          created_at: string
          entidade_id: string | null
          entidade_tipo: string
          erro: string | null
          evento: Json
          finalizada_em: string | null
          id: string
          proxima_tentativa_em: string
          resultado: Json | null
          status: string
          tentativas: number
        }
        Insert: {
          automacao_id: string
          chave_idempotencia: string
          created_at?: string
          entidade_id?: string | null
          entidade_tipo: string
          erro?: string | null
          evento?: Json
          finalizada_em?: string | null
          id?: string
          proxima_tentativa_em?: string
          resultado?: Json | null
          status?: string
          tentativas?: number
        }
        Update: {
          automacao_id?: string
          chave_idempotencia?: string
          created_at?: string
          entidade_id?: string | null
          entidade_tipo?: string
          erro?: string | null
          evento?: Json
          finalizada_em?: string | null
          id?: string
          proxima_tentativa_em?: string
          resultado?: Json | null
          status?: string
          tentativas?: number
        }
        Relationships: [
          {
            foreignKeyName: "automacoes_execucoes_automacao_id_fkey"
            columns: ["automacao_id"]
            isOneToOne: false
            referencedRelation: "automacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      contatos: {
        Row: {
          cargo: string | null
          created_at: string
          email: string | null
          empresa_id: string | null
          id: string
          nome: string
          opt_out_email: boolean
          opt_out_whatsapp: boolean
          responsavel_id: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          cargo?: string | null
          created_at?: string
          email?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
          opt_out_email?: boolean
          opt_out_whatsapp?: boolean
          responsavel_id?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          cargo?: string | null
          created_at?: string
          email?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          opt_out_email?: boolean
          opt_out_whatsapp?: boolean
          responsavel_id?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contatos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contatos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos: {
        Row: {
          contato_id: string
          created_at: string
          descricao: string
          dia_vencimento: number | null
          empresa_id: string | null
          fim: string | null
          id: string
          inicio: string
          projeto_id: string | null
          proposta_id: string | null
          status: string
          tipo: string
          updated_at: string
          valor_mensal: number | null
          valor_total: number | null
        }
        Insert: {
          contato_id: string
          created_at?: string
          descricao: string
          dia_vencimento?: number | null
          empresa_id?: string | null
          fim?: string | null
          id?: string
          inicio: string
          projeto_id?: string | null
          proposta_id?: string | null
          status?: string
          tipo: string
          updated_at?: string
          valor_mensal?: number | null
          valor_total?: number | null
        }
        Update: {
          contato_id?: string
          created_at?: string
          descricao?: string
          dia_vencimento?: number | null
          empresa_id?: string | null
          fim?: string | null
          id?: string
          inicio?: string
          projeto_id?: string | null
          proposta_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          valor_mensal?: number | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "v_projeto_orcado_realizado"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "contratos_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_registros: {
        Row: {
          id: string
          tabela: string
        }
        Insert: {
          id: string
          tabela: string
        }
        Update: {
          id?: string
          tabela?: string
        }
        Relationships: []
      }
      empresas: {
        Row: {
          cnpj: string | null
          created_at: string
          id: string
          nome: string
          porte: string | null
          setor: string | null
          site: string | null
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          id?: string
          nome: string
          porte?: string | null
          setor?: string | null
          site?: string | null
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          id?: string
          nome?: string
          porte?: string | null
          setor?: string | null
          site?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      entregas: {
        Row: {
          entregue_em: string | null
          fase: Database["public"]["Enums"]["fase_projeto"]
          id: string
          marco: boolean
          ordem: number
          projeto_id: string
          titulo: string
          vence_em: string | null
        }
        Insert: {
          entregue_em?: string | null
          fase: Database["public"]["Enums"]["fase_projeto"]
          id?: string
          marco?: boolean
          ordem?: number
          projeto_id: string
          titulo: string
          vence_em?: string | null
        }
        Update: {
          entregue_em?: string | null
          fase?: Database["public"]["Enums"]["fase_projeto"]
          id?: string
          marco?: boolean
          ordem?: number
          projeto_id?: string
          titulo?: string
          vence_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entregas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "v_projeto_orcado_realizado"
            referencedColumns: ["projeto_id"]
          },
        ]
      }
      etapas_config: {
        Row: {
          dias_alerta_parado: number | null
          etapa: Database["public"]["Enums"]["etapa_negocio"]
          ordem: number
          probabilidade_padrao: number
          rotulo: string
        }
        Insert: {
          dias_alerta_parado?: number | null
          etapa: Database["public"]["Enums"]["etapa_negocio"]
          ordem: number
          probabilidade_padrao: number
          rotulo: string
        }
        Update: {
          dias_alerta_parado?: number | null
          etapa?: Database["public"]["Enums"]["etapa_negocio"]
          ordem?: number
          probabilidade_padrao?: number
          rotulo?: string
        }
        Relationships: []
      }
      faturas: {
        Row: {
          competencia: string | null
          contrato_id: string
          created_at: string
          descricao: string | null
          id: string
          link_pagamento: string | null
          numero: number
          paga_em: string | null
          status: string
          updated_at: string
          valor: number
          vence_em: string
        }
        Insert: {
          competencia?: string | null
          contrato_id: string
          created_at?: string
          descricao?: string | null
          id?: string
          link_pagamento?: string | null
          numero?: number
          paga_em?: string | null
          status?: string
          updated_at?: string
          valor: number
          vence_em: string
        }
        Update: {
          competencia?: string | null
          contrato_id?: string
          created_at?: string
          descricao?: string | null
          id?: string
          link_pagamento?: string | null
          numero?: number
          paga_em?: string | null
          status?: string
          updated_at?: string
          valor?: number
          vence_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "faturas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      feriados: {
        Row: {
          conta_no_sla: boolean
          data: string
          nome: string
          tipo: string
        }
        Insert: {
          conta_no_sla?: boolean
          data: string
          nome: string
          tipo: string
        }
        Update: {
          conta_no_sla?: boolean
          data?: string
          nome?: string
          tipo?: string
        }
        Relationships: []
      }
      filtros_salvos: {
        Row: {
          compartilhado: boolean
          created_at: string
          escopo: string
          filtros: Json
          id: string
          nome: string
          ordem: number
          profile_id: string
        }
        Insert: {
          compartilhado?: boolean
          created_at?: string
          escopo: string
          filtros: Json
          id?: string
          nome: string
          ordem?: number
          profile_id?: string
        }
        Update: {
          compartilhado?: boolean
          created_at?: string
          escopo?: string
          filtros?: Json
          id?: string
          nome?: string
          ordem?: number
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "filtros_salvos_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ingest_rate_limit: {
        Row: {
          contagem: number
          ip_hash: string
          janela: string
        }
        Insert: {
          contagem?: number
          ip_hash: string
          janela: string
        }
        Update: {
          contagem?: number
          ip_hash?: string
          janela?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          chave_idempotencia: string | null
          consentimento_lgpd_em: string | null
          contato_id: string
          created_at: string
          dor: string
          email_informado: string | null
          empresa_informada: string | null
          ia_complexidade: Database["public"]["Enums"]["complexidade"] | null
          ia_nao_e_para_stark: boolean | null
          ia_rascunho_resposta: string | null
          ia_resumo: string | null
          ia_tipo_projeto: string | null
          ia_urgencia: number | null
          id: string
          investimento: string | null
          ip_hash: string | null
          landing_page: string | null
          motivo_descarte: string | null
          negocio_id: string | null
          nome_informado: string
          origem_informada: string | null
          origem_ingestao: string
          payload_bruto: Json | null
          porte: string | null
          prazo: string | null
          primeira_resposta_em: string | null
          primeira_resposta_por: string | null
          protocolo: number
          referrer: string | null
          respondeu_simulador: boolean
          responsavel_id: string | null
          respostas_extras: Json
          score: number | null
          score_motivos: Json | null
          servicos: Database["public"]["Enums"]["servico"][]
          simulador: Json | null
          situacao_atual: Database["public"]["Enums"]["situacao_atual"] | null
          sla_vence_em: string
          status: string
          updated_at: string
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          whatsapp_informado: string | null
        }
        Insert: {
          chave_idempotencia?: string | null
          consentimento_lgpd_em?: string | null
          contato_id: string
          created_at?: string
          dor: string
          email_informado?: string | null
          empresa_informada?: string | null
          ia_complexidade?: Database["public"]["Enums"]["complexidade"] | null
          ia_nao_e_para_stark?: boolean | null
          ia_rascunho_resposta?: string | null
          ia_resumo?: string | null
          ia_tipo_projeto?: string | null
          ia_urgencia?: number | null
          id?: string
          investimento?: string | null
          ip_hash?: string | null
          landing_page?: string | null
          motivo_descarte?: string | null
          negocio_id?: string | null
          nome_informado: string
          origem_informada?: string | null
          origem_ingestao?: string
          payload_bruto?: Json | null
          porte?: string | null
          prazo?: string | null
          primeira_resposta_em?: string | null
          primeira_resposta_por?: string | null
          protocolo?: number
          referrer?: string | null
          respondeu_simulador?: boolean
          responsavel_id?: string | null
          respostas_extras?: Json
          score?: number | null
          score_motivos?: Json | null
          servicos: Database["public"]["Enums"]["servico"][]
          simulador?: Json | null
          situacao_atual?: Database["public"]["Enums"]["situacao_atual"] | null
          sla_vence_em: string
          status?: string
          updated_at?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          whatsapp_informado?: string | null
        }
        Update: {
          chave_idempotencia?: string | null
          consentimento_lgpd_em?: string | null
          contato_id?: string
          created_at?: string
          dor?: string
          email_informado?: string | null
          empresa_informada?: string | null
          ia_complexidade?: Database["public"]["Enums"]["complexidade"] | null
          ia_nao_e_para_stark?: boolean | null
          ia_rascunho_resposta?: string | null
          ia_resumo?: string | null
          ia_tipo_projeto?: string | null
          ia_urgencia?: number | null
          id?: string
          investimento?: string | null
          ip_hash?: string | null
          landing_page?: string | null
          motivo_descarte?: string | null
          negocio_id?: string | null
          nome_informado?: string
          origem_informada?: string | null
          origem_ingestao?: string
          payload_bruto?: Json | null
          porte?: string | null
          prazo?: string | null
          primeira_resposta_em?: string | null
          primeira_resposta_por?: string | null
          protocolo?: number
          referrer?: string | null
          respondeu_simulador?: boolean
          responsavel_id?: string | null
          respostas_extras?: Json
          score?: number | null
          score_motivos?: Json | null
          servicos?: Database["public"]["Enums"]["servico"][]
          simulador?: Json | null
          situacao_atual?: Database["public"]["Enums"]["situacao_atual"] | null
          sla_vence_em?: string
          status?: string
          updated_at?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          whatsapp_informado?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_primeira_resposta_por_fkey"
            columns: ["primeira_resposta_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagens_saida: {
        Row: {
          agendada_para: string
          assunto: string | null
          canal: string
          chave_idempotencia: string
          contato_id: string | null
          corpo: string
          created_at: string
          destinatario: string
          destino_tipo: string
          enviada_em: string | null
          erro: string | null
          execucao_id: string | null
          id: string
          max_tentativas: number
          profile_id: string | null
          provider: string | null
          provider_message_id: string | null
          reservada_em: string | null
          status: string
          template_chave: string | null
          tentativas: number
        }
        Insert: {
          agendada_para?: string
          assunto?: string | null
          canal: string
          chave_idempotencia: string
          contato_id?: string | null
          corpo: string
          created_at?: string
          destinatario: string
          destino_tipo: string
          enviada_em?: string | null
          erro?: string | null
          execucao_id?: string | null
          id?: string
          max_tentativas?: number
          profile_id?: string | null
          provider?: string | null
          provider_message_id?: string | null
          reservada_em?: string | null
          status?: string
          template_chave?: string | null
          tentativas?: number
        }
        Update: {
          agendada_para?: string
          assunto?: string | null
          canal?: string
          chave_idempotencia?: string
          contato_id?: string | null
          corpo?: string
          created_at?: string
          destinatario?: string
          destino_tipo?: string
          enviada_em?: string | null
          erro?: string | null
          execucao_id?: string | null
          id?: string
          max_tentativas?: number
          profile_id?: string | null
          provider?: string | null
          provider_message_id?: string | null
          reservada_em?: string | null
          status?: string
          template_chave?: string | null
          tentativas?: number
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_saida_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_saida_execucao_id_fkey"
            columns: ["execucao_id"]
            isOneToOne: false
            referencedRelation: "automacoes_execucoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_saida_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_saida_template_chave_fkey"
            columns: ["template_chave"]
            isOneToOne: false
            referencedRelation: "templates_mensagem"
            referencedColumns: ["chave"]
          },
        ]
      }
      negocios: {
        Row: {
          contato_id: string
          created_at: string
          empresa_id: string | null
          etapa: Database["public"]["Enums"]["etapa_negocio"]
          etapa_desde: string
          ganho_em: string | null
          id: string
          motivo_perda: Database["public"]["Enums"]["motivo_perda"] | null
          motivo_perda_detalhe: string | null
          ordem: number
          perdido_em: string | null
          previsao_fechamento: string | null
          probabilidade: number
          responsavel_id: string | null
          servicos: Database["public"]["Enums"]["servico"][]
          titulo: string
          updated_at: string
          valor_estimado: number | null
        }
        Insert: {
          contato_id: string
          created_at?: string
          empresa_id?: string | null
          etapa?: Database["public"]["Enums"]["etapa_negocio"]
          etapa_desde?: string
          ganho_em?: string | null
          id?: string
          motivo_perda?: Database["public"]["Enums"]["motivo_perda"] | null
          motivo_perda_detalhe?: string | null
          ordem?: number
          perdido_em?: string | null
          previsao_fechamento?: string | null
          probabilidade?: number
          responsavel_id?: string | null
          servicos?: Database["public"]["Enums"]["servico"][]
          titulo: string
          updated_at?: string
          valor_estimado?: number | null
        }
        Update: {
          contato_id?: string
          created_at?: string
          empresa_id?: string | null
          etapa?: Database["public"]["Enums"]["etapa_negocio"]
          etapa_desde?: string
          ganho_em?: string | null
          id?: string
          motivo_perda?: Database["public"]["Enums"]["motivo_perda"] | null
          motivo_perda_detalhe?: string | null
          ordem?: number
          perdido_em?: string | null
          previsao_fechamento?: string | null
          probabilidade?: number
          responsavel_id?: string | null
          servicos?: Database["public"]["Enums"]["servico"][]
          titulo?: string
          updated_at?: string
          valor_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "negocios_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocios_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          corpo: string | null
          created_at: string
          id: string
          lida_em: string | null
          link: string | null
          profile_id: string
          tipo: string
          titulo: string
        }
        Insert: {
          corpo?: string | null
          created_at?: string
          id?: string
          lida_em?: string | null
          link?: string | null
          profile_id: string
          tipo: string
          titulo: string
        }
        Update: {
          corpo?: string | null
          created_at?: string
          id?: string
          lida_em?: string | null
          link?: string | null
          profile_id?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nps_respostas: {
        Row: {
          comentario: string | null
          contato_id: string
          enviada_em: string
          id: string
          nota: number | null
          projeto_id: string
          respondida_em: string | null
          token_publico: string
        }
        Insert: {
          comentario?: string | null
          contato_id: string
          enviada_em?: string
          id?: string
          nota?: number | null
          projeto_id: string
          respondida_em?: string | null
          token_publico?: string
        }
        Update: {
          comentario?: string | null
          contato_id?: string
          enviada_em?: string
          id?: string
          nota?: number | null
          projeto_id?: string
          respondida_em?: string | null
          token_publico?: string
        }
        Relationships: [
          {
            foreignKeyName: "nps_respostas_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_respostas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_respostas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "v_projeto_orcado_realizado"
            referencedColumns: ["projeto_id"]
          },
        ]
      }
      profiles: {
        Row: {
          ativo: boolean
          avatar_url: string | null
          capacidade_semanal_horas: number
          created_at: string
          email: string
          id: string
          nome: string
          papel: Database["public"]["Enums"]["papel_equipe"]
          preferencias: Json
          servicos_foco: Database["public"]["Enums"]["servico"][]
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          ativo?: boolean
          avatar_url?: string | null
          capacidade_semanal_horas?: number
          created_at?: string
          email: string
          id: string
          nome: string
          papel?: Database["public"]["Enums"]["papel_equipe"]
          preferencias?: Json
          servicos_foco?: Database["public"]["Enums"]["servico"][]
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          ativo?: boolean
          avatar_url?: string | null
          capacidade_semanal_horas?: number
          created_at?: string
          email?: string
          id?: string
          nome?: string
          papel?: Database["public"]["Enums"]["papel_equipe"]
          preferencias?: Json
          servicos_foco?: Database["public"]["Enums"]["servico"][]
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      projeto_fases: {
        Row: {
          concluida_em: string | null
          fase: Database["public"]["Enums"]["fase_projeto"]
          fim_previsto: string | null
          horas_orcadas: number | null
          id: string
          inicio: string | null
          projeto_id: string
          status: string
        }
        Insert: {
          concluida_em?: string | null
          fase: Database["public"]["Enums"]["fase_projeto"]
          fim_previsto?: string | null
          horas_orcadas?: number | null
          id?: string
          inicio?: string | null
          projeto_id: string
          status?: string
        }
        Update: {
          concluida_em?: string | null
          fase?: Database["public"]["Enums"]["fase_projeto"]
          fim_previsto?: string | null
          horas_orcadas?: number | null
          id?: string
          inicio?: string | null
          projeto_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_fases_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_fases_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "v_projeto_orcado_realizado"
            referencedColumns: ["projeto_id"]
          },
        ]
      }
      projetos: {
        Row: {
          contato_id: string
          created_at: string
          empresa_id: string | null
          entregue_em: string | null
          fase_atual: Database["public"]["Enums"]["fase_projeto"]
          horas_orcadas: number | null
          id: string
          inicio: string | null
          negocio_id: string | null
          nome: string
          previsao_entrega: string | null
          proposta_id: string | null
          responsavel_id: string | null
          saude: string
          status: string
          updated_at: string
          valor_orcado: number | null
        }
        Insert: {
          contato_id: string
          created_at?: string
          empresa_id?: string | null
          entregue_em?: string | null
          fase_atual?: Database["public"]["Enums"]["fase_projeto"]
          horas_orcadas?: number | null
          id?: string
          inicio?: string | null
          negocio_id?: string | null
          nome: string
          previsao_entrega?: string | null
          proposta_id?: string | null
          responsavel_id?: string | null
          saude?: string
          status?: string
          updated_at?: string
          valor_orcado?: number | null
        }
        Update: {
          contato_id?: string
          created_at?: string
          empresa_id?: string | null
          entregue_em?: string | null
          fase_atual?: Database["public"]["Enums"]["fase_projeto"]
          horas_orcadas?: number | null
          id?: string
          inicio?: string | null
          negocio_id?: string | null
          nome?: string
          previsao_entrega?: string | null
          proposta_id?: string | null
          responsavel_id?: string | null
          saude?: string
          status?: string
          updated_at?: string
          valor_orcado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projetos_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_itens: {
        Row: {
          descricao: string
          fase: Database["public"]["Enums"]["fase_projeto"]
          horas: number | null
          id: string
          ordem: number
          proposta_id: string
          valor: number
        }
        Insert: {
          descricao: string
          fase: Database["public"]["Enums"]["fase_projeto"]
          horas?: number | null
          id?: string
          ordem?: number
          proposta_id: string
          valor?: number
        }
        Update: {
          descricao?: string
          fase?: Database["public"]["Enums"]["fase_projeto"]
          horas?: number | null
          id?: string
          ordem?: number
          proposta_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposta_itens_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_visualizacoes: {
        Row: {
          em: string
          id: number
          ip_hash: string | null
          proposta_id: string
          user_agent: string | null
        }
        Insert: {
          em?: string
          id?: never
          ip_hash?: string | null
          proposta_id: string
          user_agent?: string | null
        }
        Update: {
          em?: string
          id?: never
          ip_hash?: string | null
          proposta_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposta_visualizacoes_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
        ]
      }
      propostas: {
        Row: {
          aceita_em: string | null
          aceite_documento: string | null
          aceite_ip_hash: string | null
          aceite_nome: string | null
          created_at: string
          criada_por: string | null
          enviada_em: string | null
          escopo: string | null
          id: string
          modelo: string | null
          negocio_id: string
          pdf_path: string | null
          prazo_semanas: number | null
          primeira_visualizacao_em: string | null
          recorrencia_mensal: number | null
          status: string
          titulo: string
          token_publico: string
          updated_at: string
          valida_ate: string | null
          valor_total: number
          versao: number
          visualizacoes: number
        }
        Insert: {
          aceita_em?: string | null
          aceite_documento?: string | null
          aceite_ip_hash?: string | null
          aceite_nome?: string | null
          created_at?: string
          criada_por?: string | null
          enviada_em?: string | null
          escopo?: string | null
          id?: string
          modelo?: string | null
          negocio_id: string
          pdf_path?: string | null
          prazo_semanas?: number | null
          primeira_visualizacao_em?: string | null
          recorrencia_mensal?: number | null
          status?: string
          titulo: string
          token_publico?: string
          updated_at?: string
          valida_ate?: string | null
          valor_total?: number
          versao?: number
          visualizacoes?: number
        }
        Update: {
          aceita_em?: string | null
          aceite_documento?: string | null
          aceite_ip_hash?: string | null
          aceite_nome?: string | null
          created_at?: string
          criada_por?: string | null
          enviada_em?: string | null
          escopo?: string | null
          id?: string
          modelo?: string | null
          negocio_id?: string
          pdf_path?: string | null
          prazo_semanas?: number | null
          primeira_visualizacao_em?: string | null
          recorrencia_mensal?: number | null
          status?: string
          titulo?: string
          token_publico?: string
          updated_at?: string
          valida_ate?: string | null
          valor_total?: number
          versao?: number
          visualizacoes?: number
        }
        Relationships: [
          {
            foreignKeyName: "propostas_criada_por_fkey"
            columns: ["criada_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          profile_id: string
          user_agent: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          profile_id?: string
          user_agent?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          profile_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reunioes: {
        Row: {
          calendar_event_id: string | null
          contato_id: string
          created_at: string
          fim: string
          id: string
          inicio: string
          meet_url: string | null
          negocio_id: string | null
          notas_descoberta: Json | null
          responsavel_id: string | null
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          calendar_event_id?: string | null
          contato_id: string
          created_at?: string
          fim: string
          id?: string
          inicio: string
          meet_url?: string | null
          negocio_id?: string | null
          notas_descoberta?: Json | null
          responsavel_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          calendar_event_id?: string | null
          contato_id?: string
          created_at?: string
          fim?: string
          id?: string
          inicio?: string
          meet_url?: string | null
          negocio_id?: string | null
          notas_descoberta?: Json | null
          responsavel_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reunioes_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reunioes_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reunioes_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas: {
        Row: {
          concluida_em: string | null
          contato_id: string | null
          created_at: string
          criada_por: string | null
          descricao: string | null
          id: string
          lead_id: string | null
          negocio_id: string | null
          ordem: number
          origem_automacao: string | null
          prioridade: number
          projeto_id: string | null
          responsavel_id: string | null
          status: string
          titulo: string
          updated_at: string
          vence_em: string | null
        }
        Insert: {
          concluida_em?: string | null
          contato_id?: string | null
          created_at?: string
          criada_por?: string | null
          descricao?: string | null
          id?: string
          lead_id?: string | null
          negocio_id?: string | null
          ordem?: number
          origem_automacao?: string | null
          prioridade?: number
          projeto_id?: string | null
          responsavel_id?: string | null
          status?: string
          titulo: string
          updated_at?: string
          vence_em?: string | null
        }
        Update: {
          concluida_em?: string | null
          contato_id?: string | null
          created_at?: string
          criada_por?: string | null
          descricao?: string | null
          id?: string
          lead_id?: string | null
          negocio_id?: string | null
          ordem?: number
          origem_automacao?: string | null
          prioridade?: number
          projeto_id?: string | null
          responsavel_id?: string | null
          status?: string
          titulo?: string
          updated_at?: string
          vence_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_criada_por_fkey"
            columns: ["criada_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_projeto_fk"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_projeto_fk"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "v_projeto_orcado_realizado"
            referencedColumns: ["projeto_id"]
          },
          {
            foreignKeyName: "tarefas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      templates_mensagem: {
        Row: {
          assunto: string | null
          ativo: boolean
          canal: Database["public"]["Enums"]["canal"]
          chave: string
          corpo: string
          destino: string
          id: string
          nome: string
          updated_at: string
          whatsapp_template_name: string | null
        }
        Insert: {
          assunto?: string | null
          ativo?: boolean
          canal: Database["public"]["Enums"]["canal"]
          chave: string
          corpo: string
          destino?: string
          id?: string
          nome: string
          updated_at?: string
          whatsapp_template_name?: string | null
        }
        Update: {
          assunto?: string | null
          ativo?: boolean
          canal?: Database["public"]["Enums"]["canal"]
          chave?: string
          corpo?: string
          destino?: string
          id?: string
          nome?: string
          updated_at?: string
          whatsapp_template_name?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      v_mrr: {
        Row: {
          contratos_recorrentes: number | null
          mrr: number | null
        }
        Relationships: []
      }
      v_projeto_orcado_realizado: {
        Row: {
          horas_orcadas: number | null
          horas_realizadas: number | null
          nome: string | null
          pct_horas: number | null
          projeto_id: string | null
          valor_orcado: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      concluir_execucao: {
        Args: { p_id: string; p_resultado?: Json; p_status?: string }
        Returns: undefined
      }
      concluir_mensagem: {
        Args: {
          p_erro?: string
          p_id: string
          p_ok: boolean
          p_provider?: string
          p_provider_id?: string
        }
        Returns: undefined
      }
      conferir_segredo_cron: { Args: { p_segredo: string }; Returns: boolean }
      criar_lead_manual: { Args: { p: Json }; Returns: Json }
      disparar_outbox: { Args: never; Returns: undefined }
      enfileirar_mensagem: {
        Args: {
          p_agendar?: string
          p_canal: string
          p_chave: string
          p_contato?: string
          p_destinatario: string
          p_destino_tipo: string
          p_execucao?: string
          p_profile?: string
          p_template: string
          p_vars: Json
        }
        Returns: string
      }
      escolher_responsavel: {
        Args: { p_servicos: Database["public"]["Enums"]["servico"][] }
        Returns: string
      }
      formatar_protocolo: { Args: { n: number }; Returns: string }
      gerar_feriados: { Args: { ano: number }; Returns: undefined }
      ids_equipe: {
        Args: { p_papeis: Database["public"]["Enums"]["papel_equipe"][] }
        Returns: string[]
      }
      iniciar_execucao: {
        Args: {
          p_automacao: string
          p_entidade_id: string
          p_entidade_tipo: string
          p_evento?: Json
          p_ocorrencia?: string
        }
        Returns: string
      }
      is_equipe: { Args: never; Returns: boolean }
      normalizar_whatsapp: { Args: { t: string }; Returns: string }
      notificar: {
        Args: {
          p_corpo: string
          p_link: string
          p_profiles: string[]
          p_tipo: string
          p_titulo: string
        }
        Returns: number
      }
      painel_indicadores: { Args: { p_dias?: number }; Returns: Json }
      papel_atual: {
        Args: never
        Returns: Database["public"]["Enums"]["papel_equipe"]
      }
      pascoa: { Args: { ano: number }; Returns: string }
      proximo_horario_comercial: { Args: { ts?: string }; Returns: string }
      registrar_lead: { Args: { p: Json }; Returns: Json }
      render_template: { Args: { texto: string; vars: Json }; Returns: string }
      reservar_mensagens: {
        Args: { p_limite?: number }
        Returns: {
          agendada_para: string
          assunto: string | null
          canal: string
          chave_idempotencia: string
          contato_id: string | null
          corpo: string
          created_at: string
          destinatario: string
          destino_tipo: string
          enviada_em: string | null
          erro: string | null
          execucao_id: string | null
          id: string
          max_tentativas: number
          profile_id: string | null
          provider: string | null
          provider_message_id: string | null
          reservada_em: string | null
          status: string
          template_chave: string | null
          tentativas: number
        }[]
        SetofOptions: {
          from: "*"
          to: "mensagens_saida"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      responder_lead: {
        Args: {
          p_assunto: string
          p_canal: string
          p_corpo: string
          p_lead: string
        }
        Returns: string
      }
      rotulo_servico: {
        Args: { s: Database["public"]["Enums"]["servico"] }
        Returns: string
      }
      sla_deadline: {
        Args: { chegada: string; horas_uteis?: number }
        Returns: string
      }
      tem_papel: {
        Args: { papeis: Database["public"]["Enums"]["papel_equipe"][] }
        Returns: boolean
      }
      verificar_sla: { Args: never; Returns: number }
    }
    Enums: {
      canal: "email" | "whatsapp" | "ligacao" | "reuniao" | "nota" | "sistema"
      complexidade: "P" | "M" | "G"
      direcao: "entrada" | "saida" | "interna"
      etapa_negocio:
        | "novo"
        | "triagem"
        | "diagnostico"
        | "descoberta"
        | "proposta"
        | "negociacao"
        | "ganho"
        | "perdido"
      fase_projeto:
        | "descoberta"
        | "prototipo"
        | "desenvolvimento"
        | "lancamento"
      motivo_perda:
        | "preco"
        | "prazo"
        | "sem_resposta"
        | "concorrente"
        | "fora_de_escopo"
        | "outro"
      papel_equipe: "admin" | "comercial" | "projetos"
      servico:
        | "sistemas_web"
        | "aplicativo"
        | "automacao_ia"
        | "integracoes_apis"
        | "dashboards"
        | "site_landing"
        | "loja_virtual"
        | "evoluir_existente"
      situacao_atual:
        | "manual_whatsapp"
        | "planilhas"
        | "sistema_nao_atende"
        | "nao_existe"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      canal: ["email", "whatsapp", "ligacao", "reuniao", "nota", "sistema"],
      complexidade: ["P", "M", "G"],
      direcao: ["entrada", "saida", "interna"],
      etapa_negocio: [
        "novo",
        "triagem",
        "diagnostico",
        "descoberta",
        "proposta",
        "negociacao",
        "ganho",
        "perdido",
      ],
      fase_projeto: [
        "descoberta",
        "prototipo",
        "desenvolvimento",
        "lancamento",
      ],
      motivo_perda: [
        "preco",
        "prazo",
        "sem_resposta",
        "concorrente",
        "fora_de_escopo",
        "outro",
      ],
      papel_equipe: ["admin", "comercial", "projetos"],
      servico: [
        "sistemas_web",
        "aplicativo",
        "automacao_ia",
        "integracoes_apis",
        "dashboards",
        "site_landing",
        "loja_virtual",
        "evoluir_existente",
      ],
      situacao_atual: [
        "manual_whatsapp",
        "planilhas",
        "sistema_nao_atende",
        "nao_existe",
      ],
    },
  },
} as const
