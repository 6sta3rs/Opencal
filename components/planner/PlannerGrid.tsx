"use client";

import {
  Fragment,
  startTransition,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuickCreatePopover } from "@/components/planner/QuickCreatePopover";
import { EditBlockModal } from "@/components/planner/EditBlockModal";
import {
  applyBlocksAction,
  bufferLabelMode,
  buildBacklogDropBody,
  buildMovePatch,
  buildResizeBlockPatch,
  classifyOverlap,
  computeGridSegments,
  dragRangeToDraft,
  getUnavailableRanges,
  getUnavailableRangesFromAvailability,
  getWeekDays,
  hhmmToMinutes,
  isDayAvailableForCreate,
  isEdgeResizable,
  layoutOverlaps,
  localDateKey,
  minutesToHHMM,
  pixelDeltaToMinutes,
  pixelOffsetToMinutes,
  shiftBlockTime,
  snapMinutes,
  type DragRangeDraft,
  type GridSegment,
  type LaidOutSegment,
  type PlannerBlock,
  type ResizeEdge,
} from "@/lib/planner-grid";
import type { AvailabilityDay } from "@/lib/availability";

const MOVE_DRAG_THRESHOLD_PX = 5;
const ZOOM_STORAGE_KEY = "planner-grid-zoom";
// Fix 4: widoczność linii "teraz" — osobny klucz od zoomu, ten sam wzorzec
// odczytu/zapisu (patrz mounted-effect + handleNowLineToggle niżej).
const NOW_LINE_STORAGE_KEY = "planner-grid-show-now-line";
type Zoom = "1h" | "30min";
const DAY_LABELS = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Niedz"];
// Pasmo martwej strefy nad 00:00 (Cal.com) — poza matematyką czasu, bo leży
// POZA elementem, na którym liczymy rect dla drag/resize (patrz data-grid-body).
const TOP_SPACER_REM = 2;

// ponytail: godziny pracy na sztywno (Pon–Pt 9–17) — do czasu aż stanie się
// ustawieniem użytkownika (patrz docs/harmonogram-i-zarobki.md); wtedy
// przenieś do profilu/configu zamiast stałej modułowej.
const WORKING_HOURS = { days: [1, 2, 3, 4, 5], start: 9, end: 17 };

// Subtelne, szare skośne paski dla godzin poza pracą — świadomie cieńsze i
// mniej nasycone niż akcent koloru noclegu, żeby nie konkurowały wizualnie
// z blokami. Inline zamiast klasy w globals.css — ten plik jest poza
// zakresem edycji dla tego agenta.
const UNAVAILABLE_STRIPE_STYLE = {
  backgroundImage:
    "repeating-linear-gradient(45deg, color-mix(in srgb, var(--color-text-secondary) 18%, transparent) 0 3px, transparent 3px 9px)",
} as const;

// Etykieta tekstowa obok koloru — wymóg WCAG/daltoniści z DESIGN.md, nie
// polegamy wyłącznie na kolorze paska akcentu.
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

// Pastelowe wypełnienie karty (Cal.com-style) + jaśniejszy tekst tego samego
// odcienia — patrz DESIGN.md sekcja Colors / tokeny *-block-bg / *-block-text.
const TYPE_FILL_CLASS: Record<string, string> = {
  work: "bg-work-block-bg text-work-block-text",
  course: "bg-course-block-bg text-course-block-text",
  personal: "bg-personal-block-bg text-personal-block-text",
};

// Sam tekst (bez tła) w odcieniu typu — używany na etykietach "Dojazd"/"Odjazd"
// w strefach kreskowanych (Task A), także na karcie noclegu, gdzie tło jest
// neutralnym przezroczystym odcieniem, nie opaque *-block-bg (patrz BlockCard).
const TYPE_TEXT_CLASS: Record<string, string> = {
  work: "text-work-block-text",
  course: "text-course-block-text",
  personal: "text-personal-block-text",
  overnight: "text-overnight-block-text",
};

// CSS custom property bazowego koloru typu — do inline color-mix przy
// poświacie noclegu (.overnight-glow czyta --glow-color, patrz BlockCard):
// nocleg koloruje się kolorem WŁASNEGO typu bloku, nie stałym fioletem
// (decyzja użytkownika 2026-07-10) — overnight-block zostaje jako fallback
// dla typu spoza tej mapy (patrz DESIGN.md).
const TYPE_COLOR_VAR: Record<string, string> = {
  work: "--color-work-block",
  course: "--color-course-block",
  personal: "--color-personal-block",
  overnight: "--color-overnight-block",
};

