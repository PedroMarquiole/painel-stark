# Fase 1 — MVP

Branch `fase-1`. Banco aplicado no projeto Supabase `stark-dashboard`. Falta só o deploy do painel na Vercel (passo a passo abaixo).

## O que foi entregue

| Item do briefing | Onde |
|---|---|
| Auth (e-mail e senha, contas criadas pelo admin, recuperação de senha) | `/login`, `src/middleware.ts` |
| Ingestão do formulário | Edge Function `novo-pedido` (mesmo endereço e contrato que o site já usa) → `registrar_lead()` |
| Caixa de entrada em tempo real com SLA | `/leads` — visões, filtros, filtros salvos da equipe, J/K/E/D, ficha lateral |
| Ficha do lead / cliente 360° | ficha lateral em `/leads?id=…` e `/clientes/[id]` |
| Funil Kanban | `/funil` — arrastar e soltar, motivo de perda obrigatório, Desfazer, ponderado, parado |
| Automações 1–5 | banco (`registrar_lead`, `verificar_sla` via pg_cron) + `outbox-sender` (Resend) |
| Home com KPIs | `/` — `painel_indicadores()`; 7/30/90 dias × período anterior |
| ⌘K, atalhos, notificações ao vivo, novo lead manual, tema/densidade | em todas as telas |

**Testado de ponta a ponta no Supabase real:** pedido pela `novo-pedido` → protocolo `#0031` devolvido ao site → responsável por rodízio → e-mail de confirmação ao cliente e aviso à equipe enviados pelo Resend (chegou na caixa de entrada) → notificação no painel.

**Testes automatizados:** 136 (SLA e feriados, paridade SQL↔TS, ingestão, deduplicação, idempotência, rate limit por IP e global, opt-out, alertas de SLA por estágio, outbox com falha definitiva, RLS por papel, redirecionamento seguro, migração do legado, indicadores no fuso de São Paulo). Mais testes de navegador (arrastar e soltar com mouse, teclado e toque).

**Revisão adversarial:** 58 achados levantados por revisores independentes; 51 confirmados e corrigidos (migration `0010` e commit de correções), 7 refutados. Os principais: redirecionamento aberto no login, e-mail de confirmação usado como relay, anti-spam contornável por cabeçalho, Desfazer do funil incompleto, arrastar no celular, alertas de SLA dos dados de demonstração, ações bloqueadas pela RLS aparecendo como sucesso.

## Deploy na Vercel (você)

1. Em vercel.com → **Add New → Project** → importe `PedroMarquiole/painel-stark`.
2. Em **Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://vposmagsttyfngdgetxl.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable_MeZCXM1Bs7BweInLT8zW_g_Ra4JR7yD`
   - `PANEL_URL` = a URL que a Vercel der ao projeto (ex.: `https://painel-stark.vercel.app`)
3. Deploy (branch `main` depois do merge, ou `fase-1` para testar antes).
4. Me passe a URL: eu gravo em `app_config.painel_url` para os links dos e-mails apontarem para o painel.

## Ajustes no painel do Supabase (você)

| Onde | O quê |
|---|---|
| Authentication → Sign In / Providers → Email | **Desligar "Allow new users to sign up"** (contas só pelo admin) |
| Authentication → URL Configuration | *Site URL* = URL da Vercel; em *Redirect URLs* adicionar `https://<url-da-vercel>/auth/callback` |
| Authentication → Users → Add user | Criar as contas da equipe (e-mail + senha, "Auto confirm"). Entram como Comercial; mude o papel em SQL até a tela de equipe chegar (Fase 2) |
| Authentication → Settings → Password security | Ligar *Leaked password protection* (aviso do Security Advisor) |

## SQL para rodar no SQL Editor quando quiser

O conector do Supabase pede uma confirmação que não aparece aqui para qualquer `DELETE`, então isto fica com você:

```sql
-- 1) Apagar a conta de teste do Claude (já está desativada e bloqueada)
delete from auth.users where email = 'teste-claude@stark.local';

-- 2) Limpeza diária do anti-spam
select cron.schedule('stark-limpar-rate-limit', '17 3 * * *',
  $q$delete from public.ingest_rate_limit where janela < now() - interval '1 day'$q$);

-- 3) Antes de usar para valer: criar a função de limpeza (arquivo supabase/migrations/20261020000008_demonstracao.sql)
--    e depois apagar os dados de demonstração:
-- select limpar_demonstracao();

-- 4) Mudar o papel de alguém da equipe
-- update profiles set papel = 'admin' where email = 'fulano@stark.dev.br';   -- admin | comercial | projetos

-- 5) Quando quiser, apagar o painel antigo arquivado
-- drop schema legado cascade;
```

