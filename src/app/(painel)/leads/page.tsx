import type { Metadata } from "next";
import { listarFiltros, listarLeadsInbox } from "@/lib/dados/consultas";
import { CaixaEntrada } from "./caixa-entrada";

export const metadata: Metadata = { title: "Caixa de entrada" };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const { dias } = await searchParams;
  const n = Number(dias);
  const [leads, filtros] = await Promise.all([listarLeadsInbox([7, 30, 90].includes(n) ? n : 14), listarFiltros("inbox")]);
  return <CaixaEntrada iniciais={leads} filtrosIniciais={filtros} />;
}
