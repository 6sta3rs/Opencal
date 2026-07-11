import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

// DESIGN.md przewiduje Inter wszędzie (typography.*.fontFamily) — zastępuje
// Geist Sans dodany przez `shadcn init`. --font-sans to nazwa zmiennej, którą
// Tailwind 4 (`@theme inline`) w app/globals.css oczekuje dla `font-sans`.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kalendarz",
  description: "Inteligentny kalendarz zmianowy",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" className={`${inter.variable} ${geistMono.variable} h-full antialiased`}>
      {/* h-dvh + overflow-hidden: AppShell jest stały, sidebar i planner mają
          własny, niezależny scroll (DESIGN.md, sekcja Layout) zamiast scrolla
          całej strony. Jeden, stały motyw ciemny (AGENTS.md) — bez klasy .dark,
          tokeny z DESIGN.md są domyślne w :root (app/globals.css). */}
      <body className="flex h-dvh flex-col overflow-hidden bg-bg-primary text-text-primary">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
