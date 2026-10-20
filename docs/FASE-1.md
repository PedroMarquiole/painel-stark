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

**Testes automatizados:** 114 (SLA e feriados, paridade SQL↔TS, ingestão, deduplicação, idempotência, rate limit, opt-out, alertas de SLA, outbox, RLS por papel, migração do legado, indicadores). Mais um teste de navegador do arrastar e soltar.

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

## Limitações conhecidas

- **WhatsApp**: não há provedor contratado; a interface está pronta (`WHATSAPP_PROVIDER`), e a ficha tem "Registrar contato" para respostas feitas pelo celular.
- **Telas logadas não foram vistas por mim com dados reais**: este ambiente não alcança o Supabase. As capturas em `docs/fase-1/` usam o modo offline (dados fictícios locais, mesmo layout). O banco, as funções e o envio de e-mail foram testados de verdade.
- **Home personalizável (ligar/desligar/reordenar widgets)** e **PWA com push** ficam para a Fase 2.
- **`pg_net` no schema public** e **leaked password protection**: avisos do Security Advisor, ajuste no painel do Supabase.
