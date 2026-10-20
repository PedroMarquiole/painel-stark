import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import { Providers } from "@/components/layout/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Painel Stark", template: "%s · Painel Stark" },
  description: "CRM e operação interna da Stark — Software sob medida.",
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0c0a07" },
    { media: "(prefers-color-scheme: light)", color: "#f3eee5" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={GeistMono.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
