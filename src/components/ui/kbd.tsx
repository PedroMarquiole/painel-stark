import { cn } from "@/lib/utils";

export function Kbd({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-border-strong border-b-2 bg-raised px-1 font-mono text-xs text-fg-muted",
        className,
      )}
      {...props}
    />
  );
}
