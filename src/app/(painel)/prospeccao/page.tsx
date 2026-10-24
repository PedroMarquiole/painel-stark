import type { Metadata } from "next";
import { configProspeccao, indicadoresProspeccao, listarProspects, modelosProspeccao } from "@/lib/dados/consultas";
import { Prospeccao } from "./prospeccao";

export const metadata: Metadata = { title: "Prospecção" };
// A busca de empresas pode levar até ~40 s (OpenStreetMap); o padrão da Vercel corta em 10 s
export const maxDuration = 60;

export default async function Pagina() {
  const [prospects, indicadores, modelos, config] = await Promise.all([listarProspects(), indicadoresProspeccao(), modelosProspeccao(), configProspeccao()]);
  return <Prospeccao iniciais={prospects} indicadores={indicadores} modelos={modelos} config={config} />;
}
