"use client";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/** Modal centralizado. Use só quando a tarefa precisa de foco (formulário curto); no resto, drawer ou inline. */
export function Dialog({
  open, onOpenChange, title, description, children, className, footer,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; title: React.ReactNode; description?: React.ReactNode;
  children: React.ReactNode; className?: string; footer?: React.ReactNode;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-canvas/60 backdrop-blur-[2px] data-[state=open]:animate-[fade_150ms_ease-out]" />
        <D.Content
          onInteractOutside={noAviso}
          className={cn(
            "fixed left-1/2 top-[12vh] z-50 flex max-h-[80vh] w-[calc(100%-32px)] max-w-lg -translate-x-1/2 flex-col rounded-2xl bg-bloco shadow-pop outline-none data-[state=open]:animate-enter",
            className,
          )}
        >
          <header className="flex items-start gap-3 border-b border-border px-5 py-4">
            <div className="flex-1">
              <D.Title className="font-[family-name:var(--font-display)] text-md font-semibold">{title}</D.Title>
              {description && <D.Description className="mt-0.5 text-xs text-fg-muted">{description}</D.Description>}
            </div>
            <D.Close asChild><Button variant="ghost" size="icon-sm" aria-label="Fechar"><X /></Button></D.Close>
          </header>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <footer className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</footer>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export const Select = ({ className, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    className={cn(
      "h-8 rounded-lg border border-transparent bg-bloco-inset px-2 text-sm text-fg transition-colors hover:border-border-strong focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25",
      className,
    )}
    {...p}
  />
);

/** Clicar num aviso (ex.: Desfazer) não fecha o painel aberto. */
const noAviso = (e: Event) => {
  if ((e.target as Element | null)?.closest?.("[data-sonner-toaster]")) e.preventDefault();
};
