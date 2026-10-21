import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fichaContato } from "@/lib/dados/consultas";
import { Ficha360 } from "./ficha";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const ficha = await fichaContato((await params).id);
  return { title: ficha?.contato.nome ?? "Cliente" };
}

export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ficha = await fichaContato(id);
  if (!ficha) notFound();
  return <Ficha360 ficha={ficha} />;
}
