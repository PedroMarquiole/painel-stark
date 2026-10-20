# Estado do banco no projeto `stark-dashboard` (vposmagsttyfngdgetxl)

Aplicado em 20/10/2026 pelo conector do Supabase, na ordem:

| Migration aplicada | Arquivo | Observação |
|---|---|---|
| `painel_0000_arquivar_painel_antigo` | `20261020000000_remover_painel_antigo.sql` | Painel anterior movido para o schema `legado` (nada apagado) |
| `painel_0001_base` | `…0001_base.sql` | |
| `painel_0001_reparo_funcoes` | — | Recria `handle_new_user`/`set_updated_at` e gatilhos, levados por uma execução manual do SQL antigo de remoção |
| `painel_0002_crm` … `painel_0005_seguranca` | `…0002` a `…0005` | |
| `painel_0006a/b/c_*` | `…0006_ingestao.sql` | Aplicada em 3 partes. A limpeza diária de `ingest_rate_limit` ainda **não** está agendada (ver abaixo) |
| `painel_0007_ajustes_seguranca` | `…0007_ajustes_seguranca.sql` | |
| `painel_0008a_demo_registros` | `…0008_demonstracao.sql` (só a tabela) | A função `limpar_demonstracao()` **não** foi aplicada |
| `painel_0009_indicadores` | `…0009_indicadores.sql` | KPIs da home |

Dados: 31 leads de demonstração (30 do seed + o teste de ponta a ponta #0031), todos em `demo_registros`.
Conta de teste `teste-claude@stark.local`: **desativada e bloqueada**; apagar com o SQL do checklist.

Configurado fora de migration: segredos do Vault `cron_secret` (gerado no banco) e `outbox_url`.
Edge Functions publicadas: `novo-pedido` (v3) e `outbox-sender` (v1), ambas com `verify_jwt = false`.

## Pendente: aplicar no SQL Editor quando quiser

O conector do Supabase pede uma confirmação (que não aparece na sessão) para qualquer SQL com `DELETE`.
Estes dois trechos ficam para o admin rodar em Dashboard → SQL Editor:

1. **Limpeza da demonstração**: a função `limpar_demonstracao()` de `migrations/20261020000008_demonstracao.sql`; depois `select limpar_demonstracao();`.
2. **Limpeza diária do anti-spam**:
   ```sql
   select cron.schedule('stark-limpar-rate-limit', '17 3 * * *',
     $q$delete from public.ingest_rate_limit where janela < now() - interval '1 day'$q$);
   ```

## Avisos do Security Advisor que ficaram

- `pg_net` no schema `public`: mover exige remover e reinstalar a extensão (Database → Extensions).
- *Leaked password protection*: ligar em Authentication → Settings → Password security.
