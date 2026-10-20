"use client";
import * as React from "react";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";

export type Density = "comfortable" | "compact";
const DensityCtx = React.createContext<{ density: Density; setDensity: (d: Density) => void }>({
  density: "comfortable",
  setDensity: () => {},
});
export const useDensity = () => React.useContext(DensityCtx);

/** Densidade por usuário. Fase 1: persistir em profiles.preferencias além do localStorage. */
function DensityProvider({ children }: { children: React.ReactNode }) {
  const [density, setDensityState] = React.useState<Density>("comfortable");
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("stark:density") as Density | null;
      if (saved) setDensityState(saved);
    } catch {}
  }, []);
  React.useEffect(() => {
    document.documentElement.dataset.density = density;
  }, [density]);
  const setDensity = React.useCallback((d: Density) => {
    setDensityState(d);
    try {
      localStorage.setItem("stark:density", d);
    } catch {}
  }, []);
  return <DensityCtx.Provider value={{ density, setDensity }}>{children}</DensityCtx.Provider>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    // Escuro é o visual base (CSS sem classe); "system" segue o SO, com troca manual.
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <DensityProvider>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </DensityProvider>
    </ThemeProvider>
  );
}
