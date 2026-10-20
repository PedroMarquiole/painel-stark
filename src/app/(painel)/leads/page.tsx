import type { Metadata } from "next";
import { listarFiltros, listarLeadsInbox } from "@/lib/dados/consultas";
import { CaixaEntrada } from "./caixa-entrada";

export const metadata: Metadata = { title: "Caixa de entrada" };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ id?: string; visao?: string }> }) {
  const [{ id, visao }, leads, filtros] = await Promise.all([searchParams, listarLeadsInbox(), listarFiltros("inbox")]);
  return <CaixaEntrada iniciais={leads} idInicial={id ?? null} visaoInicial={visao} filtrosIniciais={filtros} />;
}
