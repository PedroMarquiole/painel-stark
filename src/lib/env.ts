/**
 * Modo offline de desenvolvimento (PAINEL_OFFLINE=1 com `next dev`): telas com dados
 * fictícios locais, sem Supabase. Só para conferir layout sem rede. Nunca em produção.
 */
export const OFFLINE = process.env.PAINEL_OFFLINE === "1" && process.env.NODE_ENV !== "production";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
