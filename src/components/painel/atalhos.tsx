"use client";
import { Dialog } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";

const GRUPOS: [string, [string[], string][]][] = [
  ["Em qualquer tela", [[["⌘", "K"], "Buscar / comandos"], [["N"], "Novo lead"], [["?"], "Esta lista"], [["G", "H"], "Início"], [["G", "I"], "Caixa de entrada"], [["G", "F"], "Funil"], [["G", "R"], "Relatórios"], [["G", "A"], "Automações"]]],
  ["Caixa de entrada", [[["J"], "Próximo"], [["K"], "Anterior"], [["Enter"], "Abrir"], [["E"], "Responder"], [["D"], "Descartar"], [["Esc"], "Fechar painel"]]],
];

export function Atalhos({ aberto, setAberto }: { aberto: boolean; setAberto: (v: boolean) => void }) {
  return (
    <Dialog open={aberto} onOpenChange={setAberto} title="Atalhos de teclado">
      <div className="grid gap-6 sm:grid-cols-2">
        {GRUPOS.map(([titulo, itens]) => (
          <div key={titulo}>
            <p className="mb-2 text-xs font-medium text-fg-subtle">{titulo}</p>
            <ul className="flex flex-col gap-1.5 text-sm">
              {itens.map(([teclas, rotulo]) => (
                <li key={rotulo} className="flex items-center justify-between gap-3">
                  <span className="text-fg-muted">{rotulo}</span>
                  <span className="flex gap-1">{teclas.map((t) => <Kbd key={t}>{t}</Kbd>)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Dialog>
  );
}
