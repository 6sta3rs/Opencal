"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  BOUNDARY_LABELS_STORAGE_KEY,
  NOW_LINE_STORAGE_KEY,
  type BoundaryLabelMode,
} from "@/lib/planner-grid";

// Fix 7: strona ustawień — na razie tylko dwa przełączniki, które wcześniej
// mieszkały w toolbarze plannera (Linia teraz, Znaczniki), przeniesione tu
// bo user zgłosił, że zaśmiecały pasek narzędzi nie-częstymi kontrolkami.
// Ten sam wzorzec odczytu/zapisu localStorage co PlannerGrid (mounted-effect
// czyta zapisany stan, handlery piszą od razu przy zmianie) — PlannerGrid
// dalej samo czyta te same klucze przy swoim montażu, więc zmiana tutaj
// jest widoczna po powrocie na Planner (nawigacja między trasami = nowy
// montaż komponentu strony). Struktura sekcji ("Kalendarz") zostawia miejsce
// na przyszłe ustawienia per-etykieta bez zgadywania ich kształtu teraz
// (YAGNI — nie dodajemy niczego poza tymi dwoma istniejącymi).
export default function UstawieniaPage() {
  const [showNowLine, setShowNowLine] = useState(true);
  const [boundaryLabelMode, setBoundaryLabelMode] = useState<BoundaryLabelMode>("all");

  useEffect(() => {
    const savedShowNowLine = localStorage.getItem(NOW_LINE_STORAGE_KEY);
    if (savedShowNowLine === "false") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- odczyt localStorage możliwy dopiero po montażu (jak w PlannerGrid)
      setShowNowLine(false);
    }
    const savedMode = localStorage.getItem(BOUNDARY_LABELS_STORAGE_KEY);
    if (savedMode === "all" || savedMode === "outer") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- jak wyżej
      setBoundaryLabelMode(savedMode);
    }
  }, []);

  function handleNowLineChange(next: boolean) {
    setShowNowLine(next);
    localStorage.setItem(NOW_LINE_STORAGE_KEY, String(next));
  }

  function handleBoundaryLabelModeChange(next: BoundaryLabelMode) {
    setBoundaryLabelMode(next);
    localStorage.setItem(BOUNDARY_LABELS_STORAGE_KEY, next);
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-6 py-4">
        {/* Fix 1: ten sam wariant/wymiary co "Wróć" w PlannerSidebar (kwadratowy
            przycisk ikon-only, h-8!/w-8!/min-h-8 pas bezpieczeństwa) — tu
            wraca na planner (/), nie zamyka widoku edycji. */}
        <Link href="/">
          <Button type="button" size="icon" variant="outline" className="h-8! w-8! min-h-8" aria-label="Wróć do plannera">
            <ArrowLeft aria-hidden />
          </Button>
        </Link>
        <div>
          <h1 className="text-h2 font-h2 font-semibold text-text-primary">Ustawienia</h1>
          <p className="text-body text-text-secondary">Dostosuj zachowanie plannera.</p>
        </div>
      </header>
      <main className="flex flex-1 justify-center p-8">
        <div className="w-full max-w-md">
          <section>
            <h2 className="text-h3 font-h3 font-semibold text-text-primary">Kalendarz</h2>

            <div className="mt-4 flex items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <div className="text-body text-text-primary">Linia teraz</div>
                <div className="text-caption font-caption text-text-secondary">
                  Pokazuje bieżącą godzinę na siatce plannera.
                </div>
              </div>
              <Switch
                checked={showNowLine}
                onCheckedChange={handleNowLineChange}
                aria-label="Linia teraz"
              />
            </div>

            <div className="mt-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-body text-text-primary">Znaczniki granic</div>
                <div className="text-caption font-caption text-text-secondary">
                  Ile godzin dostaje etykietę przy liniach prowadzących wyfokusowanej karty.
                </div>
              </div>
              <div className="flex items-center gap-1 rounded-sm border border-border p-0.5">
                <Button
                  type="button"
                  size="sm"
                  variant={boundaryLabelMode === "all" ? "default" : "ghost"}
                  aria-pressed={boundaryLabelMode === "all"}
                  onClick={() => handleBoundaryLabelModeChange("all")}
                >
                  Wszystkie
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={boundaryLabelMode === "outer" ? "default" : "ghost"}
                  aria-pressed={boundaryLabelMode === "outer"}
                  onClick={() => handleBoundaryLabelModeChange("outer")}
                >
                  Skrajne
                </Button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
