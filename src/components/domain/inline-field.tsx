"use client";
import * as React from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Edição inline: clica, edita, Enter/blur salva, Esc cancela.
 * Otimista: mostra o valor novo na hora; indicador discreto de salvamento.
 */
export function InlineField({
  value,
  onSave,
  placeholder = "Adicionar…",
  mono,
  className,
  disabled = false,
  exibir,
}: {
  value: string;
  onSave: (v: string) => Promise<void> | void;
  placeholder?: string;
  mono?: boolean;
  className?: string;
  /** Somente leitura (papel sem permissão): mostra o valor, sem editar. */
  disabled?: boolean;
  /** Como mostrar o valor fora da edição (ex.: "52000" → "R$ 52.000"). */
  exibir?: (v: string) => string;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const [state, setState] = React.useState<"idle" | "saving" | "saved">("idle");
  const [shown, setShown] = React.useState(value);

  React.useEffect(() => setShown(value), [value]);

  async function commit() {
    setEditing(false);
    if (draft === shown) return;
    const prev = shown;
    setShown(draft);
    setState("saving");
    try {
      await onSave(draft);
      setState("saved");
      setTimeout(() => setState("idle"), 1200);
    } catch {
      setShown(prev);
      setState("idle");
    }
  }

  return (
    <span className={cn("group relative inline-flex min-w-0 max-w-full items-center gap-1.5", className)}>
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(shown);
              setEditing(false);
            }
          }}
          className={cn(
            "-mx-1.5 h-7 w-full rounded-md border border-accent bg-canvas px-1.5 text-sm outline-none ring-2 ring-accent/20",
            mono && "num",
          )}
        />
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setDraft(shown);
            setEditing(true);
          }}
          className={cn(
            "-mx-1.5 h-7 truncate rounded-md px-1.5 text-left text-sm transition-colors duration-150 hover:bg-overlay disabled:cursor-default disabled:hover:bg-transparent",
            !shown && "text-fg-subtle",
            mono && "num",
          )}
        >
          {shown ? (exibir ? exibir(shown) : shown) : disabled ? "—" : placeholder}
        </button>
      )}
      <span aria-live="polite" className="w-3.5 text-fg-subtle [&_svg]:size-3.5">
        {state === "saving" && <Loader2 className="animate-spin" aria-label="Salvando" />}
        {state === "saved" && <Check className="text-success" aria-label="Salvo" />}
      </span>
    </span>
  );
}
