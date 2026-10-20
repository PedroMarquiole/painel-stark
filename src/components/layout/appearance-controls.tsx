"use client";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Rows3, Rows4, Sun } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { useDensity } from "./providers";

export function AppearanceControls() {
  const { theme, setTheme } = useTheme();
  const { density, setDensity } = useDensity();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented
        label="Tema"
        value={mounted ? ((theme as "system" | "dark" | "light") ?? "system") : "system"}
        onChange={setTheme}
        options={[
          { value: "system", label: <Monitor />, title: "Sistema" },
          { value: "dark", label: <Moon />, title: "Escuro" },
          { value: "light", label: <Sun />, title: "Claro" },
        ]}
      />
      <Segmented
        label="Densidade"
        value={density}
        onChange={setDensity}
        options={[
          { value: "comfortable", label: <><Rows3 /><span className="hidden sm:inline">Confortável</span></> },
          { value: "compact", label: <><Rows4 /><span className="hidden sm:inline">Compacta</span></> },
        ]}
      />
    </div>
  );
}
