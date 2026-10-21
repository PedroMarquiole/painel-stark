"use client";
import { cn } from "@/lib/utils";

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; title?: string }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex h-10 items-center gap-0.5 rounded-full bg-bloco p-1 shadow-bloco">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex h-full items-center gap-1.5 rounded-full px-3.5 text-xs font-medium text-fg-muted transition-colors duration-150 [&_svg]:size-3.5",
            value === o.value ? "bg-invert text-invert-fg" : "hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
