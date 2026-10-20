# Painel Stark

CRM e operação interna da **Stark — Software sob medida**. Next.js (App Router) + Supabase.

- Plano, schema, mapa de telas e decisões: [`docs/PLANO.md`](docs/PLANO.md)
- Fase 1 (MVP), deploy e checklist: [`docs/FASE-1.md`](docs/FASE-1.md)
- Estado do banco no Supabase: [`supabase/APLICADO.md`](supabase/APLICADO.md)
- Design system: `npm run dev` → <http://localhost:3000/design>
- Testes: `npm test` (inclui as migrations rodando num Postgres em memória via PGlite)
- Sem rede/Supabase: `npm run dev:offline` abre as telas com dados fictícios locais

Configuração: copie `.env.example` para `.env.local`. **Nenhuma URL do site fica no código.** Ao trocar de hospedagem ou domínio, ajuste só `SITE_URL` e `ALLOWED_ORIGINS`.
