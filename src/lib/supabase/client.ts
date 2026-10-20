"use client";
import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import type { Database } from "./database.types";

let cliente: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Cliente do navegador (Realtime). Só a chave pública; RLS protege os dados. */
export function supabaseNavegador() {
  cliente ??= createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
  return cliente;
}

export const offlineNoNavegador = () => process.env.NEXT_PUBLIC_PAINEL_OFFLINE === "1";
