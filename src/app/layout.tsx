import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { CompareProvider } from "@/components/compare-context";
import { CompareTray } from "@/components/compare-tray";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MercaNova — Tecnología con asistente inteligente",
  description: "Encontrá, compará y comprá tecnología con la ayuda de un asistente con IA.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-muted/30">
        <CompareProvider>
          <SiteHeader />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
          <Suspense fallback={null}>
            <CompareTray />
          </Suspense>
          <footer className="border-t bg-background py-4 text-center text-xs text-muted-foreground">
            MercaNova · Prototipo académico · Compras simuladas: no se realiza ningún cobro.
          </footer>
        </CompareProvider>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
