import type { Metadata } from "next";
import { configProspeccao, indicadoresProspeccao, listarProspects, modelosProspeccao } from "@/lib/dados/consultas";
import { Prospeccao } from "./prospeccao";

export const metadata: Metadata = { title: "Prospecção" };

export default async function Pagina() {
  const [prospects, indicadores, modelos, config] = await Promise.all([listarProspects(), indicadoresProspeccao(), modelosProspeccao(), configProspeccao()]);
  return <Prospeccao iniciais={prospects} indicadores={indicadores} modelos={modelos} config={config} />;
}
