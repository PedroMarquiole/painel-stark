import type { Metadata } from "next";
import { indicadores, perfilAtual } from "@/lib/dados/consultas";
import { Inicio } from "./inicio";

export const metadata: Metadata = { title: "Início" };

export default async function Home({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const { dias: d } = await searchParams;
  const dias = [7, 30, 90].includes(Number(d)) ? Number(d) : 30;
  const [k, perfil] = await Promise.all([indicadores(dias), perfilAtual()]);
  return <Inicio k={k} nome={perfil?.nome ?? ""} />;
}
