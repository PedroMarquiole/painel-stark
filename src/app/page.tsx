import Link from "next/link";

// Fase 0: a home de KPIs entra na Fase 1. Por enquanto, aponta para o design system.
export default function Home() {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="text-center">
        <p className="num text-xs text-fg-subtle">FASE 0</p>
        <h1 className="mt-2 text-xl font-semibold">Painel Stark</h1>
        <p className="mt-1 text-sm text-fg-muted">O sistema trabalha. A equipe decide.</p>
        <Link href="/design" className="mt-6 inline-block text-sm text-accent hover:underline">
          Ver design system →
        </Link>
      </div>
    </main>
  );
}
