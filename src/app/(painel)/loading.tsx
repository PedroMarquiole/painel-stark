import { Skeleton } from "@/components/ui/skeleton";

/** Esqueleto enquanto a tela carrega (mesmo formato do conteúdo, sem pular layout). */
export default function Carregando() {
  return (
    <div className="flex flex-col gap-5 px-4 py-5 sm:px-6" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-7 w-56" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
      </div>
    </div>
  );
}
