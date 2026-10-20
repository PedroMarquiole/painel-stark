import type { Metadata } from "next";
import { listarAutomacoes } from "@/lib/dados/consultas";
import { Automacoes } from "./automacoes";

export const metadata: Metadata = { title: "Automações" };

export default async function AutomacoesPage() {
  const { regras, execucoes } = await listarAutomacoes();
  return <Automacoes regras={regras} execucoes={execucoes} />;
}
