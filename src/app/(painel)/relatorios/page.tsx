import type { Metadata } from "next";
import { indicadores } from "@/lib/dados/consultas";
import { Relatorios } from "./relatorios";

export const metadata: Metadata = { title: "Relatórios" };

export default async function Pagina({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const { dias: d } = await searchParams;
  const dias = [7, 30, 90].includes(Number(d)) ? Number(d) : 30;
  return <Relatorios k={await indicadores(dias)} />;
}
