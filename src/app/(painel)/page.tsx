import type { Metadata } from "next";
import { indicadores, listarLeadsInbox, perfilAtual } from "@/lib/dados/consultas";
import { semResposta } from "@/lib/pedidos";
import { Inicio } from "./inicio";

export const metadata: Metadata = { title: "Início" };

export default async function Home({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const { dias: d } = await searchParams;
  const dias = [7, 30, 90].includes(Number(d)) ? Number(d) : 30;
  const [k, perfil, leads] = await Promise.all([indicadores(dias), perfilAtual(), listarLeadsInbox()]);
  // Sem resposta, do prazo mais apertado para o mais folgado
  const pendentes = leads
    .filter(semResposta)
    .sort((a, b) => a.sla_vence_em.localeCompare(b.sla_vence_em));
  return <Inicio k={k} nome={perfil?.nome ?? ""} pendentes={pendentes} />;
}
