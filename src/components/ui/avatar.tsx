import { cn } from "@/lib/utils";

const tones = ["bg-series-1", "bg-series-2", "bg-series-3", "bg-series-4", "bg-series-5", "bg-series-6"];

/** Cor estável por pessoa (hash do nome), nunca por posição. */
function toneFor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return tones[h % tones.length];
}

export function Avatar({ name, src, size = 24, className }: { name: string; src?: string; size?: number; className?: string }) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
  return (
    <span
      title={name}
      style={{ width: size, height: size, fontSize: size < 28 ? 10 : 12 }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-canvas ring-2 ring-raised",
        !src && toneFor(name),
        className,
      )}
    >
      {src ? <img src={src} alt="" className="size-full object-cover" /> : initials}
    </span>
  );
}
