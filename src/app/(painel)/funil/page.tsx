import type { Metadata } from "next";
import { listarEtapas, listarNegocios } from "@/lib/dados/consultas";
import { Kanban } from "./kanban";

export const metadata: Metadata = { title: "Funil" };

export default async function FunilPage() {
  const [negocios, etapas] = await Promise.all([listarNegocios(), listarEtapas()]);
  return <Kanban iniciais={negocios} etapas={etapas} />;
}