/** Minuty od lokalnej północy, np. do pozycjonowania linii "teraz". */
function minutesSinceMidnightNow(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

/** Fix 2: stabilny klucz segmentu (do stanu focusa) — ta sama karta (shift/overnight) tego samego bloku i dnia. */
function segmentFocusKey(segment: GridSegment): string {
  return `${segment.blockId}-${segment.day}-${segment.phase}-${segment.bufferKind ?? ""}`;
}

/** Czy segment "shift" ma sklejony bufor (Dojazd/Odjazd) tego samego bloku tego dnia — patrz BlockCard merge. */
function hasMergedBuffer(segment: GridSegment, daySegments: GridSegment[]): boolean {
  if (segment.phase !== "shift") return false;
  return daySegments.some(
    (s) =>
      s.phase === "buffer" &&
      s.blockId === segment.blockId &&
      (s.endMinutes === segment.startMinutes || s.startMinutes === segment.endMinutes),
  );
}

// Fix 3b: kolejność renderowania w dniu — tło (nocleg/surowy bufor) pierwsze,
// potem scalone karty zmiany (z buforem), zwykłe karty zmiany na końcu (żeby
// wygrały malowanie nad cudzym paskiem dojazdu przy równym z-index).
function segmentSortRank(segment: GridSegment, daySegments: GridSegment[]): number {
  if (segment.phase !== "shift") return 0;
  return hasMergedBuffer(segment, daySegments) ? 1 : 2;
}

function toJsDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/** "YYYY-MM-DD" + minuty od lokalnej północy (może przekraczać 1440 dla "isMidnightCut") -> Date. */
function dateFromDayKeyAndMinutes(dayKey: string, minutes: number): Date {
  const [y, m, d] = dayKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setMinutes(minutes);
  return dt;
}

function nextDayKey(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  return localDateKey(new Date(y, m - 1, d + 1));
}

function formatWeekdayTime(d: Date): string {
  return `${DAY_LABELS[(d.getDay() + 6) % 7]} ${minutesToHHMM(d.getHours() * 60 + d.getMinutes())}`;
}

/**
 * Podpis "od → do" dla PIERWSZEGO segmentu ciągu noclegowego (Fix 2a,
 * użytkownik cofnął wcześniejszą decyzję "bez tekstu") — null dla segmentów
 * kontynuacji (continuesFromPrevDay) i dla faz innych niż "overnight". Koniec
 * to block.departureTime, jeśli ustawiony; inaczej koniec faktycznego ciągu
 * segmentów tego bloku (przechodzimy po dniach przez segmentsByDay, dopóki
 * continuesToNextDay) — pokrywa rzadki przypadek zwykłego zawinięcia przez
 * północ bez jawnego wyjazdu (np. typ "overnight" 21:00–07:00 bez staysOvernight/departureTime).
 */
function computeOvernightCaption(
  segment: GridSegment,
  block: PlannerBlock | undefined,
  segmentsByDay: Map<string, GridSegment[]>,
): string | null {
  if (segment.phase !== "overnight" || segment.continuesFromPrevDay || !block) return null;

  const startDate = dateFromDayKeyAndMinutes(segment.day, segment.startMinutes);

  let endDate: Date;
  if (block.departureTime) {
    endDate = toJsDate(block.departureTime);
  } else {
    let cur = segment;
    while (cur.continuesToNextDay) {
      const next = (segmentsByDay.get(nextDayKey(cur.day)) ?? []).find(
        (s) => s.blockId === segment.blockId && s.phase === "overnight" && s.continuesFromPrevDay,
      );
      if (!next) break;
      cur = next;
    }
    endDate = dateFromDayKeyAndMinutes(cur.day, cur.endMinutes);
  }

  return `${formatWeekdayTime(startDate)} → ${formatWeekdayTime(endDate)}`;
}

type CreateDragState = {
  day: Date;
  dayKey: string;
  rectTop: number;
  rectLeft: number;
  startMinutes: number;
  currentMinutes: number;
};

type MoveDragState = {
  blockId: string;
  sourceDayKey: string;
  fromDay: number;
  pointerId: number;
  startX: number;
  startY: number;
  isDragging: boolean;
  targetDayKey: string | null;
  deltaMinutes: number;
};

type ResizeDragState = {
  blockId: string;
  dayKey: string;
  edge: ResizeEdge;
  pointerId: number;
  rectTop: number;
  currentMinutes: number;
};

export function PlannerGrid({
  blocks,
  availability,
}: {
  blocks: PlannerBlock[];
  availability?: AvailabilityDay[];
}) {
  const router = useRouter();
  // Optimistic overlay nad blocks: mutacje aplikują zmianę natychmiast
  // (applyBlocksAction), a router.refresh() w tej samej transition dostarcza
  // prawdziwy stan serwera — sukces "utrwala" zmianę, błąd (brak refresh)
  // cofa ją automatycznie do bazowego propa po zakończeniu transition.
  const [optimisticBlocks, applyOptimistic] = useOptimistic(blocks, applyBlocksAction);
  const [view, setView] = useState<"day" | "week">("week");
  const [anchor, setAnchor] = useState(() => new Date());
  // null do montażu: pozycja linii "teraz" liczona z zegara różni się między
  // SSR a hydratacją (mismatch), więc linia pojawia się dopiero na kliencie.
  const [now, setNow] = useState<Date | null>(null);
  // SSR/pierwsze renderowanie zawsze "1h" (identyczne z dotychczasowym
  // zachowaniem) — zapisany wybór z localStorage doczytujemy w tym samym
  // useEffect co zegar poniżej, więc nie ma osobnego mismatchu hydratacji.
  const [zoom, setZoom] = useState<Zoom>("1h");
  const hourHeightRem = zoom === "30min" ? 6 : 3;
  const hourHeightPx = hourHeightRem * 16; // zakłada domyślny root font-size 16px
  // Fix 4: domyślnie widoczna (true) — nadpisywana z localStorage w tym samym
  // mounted-effect co zoom, więc SSR i pierwsze renderowanie klienta są zgodne.
  const [showNowLine, setShowNowLine] = useState(true);
  // Fix 2: klucz aktualnie "wyfokusowanego" segmentu (pierwszy klik) — drugi
  // klik na TYM SAMYM segmencie otwiera EditBlockModal (patrz endMoveDrag).
  const [focusedSegmentKey, setFocusedSegmentKey] = useState<string | null>(null);

  const [createDrag, setCreateDrag] = useState<CreateDragState | null>(null);
  const [quickCreate, setQuickCreate] = useState<{ draft: DragRangeDraft; position: { top: number; left: number } } | null>(
    null,
  );
  const [editingBlock, setEditingBlock] = useState<PlannerBlock | null>(null);
  const [moveDrag, setMoveDrag] = useState<MoveDragState | null>(null);
  const moveDragRef = useRef<MoveDragState | null>(null);
  const [resizeDrag, setResizeDrag] = useState<ResizeDragState | null>(null);
  const resizeDragRef = useRef<ResizeDragState | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- odczyt zegara przeglądarki możliwy dopiero po montażu (patrz komentarz przy stanie)
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    const savedZoom = localStorage.getItem(ZOOM_STORAGE_KEY);
    if (savedZoom === "1h" || savedZoom === "30min") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- odczyt localStorage możliwy dopiero po montażu, jak zegar wyżej
      setZoom(savedZoom);
    }
    const savedShowNowLine = localStorage.getItem(NOW_LINE_STORAGE_KEY);
    if (savedShowNowLine === "false") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- jak wyżej
      setShowNowLine(false);
    }
    return () => clearInterval(id);
  }, []);

  function handleZoomChange(next: Zoom) {
    setZoom(next);
    localStorage.setItem(ZOOM_STORAGE_KEY, next);
  }

  function handleNowLineToggle(next: boolean) {
    setShowNowLine(next);
    localStorage.setItem(NOW_LINE_STORAGE_KEY, String(next));
  }

  // Fix 2: klik POZA jakimkolwiek segmentem (albo Escape) czyści focus —
  // klik NA segmencie sam zarządza swoim stanem w endMoveDrag (pierwszy klik
  // ustawia focus, drugi otwiera modal), dlatego tu pomijamy kliknięcia
  // wewnątrz [data-segment-key] zamiast globalnie czyścić przy każdym kliku.
  useEffect(() => {
    if (!focusedSegmentKey) return;
    function handlePointerDown(e: PointerEvent) {
      const target = e.target as HTMLElement | null;
      if (!target?.closest("[data-segment-key]")) setFocusedSegmentKey(null);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setFocusedSegmentKey(null);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [focusedSegmentKey]);

  const blocksById = useMemo(() => new Map(optimisticBlocks.map((b) => [b.id, b])), [optimisticBlocks]);

  const visibleDays = useMemo(() => {
    const week = getWeekDays(anchor);
    return view === "week" ? week : [week.find((d) => localDateKey(d) === localDateKey(anchor)) ?? anchor];
  }, [anchor, view]);

  const rangeStart = visibleDays[0];
  const rangeEnd = visibleDays[visibleDays.length - 1];

  const segmentsByDay = useMemo(() => {
    const segments = computeGridSegments(optimisticBlocks, rangeStart, rangeEnd);
    const byDay = new Map<string, GridSegment[]>();
    for (const seg of segments) {
      const list = byDay.get(seg.day) ?? [];
      list.push(seg);
      byDay.set(seg.day, list);
    }
    const laidOut = new Map<string, LaidOutSegment[]>();
    for (const [day, daySegments] of byDay) {
      laidOut.set(day, layoutOverlaps(daySegments));
    }
    return laidOut;
  }, [optimisticBlocks, rangeStart, rangeEnd]);

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const todayKey = localDateKey(now ?? new Date());
  const nowTop = now === null ? null : (minutesSinceMidnightNow(now) / 1440) * 100;

  function shiftDays(delta: number) {
    setAnchor((d) => {
      const next = new Date(d);
      next.setDate(next.getDate() + delta);
      return next;
    });
  }

  function handleGridPointerDown(e: ReactPointerEvent<HTMLDivElement>, day: Date, dayKey: string) {
    if (e.button !== 0) return;
    // Dzień wyłączony w availability blokuje TYLKO tworzenie nowych bloków —
    // istniejące bloki nadal można w niego przeciągnąć (moveMoveDrag/endMoveDrag
    // nie mają analogicznej blokady, patrz isDayAvailableForCreate).
    if (!isDayAvailableForCreate(day, availability)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const minutes = pixelOffsetToMinutes(e.clientY - rect.top, hourHeightPx);
    setCreateDrag({ day, dayKey, rectTop: rect.top, rectLeft: rect.left, startMinutes: minutes, currentMinutes: minutes });
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleGridPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    setCreateDrag((prev) => {
      if (!prev) return prev;
      const minutes = pixelOffsetToMinutes(e.clientY - prev.rectTop, hourHeightPx);
      return { ...prev, currentMinutes: minutes };
    });
  }

  function handleGridPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (!createDrag) return;
    const draft = dragRangeToDraft(createDrag.day, createDrag.startMinutes, createDrag.currentMinutes);
    setQuickCreate({
      draft,
      position: { top: e.clientY - createDrag.rectTop + 8, left: Math.max(0, e.clientX - createDrag.rectLeft - 128) },
    });
    setCreateDrag(null);
  }

  // Drop pozycji backlogu (sidebar) na siatkę — natywne HTML5 drag & drop,
  // niezależne od pointer-event drag-to-create powyżej (osobne drzewo DOM,
  // sidebar nie musi nic wiedzieć o gridzie — dane jadą przez dataTransfer).
  function handleGridDragOver(e: ReactDragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  async function handleGridDrop(e: ReactDragEvent<HTMLDivElement>, day: Date) {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return;
    let item: { id: string; name: string; durationMinutes: number };
    try {
      item = JSON.parse(raw);
    } catch {
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const startMinutes = pixelOffsetToMinutes(e.clientY - rect.top, hourHeightPx);

    // Task D2: osoba nie może robić dwóch rzeczy naraz — drop w miejsce
    // kolidujące z fazą "shift" innego bloku jest po cichu ignorowany (bez
    // optimistic apply, bez POST). Kolizja tylko z buforem (over-buffer)
    // jest dopuszczalna, patrz classifyOverlap.
    const dayKey = localDateKey(day);
    const candidateStart = snapMinutes(startMinutes);
    const candidateEnd = snapMinutes(Math.min(candidateStart + item.durationMinutes, 24 * 60));
    const daySegs = segmentsByDay.get(dayKey) ?? [];
    if (classifyOverlap(daySegs, { startMinutes: candidateStart, endMinutes: candidateEnd }) === "conflict") {
      console.warn("Upuszczenie z backlogu zignorowane: koliduje z inną zmianą");
      return;
    }

    const body = buildBacklogDropBody({ name: item.name, durationMinutes: item.durationMinutes, day, startMinutes });
    const tempBlock: PlannerBlock = {
      id: `optimistic-${item.name}-${Date.now()}`,
      name: body.name,
      type: body.type,
      startTime: body.startTime,
      endTime: body.endTime,
      daysOfWeek: body.daysOfWeek,
      startDate: body.startDate,
      endDate: body.endDate,
    };

    startTransition(async () => {
      applyOptimistic({ kind: "add", block: tempBlock });
      const res = await fetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) router.refresh();
      else console.error("Nie udało się utworzyć bloku z backlogu", res.status);
    });
  }

  function startMoveDrag(e: ReactPointerEvent<HTMLDivElement>, blockId: string, fromDay: number, sourceDayKey: string) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const state: MoveDragState = {
      blockId,
      sourceDayKey,
      fromDay,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      isDragging: false,
      targetDayKey: null,
      deltaMinutes: 0,
    };
    moveDragRef.current = state;
    setMoveDrag(state);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function moveMoveDrag(e: ReactPointerEvent<HTMLDivElement>) {
    const current = moveDragRef.current;
    if (!current) return;
    const dx = e.clientX - current.startX;
    const dy = e.clientY - current.startY;
    const isDragging = current.isDragging || Math.hypot(dx, dy) > MOVE_DRAG_THRESHOLD_PX;
    const targetEl = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-day-key]");
    const next: MoveDragState = {
      ...current,
      isDragging,
      targetDayKey: isDragging ? (targetEl?.dataset.dayKey ?? null) : null,
      deltaMinutes: isDragging ? pixelDeltaToMinutes(dy, hourHeightPx) : 0,
    };
    moveDragRef.current = next;
    setMoveDrag(next);
  }

  async function endMoveDrag(e: ReactPointerEvent<HTMLDivElement>, block: PlannerBlock, segmentKey: string) {
    const current = moveDragRef.current;
    moveDragRef.current = null;
    setMoveDrag(null);
    if (!current) return;

    if (!current.isDragging) {
      // Fix 2: pierwszy klik (bez przeciągnięcia) na segmencie ustawia focus
      // (dashed guide-lines + overlay z pełnymi informacjami, patrz render
      // niżej) zamiast od razu otwierać modal edycji — drugi klik na TYM
      // SAMYM, już wyfokusowanym segmencie dopiero otwiera EditBlockModal.
      if (focusedSegmentKey === segmentKey) {
        setFocusedSegmentKey(null);
        setEditingBlock(block);
      } else {
        setFocusedSegmentKey(segmentKey);
      }
      return;
    }
    const targetDayKey = current.targetDayKey ?? current.sourceDayKey;
    if (targetDayKey === current.sourceDayKey && current.deltaMinutes === 0) return;

    const toDate = visibleDays.find((d) => localDateKey(d) === targetDayKey);
    if (!toDate) return;

    // Task D2: przesunięcie w miejsce kolidujące z fazą "shift" innego bloku
    // po cichu abortuje całą transition — bez optimistic apply blok wraca
    // wizualnie na miejsce (render czyta z powrotem bazowy prop blocks).
    const preview = shiftBlockTime(block, current.deltaMinutes);
    const candidateStart = hhmmToMinutes(preview.startTime);
    const rawEnd = hhmmToMinutes(preview.endTime);
    // ponytail: zawinięcie przez północ liczone jako "do końca doby" tylko na
    // potrzeby TEJ kontroli (nie generuje segmentu dnia następnego jak
    // computeGridSegments) — wystarczające dla wykrycia kolizji w widocznym dniu.
    const candidateEnd = rawEnd <= candidateStart ? 24 * 60 : rawEnd;
    const daySegs = segmentsByDay.get(targetDayKey) ?? [];
    if (
      classifyOverlap(daySegs, { startMinutes: candidateStart, endMinutes: candidateEnd, excludeBlockId: block.id }) ===
      "conflict"
    ) {
      console.warn("Przesunięcie zignorowane: koliduje z inną zmianą");
      return;
    }

    const patch = buildMovePatch(block, current.fromDay, toDate, current.deltaMinutes);
    startTransition(async () => {
      applyOptimistic({ kind: "patch", id: block.id, patch });
      const res = await fetch(`/api/blocks/${block.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) router.refresh();
      else console.error("Nie udało się przesunąć bloku", res.status);
    });
  }

  function startResizeDrag(e: ReactPointerEvent<HTMLDivElement>, blockId: string, dayKey: string, edge: ResizeEdge) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const gridBody = (e.currentTarget as HTMLElement).closest<HTMLElement>("[data-grid-body]");
    if (!gridBody) return;
    const rect = gridBody.getBoundingClientRect();
    const minutes = pixelOffsetToMinutes(e.clientY - rect.top, hourHeightPx);
    const state: ResizeDragState = { blockId, dayKey, edge, pointerId: e.pointerId, rectTop: rect.top, currentMinutes: minutes };
    resizeDragRef.current = state;
    setResizeDrag(state);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function moveResizeDrag(e: ReactPointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    const current = resizeDragRef.current;
    if (!current) return;
    const minutes = pixelOffsetToMinutes(e.clientY - current.rectTop, hourHeightPx);
    const next: ResizeDragState = { ...current, currentMinutes: minutes };
    resizeDragRef.current = next;
    setResizeDrag(next);
  }

  async function endResizeDrag(e: ReactPointerEvent<HTMLDivElement>, block: PlannerBlock) {
    e.stopPropagation();
    const current = resizeDragRef.current;
    resizeDragRef.current = null;
    setResizeDrag(null);
    if (!current) return;

    const patch = buildResizeBlockPatch(block, current.edge, current.currentMinutes);
    const field = current.edge === "start" ? "startTime" : "endTime";
    if (patch[field as keyof typeof patch] === block[field]) return; // brak zmiany — bez zbędnego PATCH

    startTransition(async () => {
      applyOptimistic({ kind: "patch", id: block.id, patch });
      const res = await fetch(`/api/blocks/${block.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) router.refresh();
      else console.error("Nie udało się zmienić rozmiaru bloku", res.status);
    });
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar żyje POZA scrollowanym kontenerem (patrz "overflow-auto"
          niżej na wrapperze kolumny godzin + dni) — wcześniej był jego
          dzieckiem, więc przy poziomym scrollu (siatka szersza niż viewport
          na małych ekranach, patrz min-w-32 * 7 dni) toolbar przesuwał się w
          bok razem z contentem (sticky domyślnie trzyma tylko oś, na której
          jest ustawiony — tu tylko "top", nigdy nie było "left"). Bycie poza
          kontenerem scrolla eliminuje to bez potrzeby sticky/z-index tutaj. */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-bg-secondary px-4 py-2">
        <Button type="button" variant="outline" size="icon" onClick={() => shiftDays(view === "week" ? -7 : -1)} aria-label="Poprzedni">
          <ChevronLeft />
        </Button>
        <Button type="button" variant="outline" onClick={() => setAnchor(new Date())}>
          Dziś
        </Button>
        <Button type="button" variant="outline" size="icon" onClick={() => shiftDays(view === "week" ? 7 : 1)} aria-label="Następny">
          <ChevronRight />
        </Button>

        <div className="ml-4 flex items-center gap-1 rounded-sm border border-border p-0.5">
          <Button
            type="button"
            size="sm"
            variant={view === "day" ? "default" : "ghost"}
            aria-pressed={view === "day"}
            onClick={() => setView("day")}
          >
            Dzień
          </Button>
          <Button
            type="button"
            size="sm"
            variant={view === "week" ? "default" : "ghost"}
            aria-pressed={view === "week"}
            onClick={() => setView("week")}
          >
            Tydzień
          </Button>
        </div>

        <div className="ml-2 flex items-center gap-1 rounded-sm border border-border p-0.5">
          <Button
            type="button"
            size="sm"
            variant={zoom === "1h" ? "default" : "ghost"}
            aria-pressed={zoom === "1h"}
            onClick={() => handleZoomChange("1h")}
          >
            1h
          </Button>
          <Button
            type="button"
            size="sm"
            variant={zoom === "30min" ? "default" : "ghost"}
            aria-pressed={zoom === "30min"}
            onClick={() => handleZoomChange("30min")}
          >
            30 min
          </Button>
        </div>

        {/* Fix 4: przełącznik widoczności linii "teraz" — ten sam wzorzec
            zapisu co zoom wyżej (localStorage, domyślnie widoczna). */}
        <Button
          type="button"
          size="sm"
          variant={showNowLine ? "default" : "outline"}
          aria-pressed={showNowLine}
          className="ml-2"
          onClick={() => handleNowLineToggle(!showNowLine)}
        >
          Linia teraz
        </Button>

        <span className="ml-auto text-caption font-caption text-text-secondary">Strefa: {timeZone}</span>
      </div>

      {/* Jedyny scrollowany kontener (pion + poziom, gdy 7 dni szersze niż
          viewport) — toolbar wyżej celowo POZA nim, patrz komentarz przy nim. */}
      <div className="flex flex-1 overflow-auto">
        <div className="w-14 shrink-0">
          {/* sticky: ta sama logika co nagłówek dnia obok — trzyma pusty
              nagłówek kolumny godzin w miejscu przy pionowym scrollu, żeby
              liczby godzin nie "wjeżdżały" pod przyklejone nagłówki dni. */}
          <div className="sticky top-0 z-20 h-12 border-b border-border bg-bg-secondary" />
          <div aria-hidden="true" style={{ height: `${TOP_SPACER_REM}rem` }} />
          <div className="relative pt-2">
            {/* Wskaźnik aktualnej godziny w rynnie osi — pozycja w rem od
                startu listy godzin (top:0 = padding box = start doby w
                kolumnach dni), więc wyrównany co do minuty z linią "teraz"
                niezależnie od zoomu. */}
            {showNowLine && now !== null && (
              <span
                aria-hidden="true"
                className="tabular-nums pointer-events-none absolute right-1 z-10 -translate-y-1/2 rounded-sm bg-danger px-1 text-caption font-caption font-medium text-text-primary"
                style={{ top: `${(minutesSinceMidnightNow(now) / 60) * hourHeightRem}rem` }}
              >
                {minutesToHHMM(minutesSinceMidnightNow(now))}
              </span>
            )}
            {Array.from({ length: 24 }, (_, hour) =>
              zoom === "30min" ? (
                <div key={hour} style={{ height: `${hourHeightRem}rem` }}>
                  <div
                    style={{ height: `${hourHeightRem / 2}rem` }}
                    className="tabular-nums -translate-y-2 pr-2 text-right text-caption font-caption text-text-secondary"
                  >
                    {String(hour).padStart(2, "0")}:00
                  </div>
                  <div
                    style={{ height: `${hourHeightRem / 2}rem` }}
                    className="tabular-nums -translate-y-2 pr-2 text-right text-caption font-caption text-text-secondary/50"
                  >
                    {String(hour).padStart(2, "0")}:30
                  </div>
                </div>
              ) : (
                <div
                  key={hour}
                  style={{ height: `${hourHeightRem}rem` }}
                  className="tabular-nums -translate-y-2 pr-2 text-right text-caption font-caption text-text-secondary"
                >
                  {String(hour).padStart(2, "0")}:00
                </div>
              ),
            )}
          </div>
        </div>

        <div className="flex flex-1">
          {visibleDays.map((day) => {
            const dayKey = localDateKey(day);
            const daySegments = segmentsByDay.get(dayKey) ?? [];
            // Fix 3b: scalona karta zmiany (ma pasek Dojazd/Odjazd, patrz
            // bufferBefore/bufferAfter niżej w BlockCard) renderuje się PRZED
            // zwykłą kartą zmiany bez własnego bufora — przy równym z-index
            // (z-10 dla obu) później w DOM wygrywa malowanie, więc zwykła
            // karta trafia NAD cudzym paskiem dojazdu/odjazdu (user: "niebieska
            // powinna być nad dojazdami, priorytet ma karta, nie dojazd").
            // Segmenty tła (nocleg/surowy bufor) zostają na początku —
            // layoutOverlaps już je stawia jako pierwsze, tu tylko zachowane.
            const renderSegments = [...daySegments].sort(
              (a, b) => segmentSortRank(a, daySegments) - segmentSortRank(b, daySegments),
            );
            const isToday = dayKey === todayKey;
            const isMoveTarget = !!moveDrag?.isDragging && moveDrag.targetDayKey === dayKey && moveDrag.sourceDayKey !== dayKey;
            const unavailableRanges = availability
              ? getUnavailableRangesFromAvailability(day, availability)
              : getUnavailableRanges(day, WORKING_HOURS);
            const resizingHere = resizeDrag?.dayKey === dayKey ? resizeDrag : null;
            const draggedBlock =
              moveDrag?.isDragging && (moveDrag.targetDayKey ?? moveDrag.sourceDayKey) === dayKey
                ? blocksById.get(moveDrag.blockId)
                : undefined;
            const movePreview =
              moveDrag?.isDragging && draggedBlock ? shiftBlockTime(draggedBlock, moveDrag.deltaMinutes) : null;

            return (
              <div
                key={dayKey}
                data-day-key={dayKey}
                className={`min-w-32 flex-1 border-l border-border ${isMoveTarget ? "bg-bg-secondary" : ""}`}
              >
                {/* sticky top-0 (Fix 1): przyklejony do góry SCROLLOWANEGO
                    kontenera (div flex-1 overflow-auto wyżej) przy pionowym
                    scrollu przez 24h siatki — toolbar leży poza tym
                    kontenerem, więc "top-0" tutaj to już właściwe miejsce,
                    bez potrzeby liczenia wysokości toolbara. z-20: wyższy niż
                    karty (z-10/z-0). */}
                <div className="sticky top-0 z-20 flex h-12 flex-row items-center justify-center gap-2 border-b border-border bg-bg-secondary text-body">
                  <span className="text-caption font-caption text-text-secondary">
                    {DAY_LABELS[(day.getDay() + 6) % 7]}
                  </span>
                  <span
                    className={`tabular-nums flex h-6 w-6 items-center justify-center text-caption font-caption ${
                      isToday ? "rounded-full bg-primary font-semibold text-on-primary" : "text-text-primary"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                </div>
                <div aria-hidden="true" style={{ height: `${TOP_SPACER_REM}rem`, ...UNAVAILABLE_STRIPE_STYLE }} />
                <div
                  className="relative touch-none"
                  data-grid-body={dayKey}
                  style={{ height: `${hourHeightRem * 24}rem` }}
                  onPointerDown={(e) => handleGridPointerDown(e, day, dayKey)}
                  onPointerMove={handleGridPointerMove}
                  onPointerUp={handleGridPointerUp}
                  onDragOver={handleGridDragOver}
                  onDrop={(e) => void handleGridDrop(e, day)}
                >
                  {unavailableRanges.map((range, i) => (
                    <div
                      key={i}
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0"
                      style={{
                        top: `${(range.startMinutes / 1440) * 100}%`,
                        height: `${((range.endMinutes - range.startMinutes) / 1440) * 100}%`,
                        ...UNAVAILABLE_STRIPE_STYLE,
                      }}
                    />
                  ))}
                  {Array.from({ length: 24 }, (_, hour) => (
                    <div
                      key={hour}
                      className="pointer-events-none border-t border-border"
                      style={{ height: `${hourHeightRem}rem` }}
                    />
                  ))}
                  {zoom === "30min" &&
                    Array.from({ length: 24 }, (_, hour) => (
                      <div
                        key={`half-${hour}`}
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border/50"
                        style={{ top: `${((hour + 0.5) / 24) * 100}%` }}
                      />
                    ))}
                  {renderSegments.map((segment, i) => {
                    // Bufory nie renderują się jako osobne karty (Change 3) —
                    // scalają się w kartę zmiany poniżej, patrz
                    // bufferBefore/bufferAfter niżej i BlockCard.
                    if (segment.phase === "buffer") return null;

                    // Podgląd tylko na segmencie z prawdziwym brzegiem odpowiadającym trzymanej krawędzi
                    // (nie na ucięciu przez północ) — patrz isEdgeResizable.
                    const resizePreview =
                      resizingHere &&
                      resizingHere.blockId === segment.blockId &&
                      ((resizingHere.edge === "start" && !segment.continuesFromPrevDay) ||
                        (resizingHere.edge === "end" && !segment.continuesToNextDay))
                        ? resizingHere.currentMinutes
                        : null;

                    // Bufor dojazdu/powrotu tego samego dnia, sklejony z tą
                    // kartą zmiany w jedną wizualną całość (Change 3) — szukamy
                    // siostrzanego segmentu "buffer" tego bloku, którego
                    // krawędź styka się z krawędzią zmiany. ponytail: tylko
                    // ten sam dzień — bufor-po wypadający w inny dzień niż
                    // jakikolwiek segment zmiany (rzadki brzeg, np. wyjazd tuż
                    // po północy bez segmentu zmiany tego dnia) po prostu się
                    // nie renderuje, zamiast wracać do osobnego boksu.
                    // Task B: nocleg dostaje te same strefy dojazdu/odjazdu co
                    // zmiana — "przed" szuka bufferKind "overnight-before"
                    // (dojazd DO miejsca noclegu, tylko gdy jest jawna luka,
                    // patrz computeGridSegments), "po" to ten sam bufferKind
                    // "after" co dla zmiany bez noclegu (odjazd po wyjeździe).
                    const bufferBefore =
                      segment.phase === "shift" || segment.phase === "overnight"
                        ? daySegments.find(
                            (s) =>
                              s.phase === "buffer" &&
                              s.bufferKind === (segment.phase === "shift" ? "before" : "overnight-before") &&
                              s.blockId === segment.blockId &&
                              s.endMinutes === segment.startMinutes,
                          )
                        : undefined;
                    const bufferAfter =
                      segment.phase === "shift" || segment.phase === "overnight"
                        ? daySegments.find(
                            (s) =>
                              s.phase === "buffer" &&
                              s.bufferKind === "after" &&
                              s.blockId === segment.blockId &&
                              s.startMinutes === segment.endMinutes,
                          )
                        : undefined;

                    const segmentKey = segmentFocusKey(segment);
                    const beforeZoneMinutes = bufferBefore ? segment.startMinutes - bufferBefore.startMinutes : 0;
                    const afterZoneMinutes = bufferAfter ? bufferAfter.endMinutes - segment.endMinutes : 0;

                    return (
                      <Fragment key={`${segment.blockId}-${dayKey}-${i}`}>
                        <BlockCard
                          segment={segment}
                          isBeingDragged={moveDrag?.isDragging === true && moveDrag.blockId === segment.blockId}
                          resizePreviewMinutes={resizePreview}
                          resizeEdge={resizePreview !== null ? resizingHere!.edge : null}
                          bufferBeforeStartMinutes={bufferBefore?.startMinutes}
                          bufferAfterEndMinutes={bufferAfter?.endMinutes}
                          overnightCaption={computeOvernightCaption(segment, blocksById.get(segment.blockId), segmentsByDay)}
                          segmentKey={segmentKey}
                          // Faza "overnight" (okres do wyjazdu) nie ma jeszcze
                          // własnego pola do edycji przez przeciąganie
                          // (to nie startTime/endTime bloku, tylko
                          // departureTime) — bez blokady przeciągnięcie tej
                          // krawędzi po cichu nadpisałoby endTime błędną
                          // wartością. Godziny samej zmiany ("shift") nadal
                          // rozciągalne jak wcześniej.
                          canResizeStart={segment.phase === "shift" && isEdgeResizable(segment, "start")}
                          canResizeEnd={segment.phase === "shift" && isEdgeResizable(segment, "end")}
                          onPointerDown={(e) => {
                            const instanceWeekday = segment.continuesFromPrevDay ? (day.getDay() + 6) % 7 : day.getDay();
                            startMoveDrag(e, segment.blockId, instanceWeekday, dayKey);
                          }}
                          onPointerMove={(e) => {
                            e.stopPropagation();
                            moveMoveDrag(e);
                          }}
                          onPointerUp={(e) => {
                            e.stopPropagation();
                            const block = blocksById.get(segment.blockId);
                            if (block) void endMoveDrag(e, block, segmentKey);
                          }}
                          onResizeStart={(e, edge) => startResizeDrag(e, segment.blockId, dayKey, edge)}
                          onResizeMove={moveResizeDrag}
                          onResizeUp={(e) => {
                            const block = blocksById.get(segment.blockId);
                            if (block) void endResizeDrag(e, block);
                          }}
                        />
                        {focusedSegmentKey === segmentKey && (
                          <SegmentFocusOverlay
                            segment={segment}
                            beforeZoneMinutes={beforeZoneMinutes}
                            afterZoneMinutes={afterZoneMinutes}
                          />
                        )}
                      </Fragment>
                    );
                  })}
                  {movePreview && (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-1 z-20 overflow-hidden rounded-sm border border-dashed border-text-primary bg-text-primary/10 px-2 py-1 text-caption font-caption"
                      style={{
                        top: `${(hhmmToMinutes(movePreview.startTime) / 1440) * 100}%`,
                        height: `${(Math.max(15, (hhmmToMinutes(movePreview.endTime) <= hhmmToMinutes(movePreview.startTime) ? 24 * 60 : hhmmToMinutes(movePreview.endTime)) - hhmmToMinutes(movePreview.startTime)) / 1440) * 100}%`,
                      }}
                    >
                      <div className="tabular-nums text-text-primary">
                        {movePreview.startTime}–{movePreview.endTime}
                      </div>
                    </div>
                  )}
                  {createDrag?.dayKey === dayKey && (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-1 z-10 rounded-sm border border-dashed border-text-primary bg-text-primary/10"
                      style={{
                        top: `${(Math.min(createDrag.startMinutes, createDrag.currentMinutes) / 1440) * 100}%`,
                        height: `${(Math.max(15, Math.abs(createDrag.currentMinutes - createDrag.startMinutes)) / 1440) * 100}%`,
                      }}
                    />
                  )}
                  {showNowLine && isToday && nowTop !== null && (
                    <div
                      className="pointer-events-none absolute right-0 left-0 z-10 flex items-center"
                      style={{ top: `${nowTop}%` }}
                      aria-hidden="true"
                    >
                      <span className="-ml-1 h-2 w-2 shrink-0 rounded-full bg-danger" />
                      {/* Fix 4: kropka+etykieta zostają pełne, sama linia jest
                          przerywana — border-t na elemencie 0-wysokości daje
                          wzór kresek zamiast litego pasa bg-danger. */}
                      <span className="h-0 flex-1 border-t border-dashed border-danger" />
                    </div>
                  )}
                  {quickCreate && createDrag === null && dayKey === quickCreate.draft.date && (
                    <QuickCreatePopover draft={quickCreate.draft} position={quickCreate.position} onClose={() => setQuickCreate(null)} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <EditBlockModal block={editingBlock} onClose={() => setEditingBlock(null)} />
    </div>
  );
}

function BlockCard({
  segment,
  isBeingDragged,
  resizePreviewMinutes,
  resizeEdge,
  canResizeStart,
  canResizeEnd,
  bufferBeforeStartMinutes,
  bufferAfterEndMinutes,
  overnightCaption,
  segmentKey,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onResizeStart,
  onResizeMove,
  onResizeUp,
}: {
  segment: LaidOutSegment;
  isBeingDragged: boolean;
  resizePreviewMinutes: number | null;
  resizeEdge: ResizeEdge | null;
  canResizeStart: boolean;
  canResizeEnd: boolean;
  bufferBeforeStartMinutes?: number;
  bufferAfterEndMinutes?: number;
  overnightCaption: string | null;
  segmentKey: string;
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onResizeStart: (e: ReactPointerEvent<HTMLDivElement>, edge: ResizeEdge) => void;
  onResizeMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onResizeUp: (e: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  // Podczas resize podmieniamy tylko krawędź faktycznie trzymaną — druga zostaje z segmentu.
  const startMinutes = resizeEdge === "start" && resizePreviewMinutes !== null ? resizePreviewMinutes : segment.startMinutes;
  const endMinutes = resizeEdge === "end" && resizePreviewMinutes !== null ? resizePreviewMinutes : segment.endMinutes;

  // Bufor dojazdu/powrotu scalony w JEDNĄ kartę ze zmianą (Change 3, zamiast
  // osobnych "widmowych" boksów) — karta rozciąga się na pełny zakres
  // bufor-przed..bufor-po, a same bufory to tylko przyciemnione "scrimy" na
  // górze/dole tej samej karty (patrz niżej). Bez buforów (typowy przypadek)
  // mergedTop === startMinutes i mergedBottom === endMinutes, więc % rdzenia
  // liczone niżej wychodzą 0/100 — piksel w piksel jak dawniej.
  const mergedTop = bufferBeforeStartMinutes ?? startMinutes;
  const mergedBottom = bufferAfterEndMinutes ?? endMinutes;
  const mergedSpan = Math.max(1, mergedBottom - mergedTop); // ponytail: unikamy dzielenia przez 0 dla zdegenerowanego zakresu
  const corePercentTop = ((startMinutes - mergedTop) / mergedSpan) * 100;
  const corePercentBottom = ((endMinutes - mergedTop) / mergedSpan) * 100;

  const top = (mergedTop / 1440) * 100;
  const height = (Math.max(15, mergedBottom - mergedTop) / 1440) * 100;

  const isOvernightPhase = segment.phase === "overnight";
  const typeLabel = TYPE_LABELS[segment.type] ?? segment.type;
  // Akcent i poświata noclegu kolorują się kolorem WŁASNEGO typu bloku
  // (Change 2, decyzja użytkownika 2026-07-10) — nie ma już osobnego, stałego
  // fioletu overnight-block dla żadnej fazy.
  const accentClass = TYPE_ACCENT_CLASS[segment.type] ?? "border-l-text-secondary";
  const textClass = TYPE_TEXT_CLASS[segment.type] ?? "text-text-secondary";
  // Nocleg (Task B1): BEZ opaque *-block-bg — ten inline tint niżej daje
  // zamiast tego blady PRZEZROCZYSTY odcień, żeby linie siatki godzinowej
  // nadal przebijały przez kartę (opaque tło by je całkiem zasłoniło).
  const fillClass = isOvernightPhase ? "" : (TYPE_FILL_CLASS[segment.type] ?? "bg-bg-secondary");
  const widthPct = 100 / segment.colCount;
  const glowColorVar = TYPE_COLOR_VAR[segment.type] ?? "--color-overnight-block";
  const stripeColor = `color-mix(in srgb, var(${glowColorVar}) 18%, transparent)`;
  const glowStyle = segment.staysOvernight
    ? ({ "--glow-color": `color-mix(in srgb, var(${glowColorVar}) 25%, transparent)` } as CSSProperties)
    : undefined;
  const overnightTintStyle = isOvernightPhase
    ? ({ backgroundColor: `color-mix(in srgb, var(${glowColorVar}) 8%, transparent)` } as CSSProperties)
    : undefined;
  // Task D3: kolizja tylko z buforem innego bloku (nie z jego rdzeniem zmiany)
  // renderuje kartę w pół szerokości wyrównaną do prawej, NAD tym buforem —
  // ma pierwszeństwo przed geometrią kolumn klastra (ponytail: uproszczenie,
  // nie łączymy obu układów naraz).
  const overBufferStyle = segment.overBuffer ? ({ left: "50%", width: "calc(50% - 8px)" } as CSSProperties) : undefined;

  // Task A/B: realny czas trwania (minuty) stref kreskowanych dojazdu/odjazdu
  // — pod etykietami "Dojazd"/"Odjazd" niżej; ukrywamy etykietę poniżej ~20
  // minut wysokości, żeby tekst się zmieścił (patrz guard przy renderze).
  const beforeZoneMinutes = startMinutes - mergedTop;
  const afterZoneMinutes = mergedBottom - endMinutes;
  // Fix 3: karta zbyt krótka na 3 linie tekstu (nazwa + godziny + typ) traci
  // najmniej istotną (typ) i dostaje ciaśniejszy padding pionowy — stały
  // py-2 (8px) na karcie wysokości np. 24px "zjadał" 1/3 miejsca samym
  // paddingiem, przez co widoczny tekst wyglądał jakby zaczynał się w
  // połowie karty zamiast od góry. Pełne info i tak dostępne przez focus
  // (Fix 2 — SegmentFocusOverlay), więc ucięcie trzeciej linii nic nie traci.
  const isCompactCore = endMinutes - startMinutes < 45;

  return (
    <div
      data-segment-key={segmentKey}
      className={`absolute touch-none overflow-hidden rounded-sm border border-l-[3px] border-border ${isOvernightPhase ? "z-0" : segment.overBuffer ? "z-20" : "z-10"} ${accentClass} ${fillClass} ${
        segment.staysOvernight ? "overnight-glow" : ""
      } ${segment.continuesFromPrevDay ? "rounded-t-none" : ""} ${segment.continuesToNextDay ? "rounded-b-none" : ""} ${
        isBeingDragged ? "opacity-50" : "cursor-grab"
      }`}
      style={{
        top: `${top}%`,
        height: `${height}%`,
        left: `calc(${segment.col * widthPct}% + 4px)`,
        width: `calc(${widthPct}% - 8px)`,
        ...glowStyle,
        ...overnightTintStyle,
        ...overBufferStyle,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Etykieta zakotwiczona w LEWEJ połowie strefy (Fix 2) — wyśrodkowana
          etykieta znikała pod overBuffer kartą (renderuje się w prawej
          połowie, left:50%, patrz overBufferStyle wyżej). Paski nadal
          rozciągają się na całą szerokość strefy, tylko tekst idzie w lewo. */}
      {corePercentTop > 0 && (
        <div
          aria-hidden="true"
          className="buffer-stripes pointer-events-none absolute inset-x-0 top-0 flex items-center justify-start pl-2 text-caption font-caption"
          style={{ height: `${corePercentTop}%`, "--stripe-color": stripeColor } as CSSProperties}
        >
          {bufferLabelMode(beforeZoneMinutes) !== "hidden" && (
            <span className={textClass}>
              {bufferLabelMode(beforeZoneMinutes) === "full" && (
                <>
                  Dojazd
                  <br />
                </>
              )}
              {beforeZoneMinutes}min
            </span>
          )}
        </div>
      )}
      {corePercentBottom < 100 && (
        <div
          aria-hidden="true"
          className="buffer-stripes pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-start pl-2 text-caption font-caption"
          style={{ height: `${100 - corePercentBottom}%`, "--stripe-color": stripeColor } as CSSProperties}
        >
          {bufferLabelMode(afterZoneMinutes) !== "hidden" && (
            <span className={textClass}>
              {bufferLabelMode(afterZoneMinutes) === "full" && (
                <>
                  Odjazd
                  <br />
                </>
              )}
              {afterZoneMinutes}min
            </span>
          )}
        </div>
      )}
      {canResizeStart && (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 z-10 h-2 cursor-ns-resize"
          style={{ top: `${corePercentTop}%` }}
          onPointerDown={(e) => onResizeStart(e, "start")}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeUp}
        />
      )}
      {/* Fix 2a (użytkownik cofnął wcześniejszą decyzję "bez tekstu"): faza
          "overnight" dostaje jedną zwięzłą linię "od → do" — ale TYLKO na
          PIERWSZYM segmencie ciągu (continuesFromPrevDay === false), żeby nie
          powtarzać tego samego podpisu na każdym dniu wielodniowego noclegu.
          Kontynuacje zostają bez tekstu (patrz overnightCaption niżej —
          liczony w rodzicu, null dla segmentów kontynuacji). */}
      {isOvernightPhase && overnightCaption && (
        <div
          className={`absolute inset-x-0 px-3 py-2 text-caption font-caption select-none ${textClass}`}
          style={{ top: `${corePercentTop}%` }}
        >
          {/* Fix 5: nazwa/miejsce noclegu (block.name, np. "Nocleg - Katowice")
              NAD podpisem "od → do" — wcześniej sam zakres czasu nie mówił,
              o który nocleg chodzi. */}
          <div className="truncate font-medium">{segment.name}</div>
          <div className="truncate tabular-nums opacity-90">{overnightCaption}</div>
        </div>
      )}
      {!isOvernightPhase && (
        <div
          className={`absolute inset-x-0 select-none text-caption font-caption ${isCompactCore ? "px-2 py-0.5" : "px-3 py-2"}`}
          style={{ top: `${corePercentTop}%` }}
        >
          <div className="truncate font-medium">
            {segment.continuesFromPrevDay ? "⟵ " : ""}
            {segment.name}
          </div>
          <div className="tabular-nums opacity-90">
            {minutesToHHMM(startMinutes)}–{minutesToHHMM(endMinutes === 24 * 60 ? 0 : endMinutes)}
            {segment.continuesToNextDay ? " →" : ""}
          </div>
          {/* Fix 3: trzecia linia (typ) tylko gdy jest miejsce — patrz isCompactCore. */}
          {!isCompactCore && (
            <div className="opacity-90">
              {typeLabel}
              {segment.staysOvernight ? " · Nocleg" : ""}
            </div>
          )}
        </div>
      )}
      {canResizeEnd && (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 z-10 h-2 cursor-ns-resize"
          style={{ bottom: `${100 - corePercentBottom}%` }}
          onPointerDown={(e) => onResizeStart(e, "end")}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeUp}
        />
      )}
    </div>
  );
}

/**
 * Fix 2: dwie przerywane linie prowadzące (na PRAWDZIWYCH startMinutes/
 * endMinutes segmentu, nie na scalonych granicach karty — dzięki temu widać
 * dokładnie gdzie kończy się np. strefa dojazdu, nawet gdy scalona karta jej
 * osobno nie pokazuje) + mały overlay z pełną informacją (nazwa, typ, godziny,
 * strefy dojazdu/odjazdu), niezależnie od tego, ile miejsca ma sama karta.
 */
function SegmentFocusOverlay({
  segment,
  beforeZoneMinutes,
  afterZoneMinutes,
}: {
  segment: GridSegment;
  beforeZoneMinutes: number;
  afterZoneMinutes: number;
}) {
  const typeLabel = TYPE_LABELS[segment.type] ?? segment.type;
  const startTop = (segment.startMinutes / 1440) * 100;
  const endTop = (segment.endMinutes / 1440) * 100;

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 z-30 border-t border-dashed border-text-primary"
        style={{ top: `${startTop}%` }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 z-30 border-t border-dashed border-text-primary"
        style={{ top: `${endTop}%` }}
      />
      <div
        className="pointer-events-none absolute left-1 z-40 max-w-[220px] rounded-md border border-border bg-surface p-2 text-caption font-caption shadow"
        style={{ top: `calc(${startTop}% + 4px)` }}
      >
        <div className="truncate font-medium text-text-primary">{segment.name}</div>
        <div className="tabular-nums text-text-secondary">
          {typeLabel} · {minutesToHHMM(segment.startMinutes)}–{minutesToHHMM(segment.endMinutes === 24 * 60 ? 0 : segment.endMinutes)}
        </div>
        {beforeZoneMinutes > 0 && (
          <div className="text-text-secondary">Dojazd · {beforeZoneMinutes}min</div>
        )}
        {afterZoneMinutes > 0 && (
          <div className="text-text-secondary">Odjazd · {afterZoneMinutes}min</div>
        )}
      </div>
    </>
  );
}
