"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

let cliente: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Cliente do navegador (Realtime). Só a chave pública; RLS protege os dados. */
export function supabaseNavegador() {
  cliente ??= createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  );
  return cliente;
}

export const offlineNoNavegador = () => process.env.NEXT_PUBLIC_PAINEL_OFFLINE === "1";
