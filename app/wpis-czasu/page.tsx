import { EarningsPanel } from "@/components/earnings/EarningsPanel";

// Samodzielna strona z nagłówkiem w stylu Cal.com (tytuł + opis) nad panelem.
export default function WpisCzasuPage() {
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <header className="shrink-0 border-b border-border px-6 py-4">
        <h1 className="text-h2 font-h2 font-semibold text-text-primary">Wpis czasu</h1>
        <p className="text-body text-text-secondary">Zarejestruj przepracowany czas i policz zarobki.</p>
      </header>
      <main className="flex flex-1 items-start justify-center p-8">
        <EarningsPanel />
      </main>
    </div>
  );
}
