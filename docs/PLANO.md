# Painel Stark — Plano (Fase 0)

> **O sistema trabalha. A equipe decide.**
> Status: **aguardando aprovação** do esqueleto antes da Fase 1.

## 1. Estrutura de pastas

```
painel-stark/
├─ src/
│  ├─ app/
│  │  ├─ (auth)/login/              e-mail e senha (Supabase Auth)                    [F1]
│  │  ├─ (painel)/                  layout: sidebar, ⌘K, atalhos globais, realtime    [F1]
│  │  │  ├─ page.tsx                Home · KPIs em widgets                             [F1]
│  │  │  ├─ leads/                  Caixa de entrada + drawer (@modal/(.)leads/[id])  [F1]
│  │  │  ├─ funil/                  Kanban                                             [F1]
│  │  │  ├─ clientes/[id]/          Ficha 360°                                         [F1]
│  │  │  ├─ tarefas/                Minhas tarefas                                     [F1]
│  │  │  ├─ reunioes/               Agenda de diagnósticos + notas da descoberta       [F2]
│  │  │  ├─ propostas/[id]/         Editor de proposta                                 [F3]
│  │  │  ├─ projetos/[id]/          Quadro por projeto, orçado × realizado             [F3]
│  │  │  ├─ equipe/carga/           Carga semanal da equipe                            [F3]
│  │  │  ├─ financeiro/             Contratos, MRR, faturas                            [F4]
│  │  │  ├─ automacoes/             Regras on/off, editor, log de execuções            [F1 lista · F4 editor]
│  │  │  └─ config/                 Equipe, templates, feriados, etapas                [F1]
│  │  ├─ p/[token]/                 Proposta pública (sem login, via Edge Function)    [F3]
│  │  ├─ nps/[token]/               Pesquisa de satisfação                             [F4]
│  │  └─ design/                    Design system  ✅ FEITO
│  ├─ components/
│  │  ├─ ui/                        primitivos (button, input, badge, drawer, toast…)  ✅
│  │  ├─ domain/                    SLA, KPI, linha de lead, card de Kanban, inline    ✅
│  │  ├─ charts/                    sparkline, tooltip, eixos                          ✅
│  │  └─ layout/                    providers, tema, densidade                         ✅
│  ├─ lib/
│  │  ├─ sla.ts                     1 dia útil + feriados (espelho do SQL)             ✅
│  │  ├─ supabase/                  client, server, middleware, database.types.ts      [F1]
│  │  ├─ validators/                Zod do formulário (compartilhado com Edge)         [F1]
│  │  └─ score.ts                   regras transparentes do lead score                 [F2]
│  └─ hooks/                        use-now (relógio único), atalhos, realtime
├─ supabase/
│  ├─ migrations/                   0001…0005  ✅
│  ├─ functions/                                                                       [F1+]
│  │  ├─ _shared/                   cors (ALLOWED_ORIGINS), zod, WhatsAppProvider, resend, claude
│  │  ├─ novo-pedido/               POST do site → valida → dedup → RPC (endereço mantido)
│  │  ├─ automation-runner/         consome automacoes_execucoes
│  │  ├─ outbox-sender/             envia mensagens_saida (horário comercial, opt-out, retry)
│  │  └─ proposta-publica/          leitura por token, rastreio, aceite
│  └─ seed.sql                      dados fictícios realistas                          [F1]
├─ tests/                           unit (vitest) + banco em memória (PGlite)          ✅
└─ docs/
```

## 2. Banco de dados (feito: `supabase/migrations`)

| Migration | Conteúdo |
|---|---|
| `0000_remover_painel_antigo` | remove tabelas, funções, tipos e jobs do painel anterior do `stark-dashboard` (idempotente) |
| `0001_base` | enums (serviços e situações do site, etapas, motivos de perda, fases), `app_config`, `profiles` + papéis, perfil automático para contas criadas pelo admin (1ª vira admin), proteção de papel, `feriados` gerados (Páscoa calculada), **`sla_deadline()`** |
| `0002_crm` | `empresas`, `contatos` (dedup único por e-mail minúsculo e WhatsApp *E.164*), `etapas_config` (probabilidade e "parado há X dias" por etapa), `negocios`, `leads` (protocolo por sequence, SLA gravado na chegada, campos dos passos 2/3 opcionais + `respostas_extras`, UTM, "como conheceu", consentimento LGPD, simulador, idempotência), `atividades`, `tarefas`, `reunioes`, `filtros_salvos` |
| `0003_operacao` | `propostas` (+ itens por fase, versões, token público, visualizações, aceite), `projetos` (+ fases, entregas), `apontamentos_horas`, `contratos` (avulso/recorrente), `faturas` (idempotente por competência), `nps_respostas`, views `v_mrr` e `v_projeto_orcado_realizado` |
| `0004_automacao` | `templates_mensagem`, `automacoes` (as 15 regras, todas **desligadas**), `automacoes_execucoes` (fila idempotente com retry), `mensagens_saida` (outbox: nada é enviado duas vezes), `notificacoes`, `push_subscriptions`, `ingest_rate_limit` |
| `0005_seguranca` | `auditoria` (diff só do que mudou), **RLS em todas as tabelas**, anon sem acesso, Realtime em leads/negócios/atividades/tarefas/notificações |

