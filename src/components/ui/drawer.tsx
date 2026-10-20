"use client";
import * as React from "react";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/** Painel lateral: abre lead/cliente sem sair da lista. Esc fecha. */
export function Drawer({
  open,
  onOpenChange,
  title,
  subtitle,
  actions,
  children,
  width = 560,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  width?: number;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-canvas/40 data-[state=open]:animate-[fade_200ms_ease-out]" />
        <D.Content
          style={{ maxWidth: width }}
          tabIndex={-1}
          // Foca o painel, não o primeiro botão: Enter/atalhos não disparam ações sem querer
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement | null)?.focus();
          }}
          // Esc num campo em edição só sai do campo; o segundo Esc fecha o painel
          onEscapeKeyDown={(e) => {
            const ativo = document.activeElement as HTMLElement | null;
            if (ativo?.matches("input, textarea, select")) {
              e.preventDefault();
              ativo.blur();
            }
          }}
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-raised shadow-pop outline-none",
            "transition-transform duration-200 ease-out data-[state=open]:animate-[drawer-in_220ms_cubic-bezier(0.2,0.8,0.2,1)]",
          )}
        >
          <header className="flex items-start gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0 flex-1">
              <D.Title className="truncate font-[family-name:var(--font-display)] text-md font-semibold">{title}</D.Title>
              {subtitle && <D.Description className="mt-0.5 text-xs text-fg-muted">{subtitle}</D.Description>}
            </div>
            {actions}
            <D.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Fechar (Esc)">
                <X />
              </Button>
            </D.Close>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
