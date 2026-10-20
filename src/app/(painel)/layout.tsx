import { redirect } from "next/navigation";
import { Shell } from "@/components/painel/shell";
import { OFFLINE } from "@/lib/env";
import { listarEquipe, listarLeadsInbox, listarNotificacoes, perfilAtual } from "@/lib/dados/consultas";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const perfil = await perfilAtual();
  if (!perfil) redirect("/login");
  const [equipe, notificacoes, leads] = await Promise.all([listarEquipe(), listarNotificacoes(), listarLeadsInbox()]);
  const abertos = leads.filter((l) => !l.primeira_resposta_em && (l.status === "novo" || l.status === "em_atendimento")).length;
  return (
    <Shell perfil={perfil} equipe={equipe} notificacoes={notificacoes} abertos={abertos} offline={OFFLINE}>
      {children}
    </Shell>
  );
}
