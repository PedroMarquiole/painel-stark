import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fichaContato } from "@/lib/dados/consultas";
import { Ficha360 } from "./ficha";

export const metadata: Metadata = { title: "Cliente" };

export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ficha = await fichaContato(id);
  if (!ficha) notFound();
  return <Ficha360 ficha={ficha} />;
}
