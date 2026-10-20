/**
 * Sobe um Postgres em memória (PGlite/WASM) com um esqueleto do Supabase
 * (schema auth, auth.uid(), papéis anon/authenticated/service_role) e aplica
 * todas as migrations em ordem. Roda em CI sem Docker.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

const MIGRATIONS = path.resolve(import.meta.dirname, "../../supabase/migrations");

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now());
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

/** Amostra do painel anterior (stark-dashboard) para testar a migration 0000. */
const LEGADO = `
  create schema cron;
  create table cron.job (jobname text);
  create function cron.unschedule(nome text) returns boolean language sql as $$ delete from cron.job where jobname = nome returning true $$;
  insert into cron.job values ('alertas-diarios'), ('relatorio-mensal'), ('outro-job');
  create type public.perfil_acesso as enum ('admin', 'equipe');
  create table public.equipe (id uuid primary key, perfil public.perfil_acesso);
  create table public.pedidos (id uuid primary key, numero bigint generated always as identity);
  create table public.atividades (id uuid primary key, pedido_id uuid references public.pedidos (id));
  create function public.registrar_pedido(p jsonb) returns jsonb language sql as $$ select p $$;
  create function public.handle_new_user() returns trigger language plpgsql as $$ begin return new; end $$;
  create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
  insert into auth.users (id, email, created_at) values ('11111111-1111-1111-1111-111111111111', 'Dono@Stark.dev.br', now());
`;

export async function createDb({ legado = false } = {}) {
  const db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(SUPABASE_STUB);
  if (legado) await db.exec(LEGADO);
  for (const f of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    try {
      await db.exec(readFileSync(path.join(MIGRATIONS, f), "utf8"));
    } catch (e) {
      throw new Error(`Migration ${f} falhou: ${(e as Error).message}`);
    }
  }
  return db;
}

/** Executa como um usuário autenticado (aplica RLS). */
export async function asUser<T>(db: PGlite, userId: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${userId ? "authenticated" : "anon"}; select set_config('request.jwt.claim.sub', '${userId ?? ""}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}
