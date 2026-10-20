export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <img src="/logo-simbolo.svg" alt="" className="size-8" />
          <div>
            <p className="font-[family-name:var(--font-display)] text-md font-semibold">Painel Stark</p>
            <p className="text-xs text-fg-muted">O sistema trabalha. A equipe decide.</p>
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}
