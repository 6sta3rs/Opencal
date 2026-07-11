"use client";

import { useEffect, useMemo, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { BLOCK_TYPES, findNearestShift, formatBlockHours } from "@/lib/sidebar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { PlannerBlock } from "@/lib/planner-grid";

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
}: {
  blocks: PlannerBlock[];
  visibleTypes: Set<string>;
  onToggleType: (type: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [backlog, setBacklog] = useState<BacklogItem[]>([]);

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
  }, []);

  const nearestShift = useMemo(() => findNearestShift(blocks, new Date()), [blocks]);

  return (
    <aside
      className={`${RESIZE_TRANSITION} shrink-0 overflow-y-auto border-r border-border bg-bg-secondary ${
        collapsed ? "w-12" : "w-72"
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

      <div className="flex items-center justify-end p-2">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Pokaż panel boczny" : "Schowaj panel boczny"}
          aria-expanded={!collapsed}
          className="rounded-sm border border-border p-1 text-text-secondary hover:text-text-primary"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" aria-hidden /> : <PanelLeftClose className="h-4 w-4" aria-hidden />}
        </button>
      </div>

      {!collapsed && (
        <div className="flex flex-col">
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
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}
    </aside>
  );
}
