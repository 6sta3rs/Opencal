"use client";

import { useCallback, useMemo, useOptimistic, useRef, useState } from "react";
import { PlannerSidebar } from "@/components/sidebar/PlannerSidebar";
import { PlannerGrid, type FocusedBlockPayload } from "@/components/planner/PlannerGrid";
import { AddBlockButton } from "@/components/planner/AddBlockButton";
import { BLOCK_TYPES } from "@/lib/sidebar";
import { applyBlocksAction, type PlannerBlock, type RecurrenceFilter } from "@/lib/planner-grid";
import type { AvailabilityDay } from "@/lib/availability";

// Kompozycja strony głównej: nagłówek w stylu Cal.com (tytuł + data + akcja)
// nad kolumnami sidebar/grid. Trzyma stan filtrów widoczności typów bloków i
// dzieli go między PlannerSidebar (checkboxy) a PlannerGrid (co faktycznie
// renderuje) — PlannerGrid sam nie filtruje, dostaje już przefiltrowaną tablicę.
// Zmiana 6: useOptimistic(blocks, applyBlocksAction) mieszka tutaj (wspólny
// rodzic PlannerGrid i PlannerSidebar) — obie strony mutacji (drag/resize na
// siatce, PATCH/DELETE z BlockEditForm w sidebarze) dzielą jeden dispatcher.
// Zmiana 1: stan wyfokusowanego bloku (klucz segmentu do linii prowadzących +
// rozwiązany blok/zakresy do edit view w sidebarze) też tutaj — PlannerGrid
// zgłasza zmiany przez callbacki, PlannerSidebar czyta wynik i może go wyczyścić.
export function PlannerPage({
  blocks,
  availability,
}: {
  blocks: PlannerBlock[];
  availability?: AvailabilityDay[];
}) {
  const [optimisticBlocks, applyOptimistic] = useOptimistic(blocks, applyBlocksAction);
  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(() => new Set(BLOCK_TYPES));
  const [visibleRecurrence, setVisibleRecurrence] = useState<Set<RecurrenceFilter>>(
    () => new Set<RecurrenceFilter>(["recurring", "oneoff"]),
  );
  const [focusedSegment, setFocusedSegment] = useState<string | null>(null);
  const [focusedBlock, setFocusedBlock] = useState<FocusedBlockPayload | null>(null);
  // Fix 5: sidebar fetchuje backlog RAZ na montaż (useEffect z [] deps) — po
  // udanym drop-na-siatkę backlog item znika z GET domyślnego (scheduledStart
  // ustawiony), ale sidebar o tym nie wie bez ponownego fetchu. Licznik w
  // deps sidebara + bump stąd (przez PlannerGrid) to najmniejszy diff, który
  // to wymusza — bez zdarzeń window ani zmiany kształtu danych.
  const [backlogVersion, setBacklogVersion] = useState(0);
  const bumpBacklogVersion = useCallback(() => setBacklogVersion((v) => v + 1), []);
  // Fix 2a: podgląd na żywo — pola wpisywane w BlockEditForm PRZED Zapisz,
  // nakładane na wyfokusowany blok tylko do WYŚWIETLENIA na siatce (nigdy do
  // useOptimistic, które i tak cofa się poza transition — patrz komentarz w
  // BlockEditForm). Czyszczone przy zapisie/usunięciu/zmianie focusa/powrocie.
  const [draftPatch, setDraftPatch] = useState<Partial<PlannerBlock> | null>(null);
  // Śledzi id ostatnio wyfokusowanego bloku, żeby odróżnić "ten sam blok, ale
  // focusedBlockPayload przeliczył się bo draftPatch zmienił siatkę" (NIE
  // czyścimy draftu) od prawdziwej zmiany focusa na inną kartę (czyścimy).
  const prevFocusedBlockIdRef = useRef<string | null>(null);

  function toggleType(type: string) {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function toggleRecurrence(kind: RecurrenceFilter) {
    setVisibleRecurrence((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  // useCallback (ref stabilny): bez tego PlannerGrid's effect (patrz
  // onFocusedBlockChange tam) miałby ten prop jako nową referencję przy
  // każdym renderze PlannerPage, co odpalałoby efekt bez potrzeby.
  const handleFocusedBlockChange = useCallback((payload: FocusedBlockPayload | null) => {
    setFocusedBlock(payload);
    const nextId = payload?.block.id ?? null;
    // Fix 2a: draft czyszczony tylko gdy focus faktycznie przeskoczył na
    // inny blok (albo zniknął) — payload przelicza się też przy KAŻDEJ
    // zmianie draftPatch (bo ten nakłada się na blocks -> segmentsByDay ->
    // focusedBlockPayload w PlannerGrid), a to NIE jest zmiana focusa.
    if (nextId !== prevFocusedBlockIdRef.current) {
      setDraftPatch(null);
    }
    prevFocusedBlockIdRef.current = nextId;
  }, []);

  // Zmiana 2: strzałka "wstecz" w sidebarze woła to samo — czyści OBA stany
  // od razu (nie czeka na round-trip przez PlannerGrid), żeby dashed lines na
  // siatce i edit view w sidebarze znikały w tym samym renderze. Fix 2a:
  // czyści też draftPatch (idem po Zapisz/Usuń, patrz onSaved/onDeleted w
  // BlockEditForm — oba wołają to samo przez PlannerSidebar).
  const clearFocus = useCallback(() => {
    setFocusedSegment(null);
    setFocusedBlock(null);
    setDraftPatch(null);
  }, []);

  const focusedBlockId = focusedBlock?.block.id ?? null;

  // Fix 2a: podgląd na siatce PRZED Zapisz — draftPatch nakłada się TYLKO na
  // wyfokusowany blok, tylko do wyświetlenia (PlannerGrid), nigdy do
  // useOptimistic. Filtrowanie (poniżej) działa NAD tym wynikiem, żeby podgląd
  // zmiany typu bloku od razu respektował filtr widoczności typów.
  const displayBlocks = useMemo(
    () =>
      draftPatch && focusedBlockId
        ? optimisticBlocks.map((b) => (b.id === focusedBlockId ? { ...b, ...draftPatch } : b))
        : optimisticBlocks,
    [optimisticBlocks, draftPatch, focusedBlockId],
  );

  const filteredBlocks = useMemo(
    () =>
      displayBlocks.filter(
        (b) => visibleTypes.has(b.type) && visibleRecurrence.has(b.startDate ? "oneoff" : "recurring"),
      ),
    [displayBlocks, visibleTypes, visibleRecurrence],
  );

  const dateLabel = new Date().toLocaleDateString("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-h2 font-h2 font-semibold text-text-primary">Planner</h1>
          <p className="text-body text-text-secondary capitalize">{dateLabel}</p>
        </div>
        <AddBlockButton />
      </header>
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-hidden">
          <PlannerGrid
            blocks={filteredBlocks}
            availability={availability}
            applyOptimistic={applyOptimistic}
            focusedSegment={focusedSegment}
            onFocusedSegmentChange={setFocusedSegment}
            onFocusedBlockChange={handleFocusedBlockChange}
            onBacklogScheduled={bumpBacklogVersion}
          />
        </main>
        <PlannerSidebar
          blocks={optimisticBlocks}
          visibleTypes={visibleTypes}
          onToggleType={toggleType}
          visibleRecurrence={visibleRecurrence}
          onToggleRecurrence={toggleRecurrence}
          focusedBlock={focusedBlock}
          applyOptimistic={applyOptimistic}
          onCloseFocus={clearFocus}
          onDraftChange={setDraftPatch}
          backlogVersion={backlogVersion}
        />
      </div>
    </div>
  );
}
