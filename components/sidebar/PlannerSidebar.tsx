"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, PanelRightClose, PanelRightOpen } from "lucide-react";
import { BLOCK_TYPES, findNearestShift, formatBlockHours, weeklyHoursByType } from "@/lib/sidebar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { BlockEditForm } from "@/components/planner/BlockEditForm";
import type { FocusedBlockPayload } from "@/components/planner/PlannerGrid";
import { formatBufferLabel, type BlocksAction, type PlannerBlock, type RecurrenceFilter } from "@/lib/planner-grid";

// ponytail: transitions-dev card-resize snippet expects a shared :root block
// in globals.css (--resize-dur/--resize-ease), ale globals.css jest poza moim
// zakresem plików w tym tickecie (edytują go równolegle inne tickety UI).
// Zamiast ryzykować konflikt, używam Tailwind z dokładnie tymi samymi
// wartościami (300ms, cubic-bezier(0.22,1,0.36,1)) + natywny wariant
// motion-reduce (odpowiednik @media prefers-reduced-motion:reduce) dla
// jedynej animacji, która wciąż jest tu ręczna: szerokość/wysokość <aside>
// przy zwijaniu całego panelu (osobne od akordeonu sekcji, patrz niżej).
const RESIZE_TRANSITION =
  "transition-[height,width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";

const TYPE_LABELS: Record<string, string> = {
  work: "Praca",
  course: "Kurs",
  personal: "Prywatne",
  overnight: "Nocleg",
};

const TYPE_ACCENT_CLASS: Record<string, string> = {
  work: "border-l-work-block",
  course: "border-l-course-block",
  personal: "border-l-personal-block",
  overnight: "border-l-overnight-block",
};

const TYPE_DOT_CLASS: Record<string, string> = {
  work: "bg-work-block",
  course: "bg-course-block",
  personal: "bg-personal-block",
  overnight: "bg-overnight-block",
};

// Kolor kropki priorytetu backlogu. `medium` był wcześniej `bg-primary`, czyli
// niemal białym akcentem primary CTA (patrz DESIGN.md: primary zarezerwowany
// dla głównej akcji) — zamieniony na course-block (bursztyn), bo to jedyny
// "środkowy" kolor w palecie, którego nigdzie indziej nie używamy do priorytetu.
const PRIORITY_DOT_CLASS: Record<string, string> = {
  high: "bg-danger",
  medium: "bg-course-block",
  low: "bg-text-secondary",
};

type BacklogItem = {
  id: string;
  name: string;
  durationMinutes: number;
  priority: string;
};

/** "16h" albo "3,5h" — jak lib/sidebar.ts#formatBlockHours, ale z gotową liczbą godzin zamiast pary HH:MM. */
function formatHoursNumber(hours: number): string {
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1).replace(".", ",")}h`;
}

function formatShiftLabel(shift: { start: Date; end: Date }): string {
  const dayLabel = shift.start.toLocaleDateString("pl-PL", { weekday: "short", day: "numeric", month: "numeric" });
  const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${dayLabel}, ${hhmm(shift.start)}–${hhmm(shift.end)}`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-caption font-caption text-text-secondary">{children}</span>;
}

