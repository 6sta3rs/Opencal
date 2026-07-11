"use client";

import { useMemo, useState } from "react";
import { PlannerSidebar } from "@/components/sidebar/PlannerSidebar";
import { PlannerGrid } from "@/components/planner/PlannerGrid";
import { AddBlockButton } from "@/components/planner/AddBlockButton";
import { BLOCK_TYPES } from "@/lib/sidebar";
import type { PlannerBlock } from "@/lib/planner-grid";
import type { AvailabilityDay } from "@/lib/availability";

// Kompozycja strony głównej: nagłówek w stylu Cal.com (tytuł + data + akcja)
// nad kolumnami sidebar/grid. Trzyma stan filtrów widoczności typów bloków i
// dzieli go między PlannerSidebar (checkboxy) a PlannerGrid (co faktycznie
// renderuje) — PlannerGrid sam nie filtruje, dostaje już przefiltrowaną tablicę.
export function PlannerPage({
  blocks,
  availability,
}: {
  blocks: PlannerBlock[];
  availability?: AvailabilityDay[];
}) {
  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(() => new Set(BLOCK_TYPES));

  function toggleType(type: string) {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  const filteredBlocks = useMemo(
    () => blocks.filter((b) => visibleTypes.has(b.type)),
    [blocks, visibleTypes],
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
        <PlannerSidebar blocks={blocks} visibleTypes={visibleTypes} onToggleType={toggleType} />
        <main className="flex-1 overflow-hidden">
          <PlannerGrid blocks={filteredBlocks} availability={availability} />
        </main>
      </div>
    </div>
  );
}
