/**
 * Modo offline de desenvolvimento (PAINEL_OFFLINE=1 com `next dev`): telas com dados
 * fictícios locais, sem Supabase. Só para conferir layout sem rede. Nunca em produção.
 */
export const OFFLINE = process.env.PAINEL_OFFLINE === "1" && process.env.NODE_ENV !== "production";

// Projeto Supabase do painel. Endereço e chave publishable são públicos (vão para o navegador;
// a RLS protege os dados), então servem de padrão quando a hospedagem não define as variáveis.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://vposmagsttyfngdgetxl.supabase.co";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_MeZCXM1Bs7BweInLT8zW_g_Ra4JR7yD";