**Regras que já vivem no banco** (testadas):
- Protocolo e prazo de SLA são do banco, não do front.
- A 1ª resposta **humana** (e-mail, WhatsApp, ligação, reunião) fecha o SLA. A confirmação automática **não conta**.
- Mudança de etapa gera atividade na linha do tempo, carimba ganho/perda e aplica a probabilidade padrão.
- Perder um negócio exige motivo; descartar um lead exige motivo.

**Permissões**

| | Admin | Comercial | Projetos/Dev |
|---|---|---|---|
| CRM (leads, contatos, negócios, propostas) | escreve | escreve | lê |
| Atividades e tarefas | escreve | escreve | escreve |
| Projetos, fases, entregas | escreve | lê | escreve |
| Horas | todas | as próprias | as próprias |
| Contratos e faturas | escreve | lê | — |
| Regras, templates, config | escreve | lê | lê |
| Auditoria | lê | — | — |

## 3. Mapa de telas

| Tela | O que resolve | Atalhos |
|---|---|---|
| **Home** | KPIs do período vs. anterior, widgets que cada um liga/desliga/reordena; tudo clicável → lista | `G H` |
| **Caixa de entrada** | Leads em tempo real, cronômetro de SLA, filtros salvos, ações rápidas | `G I`, `J/K`, `E` responder, `D` descartar, `A` agendar |
| **Drawer do lead** | Dor, respostas do formulário, score e motivos, rascunho IA, linha do tempo | `Esc`, `E` |
| **Funil** | Kanban das 8 etapas, valor ponderado, forecast, alerta de parado | `G F`, `N` |
| **Ficha 360°** | Todos os pedidos, timeline unificada, propostas, projetos, contratos, LTV | `G C` |
| **Reuniões** | Diagnósticos agendados, formulário de descoberta | — |
| **Propostas** | Editor por modelo, versões, link público, PDF | — |
| **Projetos** | 4 etapas Stark, entregas, horas, orçado × realizado, saúde | `G P` |
| **Financeiro** | MRR, contratos, faturas a vencer/vencidas | — |
| **Automações** | Liga/desliga, log de cada execução, reprocessar | — |
| **Config** | Equipe e papéis, templates, feriados locais, etapas | — |
| **⌘K** | Busca qualquer lead/cliente/projeto + ações | `⌘K` |

Mobile: caixa de entrada, drawer (responder), funil (mover card por menu) e home.

## 4. Ingestão — recomendação

O site mostra o **protocolo** na tela de confirmação, e o protocolo tem que vir do banco. Com o webhook assíncrono do Netlify Forms, o site **não teria** o número na hora. Recomendo:

1. **O formulário faz `POST {SUPABASE_URL}/functions/v1/novo-pedido`** (endereço que o site já usa), que responde `{ protocolo }` de forma síncrona. Funciona em qualquer hospedagem: na mudança de domínio, só se atualiza `ALLOWED_ORIGINS`.
2. A Edge Function cuida de: CORS por env, Zod, honeypot, rate limit por `ip_hash`, normalização (e-mail minúsculo, WhatsApp → E.164), dedup de contato, anexar ao negócio aberto do mesmo contato ou abrir um novo, `chave_idempotencia` (reenvio não duplica), registro do evento das automações 1–5.
3. O Netlify Forms vira só *fallback* (webhook → mesma função), se quiserem manter.

## 5. Design system (feito: `/design`)

