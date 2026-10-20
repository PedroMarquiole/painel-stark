# Painel Stark

CRM e operação interna da **Stark — Software sob medida**. Next.js (App Router) + Supabase.

- Plano, schema, mapa de telas e pendências: [`docs/PLANO.md`](docs/PLANO.md)
- Design system: `npm run dev` → <http://localhost:3000/design>
- Testes: `npm test` (inclui as migrations rodando num Postgres em memória via PGlite)

Configuração: copie `.env.example` para `.env.local`. **Nenhuma URL do site fica no código.** Ao trocar de hospedagem ou domínio, ajuste só `SITE_URL` e `ALLOWED_ORIGINS`.