export function PlannerSidebar({
  blocks,
  visibleTypes,
  onToggleType,
  visibleRecurrence,
  onToggleRecurrence,
  focusedBlock,
  applyOptimistic,
  onCloseFocus,
  onDraftChange,
  backlogVersion,
}: {
  blocks: PlannerBlock[];
  visibleTypes: Set<string>;
  onToggleType: (type: string) => void;
  visibleRecurrence: Set<RecurrenceFilter>;
  onToggleRecurrence: (kind: RecurrenceFilter) => void;
  // Zmiana 1: gdy nie-null, sidebar pokazuje edit view (nagłówek + BlockEditForm)
  // zamiast zwykłej zawartości (statystyki/najbliższa zmiana/accordion).
  focusedBlock: FocusedBlockPayload | null;
  applyOptimistic: (action: BlocksAction) => void;
  onCloseFocus: () => void;
  /** Fix 2a: przekazywany wprost do BlockEditForm — patrz tam. */
  onDraftChange: (patch: Partial<PlannerBlock>) => void;
  /** Fix 5: rośnie w PlannerPage po udanym drop-na-siatkę z backlogu — w deps
   * poniższego fetchu, żeby lista odświeżyła się (zaplanowana pozycja znika
   * z domyślnego GET). */
  backlogVersion: number;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [backlog, setBacklog] = useState<BacklogItem[]>([]);
  const isEditing = !!focusedBlock;
  // Auto-rozwinięcie: klik na blok w gridzie ma pokazać edit view, nawet gdy
  // panel był wcześniej zwinięty — collapsed sam w sobie zostaje nietknięty
  // (po powrocie/zamknięciu wraca do poprzedniego stanu).
  const effectiveCollapsed = collapsed && !isEditing;

  // Fix 4: szerokość TEGO panelu jako CSS custom property na :root — jedyny
  // kanał, przez który globalny ChatWidget (montowany w AppShell, poza
  // drzewem plannera) może offsetować swoją pozycję "fixed" tak, żeby nigdy
  // nie nachodzić na sidebar, w obu stanach (collapsed/expanded), bez
  // przenoszenia dymka do drzewa plannera (zniknąłby wtedy z innych stron —
  // patrz komentarz w ChatWidget.tsx). Usuwane przy odmontowaniu (strony bez
  // tego sidebara wracają do domyślnego offsetu w ChatWidget.module.css).
  useEffect(() => {
    document.documentElement.style.setProperty("--planner-sidebar-w", effectiveCollapsed ? "3rem" : "18rem");
    return () => {
      document.documentElement.style.removeProperty("--planner-sidebar-w");
    };
  }, [effectiveCollapsed]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/backlog")
      .then((res) => res.json())
      .then((items) => {
        if (!cancelled) setBacklog(items);
      })
      // ponytail: brak toastów/retry — błąd fetchowania backlogu po prostu
      // zostawia listę pustą, nic w tickecie nie wymaga obsługi błędów tutaj.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Fix 5: backlogVersion celowo w deps — bump z PlannerGrid po udanym
    // drop-na-siatkę wymusza ponowny fetch (bez tego lista pokazywałaby
    // zaplanowaną pozycję, aż do pełnego przeładowania strony).
  }, [backlogVersion]);

  const nearestShift = useMemo(() => findNearestShift(blocks, new Date()), [blocks]);
  const hoursByType = useMemo(() => weeklyHoursByType(blocks, new Date()), [blocks]);
  const totalWeeklyHours = useMemo(
    () => Object.values(hoursByType).reduce((sum, h) => sum + h, 0),
    [hoursByType],
  );

  return (
    <aside
      data-planner-sidebar
      className={`${RESIZE_TRANSITION} shrink-0 overflow-y-auto border-l border-border bg-bg-secondary ${
        effectiveCollapsed ? "w-12" : "w-72"
      }`}
    >
      {/* Akordeon shadcn (base-ui) animuje panele domyślnie przez
          tw-animate-css (animate-accordion-down/up), ale ten pakiet nie ma
          własnej osłony prefers-reduced-motion. components/ui/accordion.tsx
          to primitywa shadcn poza moim zakresem plików (nie edytuję), więc
          osłonę dokładam tu, celując w jego atrybut data-slot — działa
          globalnie dla każdego akordeonu w apce, co i tak jest pożądane. */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          [data-slot="accordion-content"] { animation: none !important; }
        }
      `}</style>

      {/* Fix 4: widok edycji dostaje WŁASNY nagłówek ze strzałką powrotu w
          LEWYM górnym rogu (ten sam wariant/rozmiar ikon-only co Poprzedni/
          Następny w toolbarze plannera — patrz PlannerGrid) — osobny slot od
          przełącznika schowaj/pokaż poniżej, który zostaje w prawym górnym
          rogu wyłącznie w widoku idle (te dwa widoki się wykluczają, więc
          nigdy nie renderują się jednocześnie, ale już nie dzielą jednego rogu). */}
      {isEditing ? (
        <div className="flex items-center justify-start p-2">
          {/* h-8!/w-8!/min-h-8: pas bezpieczeństwa na 32x32 (jak Poprzedni/
              Następny). W panelu podglądu przeglądarki przycisk mierzył 32x28
              mimo identycznych klas co przyciski nawigacji — najpewniej
              artefakt środowiska (inline styles są tam globalnie ignorowane,
              więc nie dało się tego zdiagnozować do końca); min-h-8 dodatkowo
              chroni przed ściskaniem przez flexbox. */}
          <Button type="button" size="icon" variant="outline" className="h-8! w-8! min-h-8" onClick={onCloseFocus} aria-label="Wróć">
            <ArrowLeft aria-hidden />
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-start p-2">
          {/* Ten sam wariant/wymiary co "Wróć" wyżej i Poprzedni/Następny w
              toolbarze (decyzja użytkownika 2026-07-11: kwadratowy przycisk
              ikonowy, po LEWEJ stronie panelu) — łącznie z pasem bezpieczeństwa
              h-8!/w-8!/min-h-8, patrz komentarz przy "Wróć". */}
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-8! w-8! min-h-8"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Pokaż panel boczny" : "Schowaj panel boczny"}
            aria-expanded={!collapsed}
          >
            {collapsed ? <PanelRightOpen aria-hidden /> : <PanelRightClose aria-hidden />}
          </Button>
        </div>
      )}

      {!effectiveCollapsed && isEditing && focusedBlock && (
        <div className="flex flex-col gap-3 p-4">
          <div>
            <div className="text-body font-medium text-text-primary">{focusedBlock.block.name}</div>
            <div className="tabular-nums text-caption font-caption text-text-secondary">
              {TYPE_LABELS[focusedBlock.block.type] ?? focusedBlock.block.type} · {focusedBlock.block.startTime}–
              {focusedBlock.block.endTime}
            </div>
            {/* Fix (etykiety buforu, format podpisany): ten sam
                formatBufferLabel co karty na siatce (PlannerGrid#BlockCard) —
                obie powierzchnie mają teraz zgodną konwencję ("−20 min ·
                08:40"). Godzina graniczna wyciągnięta z już policzonego
                beforeRangeLabel/afterRangeLabel ("start–end") zamiast
                dokładać nowe pole do FocusedBlockPayload — before: pierwszy
                człon (start strefy), after: drugi człon (koniec strefy).
                Dokładny zakres zostaje w nawiasie obok (mieści się, sidebar
                ma pełną szerokość panelu). */}
            {(focusedBlock.beforeRangeLabel || focusedBlock.afterRangeLabel) && (
              <div className="mt-2 flex flex-col gap-0.5 border-t border-border pt-2 text-caption font-caption text-text-secondary">
                {focusedBlock.beforeRangeLabel && (
                  <div className="tabular-nums">
                    {formatBufferLabel(
                      "before",
                      focusedBlock.beforeZoneMinutes,
                      focusedBlock.beforeRangeLabel.split("–")[0],
                      "full",
                    )}{" "}
                    ({focusedBlock.beforeRangeLabel})
                  </div>
                )}
                {focusedBlock.afterRangeLabel && (
                  <div className="tabular-nums">
                    {formatBufferLabel(
                      "after",
                      focusedBlock.afterZoneMinutes,
                      focusedBlock.afterRangeLabel.split("–")[1],
                      "full",
                    )}{" "}
                    ({focusedBlock.afterRangeLabel})
                  </div>
                )}
              </div>
            )}
            {focusedBlock.block.note && (
              <p className="mt-2 border-t border-border pt-2 text-body text-text-secondary">{focusedBlock.block.note}</p>
            )}
          </div>
          {/* Fix 1: key={block.id} wymusza remount BlockEditForm przy zmianie
              wyfokusowanego bloku — bez tego jego useState(() =>
              formStateFromBlock(block)) inicjalizuje się RAZ i zostaje przy
              danych pierwszej karty nawet po kliknięciu innej. */}
          <BlockEditForm
            key={focusedBlock.block.id}
            block={focusedBlock.block}
            onSaved={onCloseFocus}
            onDeleted={onCloseFocus}
            onDraftChange={onDraftChange}
            applyOptimistic={applyOptimistic}
          />
        </div>
      )}

      {!effectiveCollapsed && !isEditing && (
        <div className="flex flex-col">
          {/* Statystyki tygodnia — jak "Najbliższa zmiana" niżej, zawsze
              widoczna, bez akordeonu. Pasek to plain divy z width:% (bez
              biblioteki wykresów, ponytail — to trywialny stacked bar). */}
          <section className="border-b border-border p-4">
            <SectionLabel>Statystyki tygodnia</SectionLabel>
            {totalWeeklyHours > 0 ? (
              <>
                <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-bg-primary">
                  {BLOCK_TYPES.map(
                    (type) =>
                      hoursByType[type] > 0 && (
                        <div
                          key={type}
                          className={TYPE_DOT_CLASS[type]}
                          style={{ width: `${(hoursByType[type] / totalWeeklyHours) * 100}%` }}
                        />
                      ),
                  )}
                </div>
                <ul className="mt-2 flex flex-col gap-1">
                  {BLOCK_TYPES.map(
                    (type) =>
                      hoursByType[type] > 0 && (
                        <li key={type} className="flex items-center gap-2 text-body text-text-primary">
                          <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${TYPE_DOT_CLASS[type]}`} />
                          <span className="flex-1">{TYPE_LABELS[type]}</span>
                          <span className="tabular-nums text-caption font-caption text-text-secondary">
                            {formatHoursNumber(hoursByType[type])}
                          </span>
                        </li>
                      ),
                  )}
                </ul>
                {/* ponytail: wolne godziny w tygodniu wymagałyby pełnego
                    gap-finding (bufory, dostępność) nieproporcjonalnego do tej
                    sekcji — pomijamy, wracamy gdyby stało się to potrzebne. */}
              </>
            ) : (
              <p className="mt-2 text-body text-text-secondary">Brak zaplanowanych godzin w tym tygodniu</p>
            )}
          </section>

          {/* Najbliższa zmiana — jedyna sekcja bez akordeonu, zawsze widoczna. */}
          <section className="border-b border-border p-4">
            <SectionLabel>Najbliższa zmiana</SectionLabel>
            {nearestShift ? (
              <div className={`mt-2 rounded-sm border-l-[3px] bg-bg-primary px-2 py-1 ${TYPE_ACCENT_CLASS[nearestShift.type] ?? "border-l-text-secondary"}`}>
                <div className="text-body font-medium text-text-primary">{nearestShift.name}</div>
                <div className="tabular-nums text-caption font-caption text-text-secondary">
                  {formatShiftLabel(nearestShift)}
                </div>
              </div>
            ) : (
              <p className="mt-2 text-body text-text-secondary">Brak nadchodzących zmian</p>
            )}
          </section>

          <Accordion multiple defaultValue={["blocks", "backlog", "filters"]}>
            <AccordionItem value="blocks">
              <AccordionTrigger className="px-4">
                <span className="flex items-center gap-2">
                  <SectionLabel>Bloki cykliczne</SectionLabel>
                  <Badge variant="outline" className="tabular-nums">
                    {blocks.length}
                  </Badge>
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                {blocks.length === 0 ? (
                  <p className="text-body text-text-secondary">Brak bloków</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {blocks.map((block) => (
                      <li
                        key={block.id}
                        className={`rounded-sm border-l-[3px] bg-bg-primary px-2 py-1 ${
                          block.staysOvernight ? "border-l-overnight-block" : (TYPE_ACCENT_CLASS[block.type] ?? "border-l-text-secondary")
                        } ${block.isPaused ? "opacity-50" : ""}`}
                      >
                        <div className="text-body text-text-primary">{block.name}</div>
                        <div className="tabular-nums text-caption font-caption text-text-secondary">
                          {TYPE_LABELS[block.type] ?? block.type} · {formatBlockHours(block.startTime, block.endTime)}
                          {block.staysOvernight ? " · Nocleg" : ""}
                          {block.isPaused ? " · Wstrzymany" : ""}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="backlog">
              <AccordionTrigger className="px-4">
                <span className="flex items-center gap-2">
                  <SectionLabel>Do zaplanowania</SectionLabel>
                  <Badge variant="outline" className="tabular-nums">
                    {backlog.length}
                  </Badge>
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                {backlog.length === 0 ? (
                  <p className="text-body text-text-secondary">Brak pozycji</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {backlog.map((item) => (
                      <li
                        key={item.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData(
                            "application/json",
                            JSON.stringify({ id: item.id, name: item.name, durationMinutes: item.durationMinutes }),
                          );
                          e.dataTransfer.effectAllowed = "copy";
                        }}
                        className="cursor-grab rounded-sm bg-bg-primary px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT_CLASS[item.priority] ?? "bg-text-secondary"}`}
                          />
                          <span className="text-body text-text-primary">{item.name}</span>
                        </div>
                        <div className="tabular-nums text-caption font-caption text-text-secondary">
                          {item.durationMinutes} min
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="filters">
              <AccordionTrigger className="px-4">
                <SectionLabel>Filtry</SectionLabel>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <ul className="flex flex-col gap-2">
                  {BLOCK_TYPES.map((type) => (
                    <li key={type}>
                      <label className="flex items-center gap-2 text-body text-text-primary">
                        <Checkbox
                          checked={visibleTypes.has(type)}
                          onCheckedChange={() => onToggleType(type)}
                        />
                        <span aria-hidden className={`h-2 w-2 rounded-full ${TYPE_DOT_CLASS[type]}`} />
                        {TYPE_LABELS[type]}
                      </label>
                    </li>
                  ))}
                </ul>
                {/* Zmiana 4: cykliczne/jednorazowe — ten sam checkbox-per-opcja
                    wzorzec co filtr typów wyżej, osobny Set zamiast rozszerzania
                    visibleTypes (inna oś filtrowania, patrz PlannerPage#filteredBlocks). */}
                <ul className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                  <li>
                    <label className="flex items-center gap-2 text-body text-text-primary">
                      <Checkbox
                        checked={visibleRecurrence.has("recurring")}
                        onCheckedChange={() => onToggleRecurrence("recurring")}
                      />
                      Cykliczne
                    </label>
                  </li>
                  <li>
                    <label className="flex items-center gap-2 text-body text-text-primary">
                      <Checkbox
                        checked={visibleRecurrence.has("oneoff")}
                        onCheckedChange={() => onToggleRecurrence("oneoff")}
                      />
                      Jednorazowe
                    </label>
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}
    </aside>
  );
}