- **Tokens** em `src/app/globals.css`: 4 superfícies quentes (`#0C0A07 → #221E19`), texto off-white `#EDE8E0`, acento único da marca `#D9440F`, semânticas dessaturadas e tema claro creme. Densidade **confortável/compacta** via `--row-h` e `--pad-card`.
- **Contraste AA verificado**: texto, texto secundário, acento e semânticas ≥ 4,5:1 nas 3 superfícies dos 2 temas. O "texto sutil" (≥ 3:1) fica só para metadado.
- **Tipografia**: Geist + Geist Mono `tabular-nums`. A escala do Tailwind foi **reduzida a 4 tamanhos** (12/13/15/28), e qualquer outro tamanho não compila.
- **Gráficos**: 6 cores em ordem fixa, **validadas para daltonismo** nos dois temas (ΔE adjacente ≥ 13), com tooltip único e clique levando à lista.
- **Componentes**: botão, input/textarea, badge, **SLA ao vivo**, card de KPI com sparkline, linha da inbox com hover preview, card de Kanban (estado "parado" e "arrastando"), drawer, toast com Desfazer, edição inline otimista, vazio/skeleton/erro, kbd.
- `prefers-reduced-motion` respeitado; animações de 150 a 250 ms com ease-out.

## 6. Decisões tomadas (20/10/2026)

| Tema | Decisão |
|---|---|
| SLA "1 dia útil" | 24h de relógio só em dias úteis: sex 15h → seg 15h; sábado → fim de segunda |
| Feriados | Só os nacionais pausam o SLA. **Carnaval e Corpus Christi são dias úteis** |
| Cor da marca | **`#D9440F`**. Botão `#DC4712` (escuro) / `#C23D0D` (claro); texto e foco em tons AA; gráficos revalidados |
| Login | **E-mail e senha (Supabase Auth)**. Contas criadas pelo admin no Supabase; cadastro público desligado. 1ª conta = admin, demais = comercial |
| Banco | **Evoluir o projeto `stark-dashboard`** (sa-east-1). Plano gratuito já tem 2 projetos ativos |
| Painel antigo | Dados de teste, **descartados**. Migration `0000` remove o legado; a conta de login existente vira admin |
| Ingestão | Manter o endereço **`novo-pedido`** (o site já chama) com contrato compatível: `{ ok, numero }` |
| WhatsApp | Ainda não contratado. Interface pronta, provedor `none`; Fase 1 só com e-mail |
| Agenda | Decidir na Fase 2 |
| Deploy | Vercel |

### O que o painel antigo revelou sobre o formulário

A função `novo-pedido` recebe: `nome, email, whatsapp, empresa, servico` (**um só**), `descricao, prazo, investimento, origem, utm_*, consentimento` (bool, obrigatório) e `website` (campo-isca). O painel antigo também tinha `decisor, motivo_prazo, ferramentas_atuais, qtd_usuarios`. O briefing fala em serviços **múltiplos** + `situacao_atual` + `dor`. A nova ingestão aceita os dois formatos; o repositório do site define qual é o atual.

### Pendências

- Repositório do site (`owner/repo`) para fechar os campos e o formato de `servico`
- Repositório vazio para o painel (`owner/repo`)
- Quais recursos de segurança trazer: anonimização LGPD e 2FA (o consentimento LGPD já entrou)
- Autorização para aplicar as migrations no `stark-dashboard` (apaga o painel antigo)

## 7. Como rodar

```bash
npm install
npm run dev        # http://localhost:3000/design
npm test           # 51 testes: SLA, feriados, paridade SQL↔TS, dedup, idempotência, RLS, migração do legado
npm run build
```

## 8. Checklist manual da Fase 0

- [ ] `/design` no tema do sistema, depois em Escuro e em Claro (botões no topo)
- [ ] Alternar densidade Confortável ↔ Compacta: linhas da tabela e cards mudam
- [ ] Os 5 badges de SLA andam ao vivo; o de "3 min" vira "Estourado" sozinho
- [ ] Passar o mouse no nome de um lead → cartão-resumo
- [ ] Clicar numa linha → drawer abre; `Esc` fecha
- [ ] Editar "Nome" na ficha inline → spinner → ✓
- [ ] "Descartar com Desfazer" → toast com ação
- [ ] Clicar numa barra do gráfico de serviços → toast "Abrir leads de…"
- [ ] Largura de celular (390 px): sem rolagem horizontal

## 9. Fase 1 (após aprovação)

Auth (e-mail e senha) → `novo-pedido` (ajustada ao form real) → caixa de entrada realtime com SLA → drawer/ficha → Kanban com drag-and-drop → automações 1–5 (fila + outbox) → home com KPIs básicos → seed fictício → testes de dedup/idempotência da ingestão.