## Checklist manual (com o painel no ar)

- [ ] Entrar com seu e-mail e senha; sair; "Esqueci minha senha" chega no e-mail e leva para "Nova senha"
- [ ] Início: KPIs aparecem; trocar 7/30/90 dias; clicar num KPI leva à lista
- [ ] Mandar um pedido pelo site → em segundos aparece no topo da caixa de entrada com "novo", toast e sino; confirmação chega no e-mail do cliente
- [ ] Contador de SLA anda; "vencendo" fica âmbar abaixo de 4h; "estourado" vermelho
- [ ] `J`/`K` navegam, `Enter` abre a ficha, `E` abre resposta, `D` abre descarte, `Esc` fecha
- [ ] Responder por e-mail → SLA vira "Respondido", e-mail chega ao cliente, aparece na linha do tempo
- [ ] "Registrar contato" (WhatsApp pelo celular / ligação) também fecha o SLA
- [ ] Descartar com motivo → some de "Sem resposta" → "Desfazer" no toast traz de volta
- [ ] Trocar responsável na ficha; editar nome/e-mail/WhatsApp inline
- [ ] Salvar um filtro na caixa de entrada; outra pessoa da equipe vê o filtro
- [ ] Funil: arrastar card; "Desfazer"; soltar em Perdido exige motivo; editar valor e probabilidade na ficha do negócio; selo "parado"
- [ ] `⌘K`: buscar por nome, e-mail ou `#0031`; ir para telas; alternar tema
- [ ] `N`: criar lead manual → confirmação ao cliente e aviso à equipe
- [ ] Automações: só admin liga/desliga 1–5; últimas execuções aparecem
- [ ] Celular: caixa de entrada em cartões, responder pela ficha, funil (mudar etapa pela ficha do negócio), KPIs
- [ ] Tema claro/escuro e densidade compacta em todas as telas
- [ ] Visão "Vencendo" mostra só quem tem menos de 4h; link de e-mail `/leads?id=…` abre a ficha certa
- [ ] Funil: mover para Ganho e "Desfazer" → card volta com a mesma probabilidade e datas
- [ ] Celular: segurar e arrastar um card do funil funciona (toque)
- [ ] Marcar opt-out de e-mail num cliente → botão de responder por e-mail fica desabilitado
- [ ] "Registrar contato" com horário no passado → SLA fecha pelo horário informado
- [ ] Conta com papel Projetos: vê leads e funil, mas não responde, não descarta e não move cards

## Organização (21/10)

O caminho do pedido ficou sempre o mesmo, em todas as telas:

```
Novos (prazo correndo) → você responde → Em conversa (o negócio anda para Em triagem no funil) → Arquivados (ganho, perdido ou descartado)
```

- **Caixa de entrada:** abas Novos · Em conversa · Arquivados; filtros rápidos Vencendo em 4h, Prazo estourado e Só os meus. Ao responder, o aviso diz para onde o pedido foi e tem "Ver". Cada pedido respondido mostra a etapa do funil.
- **Funil:** Ganho e Perdido recolhidos no fim; busca, filtros e ordenação; cartão com dias na etapa, próximo passo e "Sem resposta, prazo vence em…"; visão em lista ordenável; `/funil?id=…` abre o negócio.
- **Coerência:** Início, menu e caixa de entrada contam os pedidos pela mesma regra; "prazo" no lugar de "SLA"; ⌘K encontra comandos; menu do celular acessível pelo teclado.

Checklist extra:
- [ ] Responder um pedido em Novos → aviso "foi para Em conversa" → "Ver" leva até ele; no Funil o card está em Em triagem
- [ ] Clicar duas vezes rápido em "Enviar e-mail" manda um e-mail só
- [ ] Funil: abrir/recolher Ganho e Perdido; arrastar um card para Ganho recolhido; trocar para Lista e ordenar por Valor
- [ ] Ajustar a chance de fechar de um negócio e mover o card: a chance ajustada continua

## Limitações conhecidas

- **WhatsApp**: não há provedor contratado; a interface está pronta (`WHATSAPP_PROVIDER`), e a ficha tem "Registrar contato" para respostas feitas pelo celular.
- **Telas logadas não foram vistas por mim com dados reais**: este ambiente não alcança o Supabase. As capturas em `docs/fase-1/` usam o modo offline (dados fictícios locais, mesmo layout). O banco, as funções e o envio de e-mail foram testados de verdade.
- **Home personalizável (ligar/desligar/reordenar widgets)** e **PWA com push** ficam para a Fase 2.
- **`pg_net` no schema public** e **leaked password protection**: avisos do Security Advisor, ajuste no painel do Supabase.
