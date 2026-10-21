"use client";
import { Toaster as Sonner, toast } from "sonner";
import { useTheme } from "next-themes";

export function Toaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={(resolvedTheme as "light" | "dark") ?? "dark"}
      position="bottom-right"
      gap={8}
      toastOptions={{
        classNames: {
          toast: "!bg-raised !border-border !text-fg !shadow-pop !rounded-xl !text-sm !font-sans",
          description: "!text-fg-muted",
          actionButton: "!bg-accent !text-accent-fg !rounded-full !font-medium",
        },
      }}
    />
  );
}

/** Ação destrutiva: executa já (otimista) e oferece Desfazer. Sem pop-up de confirmação. */
export function toastUndo(message: string, onUndo: () => void) {
  toast(message, { action: { label: "Desfazer", onClick: onUndo }, duration: 6000 });
}
