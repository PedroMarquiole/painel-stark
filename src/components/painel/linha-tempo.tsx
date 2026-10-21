import { Bot, CheckCircle2, Columns3, Inbox, Mail, MessageCircle, Phone, StickyNote, UserRound, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Atividade } from "@/lib/dados/tipos";
import { cn } from "@/lib/utils";

const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

function icone(a: Atividade) {
  if (a.tipo === "lead_recebido") return Inbox;
  if (a.tipo === "mudanca_etapa") return Columns3;
  if (a.tipo === "atribuicao") return UserRound;
  if (a.tipo === "nota") return StickyNote;
  if (a.canal === "email") return Mail;
  if (a.canal === "whatsapp") return MessageCircle;
  if (a.canal === "ligacao") return Phone;
  if (a.canal === "reuniao") return Video;
  return a.automatica ? Bot : CheckCircle2;
}

/** Linha do tempo unificada: tudo que aconteceu com o cliente, do mais recente ao mais antigo. */
export function LinhaTempo({ atividades, vazio = "Nada registrado ainda." }: { atividades: Atividade[]; vazio?: string }) {
  if (!atividades.length) return <p className="text-sm text-fg-muted">{vazio}</p>;
  return (
    <ol className="relative flex flex-col gap-4 before:absolute before:inset-y-1 before:left-[11px] before:w-px before:bg-border">
      {atividades.map((a) => {
        const I = icone(a);
        const humana = a.direcao === "saida" && !a.automatica;
        return (
          <li key={a.id} className="relative flex gap-3">
            <span className={cn(
              "z-10 grid size-6 shrink-0 place-items-center rounded-full border border-border bg-raised text-fg-muted [&_svg]:size-3",
              humana && "border-success/40 text-success",
              a.tipo === "lead_recebido" && "border-accent/40 text-accent",
            )}>
              <I aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="flex flex-wrap items-center gap-x-2 text-sm">
                <span className="font-medium">{a.titulo}</span>
                {a.automatica && <Badge tone="neutral">auto</Badge>}
              </p>
              <p className="num text-xs text-fg-subtle">
                {fmt.format(new Date(a.ocorreu_em))}{a.autor_nome ? <span className="font-sans"> · {a.autor_nome}</span> : null}
              </p>
              {a.corpo && a.tipo !== "lead_recebido" && (
                <p className="mt-1.5 whitespace-pre-wrap rounded-xl bg-bloco-inset px-3 py-2 text-sm text-fg-muted">{a.corpo}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
