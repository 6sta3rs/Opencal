import { AvailabilityForm } from "@/components/availability/AvailabilityForm";

// Strona z nagłówkiem w stylu Cal.com (tytuł + opis) nad formularzem godzin pracy.
export default function DostepnoscPage() {
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <header className="shrink-0 border-b border-border px-6 py-4">
        <h1 className="text-h2 font-h2 font-semibold text-text-primary">Dostępność</h1>
        <p className="text-body text-text-secondary">
          Skonfiguruj godziny, w których możliwa jest praca.
        </p>
      </header>
      <main className="flex flex-1 items-start justify-center p-8">
        <AvailabilityForm />
      </main>
    </div>
  );
}
