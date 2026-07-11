"use client";

import {
  Fragment,
  startTransition,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Repeat, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuickCreatePopover } from "@/components/planner/QuickCreatePopover";
import {
  BOUNDARY_LABELS_STORAGE_KEY,
  NOW_LINE_STORAGE_KEY,
  bufferLabelMode,
  buildBacklogDropBody,
  buildBufferResizePatch,
  buildMovePatch,
  buildResizeBlockPatch,
  classifyOverlap,
  computeGridSegments,
  dragRangeToDraft,
  focusBoundaryMinutes,
  formatBufferLabel,
  getUnavailableRanges,
  getUnavailableRangesFromAvailability,
  getWeekDays,
  hhmmToMinutes,
  initialScrollMinutes,
  isDayAvailableForCreate,
  isEdgeResizable,
  layoutOverlaps,
  localDateKey,
  minutesToHHMM,
  pixelDeltaToMinutes,
  pixelOffsetToMinutes,
  shiftBlockTime,
  snapMinutes,
  snapToNearestFreeSlot,
  type BlocksAction,
  type BoundaryLabelMode,
  type DragRangeDraft,
  type GridSegment,
  type LaidOutSegment,
  type PlannerBlock,
  type ResizeEdge,
} from "@/lib/planner-grid";
import type { AvailabilityDay } from "@/lib/availability";

const MOVE_DRAG_THRESHOLD_PX = 5;
const ZOOM_STORAGE_KEY = "planner-grid-zoom";
// Fix 4/5 (odziedziczone): widoczność linii "teraz" i tryb etykiet granic —
// klucze localStorage teraz mieszkają w lib/planner-grid.ts (NOW_LINE_STORAGE_KEY,
// BOUNDARY_LABELS_STORAGE_KEY), bo od Fix 7 czyta/pisze je też
// app/ustawienia/page.tsx, nie tylko ten komponent. Ten sam wzorzec
// odczytu/zapisu co zoom powyżej (mounted-effect + handle*Change niżej).
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

/**
 * Bufor dojazdu (przed)/odjazdu (po) sklejony z segmentem "shift"/"overnight"
 * tego samego bloku i dnia w jedną kartę — ta sama para, którą BlockCard
 * scala wizualnie. Wyodrębnione z pętli renderowania (było tam inline), żeby
 * granice linii focusa (Fix 1, focusBoundaryMinutes) mogły skorzystać z
 * DOKŁADNIE tego samego dopasowania zamiast go duplikować.
 */
function findMergedBuffers(
  segment: GridSegment,
  daySegments: GridSegment[],
): { bufferBefore?: GridSegment; bufferAfter?: GridSegment } {
  if (segment.phase !== "shift" && segment.phase !== "overnight") return {};
  const bufferBefore = daySegments.find(
    (s) =>
      s.phase === "buffer" &&
      s.bufferKind === (segment.phase === "shift" ? "before" : "overnight-before") &&
      s.blockId === segment.blockId &&
      s.endMinutes === segment.startMinutes,
  );
  const bufferAfter = daySegments.find(
    (s) => s.phase === "buffer" && s.bufferKind === "after" && s.blockId === segment.blockId && s.startMinutes === segment.endMinutes,
  );
  return { bufferBefore, bufferAfter };
}

/** Zmiana 1: payload wyfokusowanego bloku przekazywany do PlannerPage (a stamtąd do sidebara) — dokładnie te same dane, które dawniej czytał SegmentFocusPanel bezpośrednio z segmentu/bloku. */
export type FocusedBlockPayload = {
  block: PlannerBlock;
  beforeRangeLabel: string | null;
  afterRangeLabel: string | null;
  beforeZoneMinutes: number;
  afterZoneMinutes: number;
};

/** Odnajduje segment o danym kluczu focusa i buduje z niego FocusedBlockPayload — ta sama logika dopasowania co focusedGeometry niżej, tylko zwraca blok+zakresy zamiast granic linii. */
function buildFocusedBlockPayload(
  key: string,
  segmentsByDay: Map<string, GridSegment[]>,
  blocksById: Map<string, PlannerBlock>,
): FocusedBlockPayload | null {
  for (const daySegments of segmentsByDay.values()) {
    for (const segment of daySegments) {
      if (segment.phase === "buffer") continue;
      if (segmentFocusKey(segment) !== key) continue;
      const block = blocksById.get(segment.blockId);
      if (!block) return null;
      const { bufferBefore, bufferAfter } = findMergedBuffers(segment, daySegments);
      const mergedTopMinutes = bufferBefore?.startMinutes ?? segment.startMinutes;
      const afterEndMinutes = bufferAfter?.endMinutes ?? segment.endMinutes;
      const beforeZoneMinutes = bufferBefore ? segment.startMinutes - bufferBefore.startMinutes : 0;
      const afterZoneMinutes = bufferAfter ? bufferAfter.endMinutes - segment.endMinutes : 0;
      return {
        block,
        beforeRangeLabel:
          beforeZoneMinutes > 0 ? `${minutesToHHMM(mergedTopMinutes)}–${minutesToHHMM(segment.startMinutes)}` : null,
        afterRangeLabel:
          afterZoneMinutes > 0 ? `${minutesToHHMM(segment.endMinutes)}–${minutesToHHMM(afterEndMinutes)}` : null,
        beforeZoneMinutes,
        afterZoneMinutes,
      };
    }
  }
  return null;
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

// Fix 4: uchwyty na ZEWNĘTRZNYCH krawędziach scalonej karty (góra strefy
// dojazdu / dół strefy odjazdu) zmieniają długość bufora zamiast
// startTime/endTime zmiany — równoległy "rodzaj" edge obok istniejącego
// ResizeEdge ("start"/"end", granice samej zmiany), żeby buildResizeBlockPatch
// (wywoływane tylko dla "start"/"end") zostało nietknięte.
type BufferResizeEdge = "buffer-before" | "buffer-after";

type ResizeDragState = {
  blockId: string;
  dayKey: string;
  edge: ResizeEdge | BufferResizeEdge;
  pointerId: number;
  rectTop: number;
  currentMinutes: number;
};

export function PlannerGrid({
  blocks,
  availability,
  applyOptimistic,
  focusedSegment,
  onFocusedSegmentChange,
  onFocusedBlockChange,
  onBacklogScheduled,
}: {
  blocks: PlannerBlock[];
  availability?: AvailabilityDay[];
  // Zmiana 6: useOptimistic(blocks, applyBlocksAction) mieszka teraz w
  // PlannerPage (wspólny rodzic z sidebarem, gdzie BlockEditForm też musi do
  // niego sięgać) — `blocks` powyżej to JUŻ nadpisany optymistycznie stan,
  // `applyOptimistic` to sam dispatcher, do własnych mutacji drag/resize/drop.
  applyOptimistic: (action: BlocksAction) => void;
  // Zmiana 1: klucz wyfokusowanego segmentu (linie prowadzące + panel w
  // sidebarze) podniesiony do PlannerPage, żeby przycisk "wstecz" w sidebarze
  // mógł go wyczyścić — PlannerGrid dalej liczy z niego linie prowadzące
  // (focusedGeometry) i sam ustawia go przy kliknięciu na kartę.
  focusedSegment: string | null;
  onFocusedSegmentChange: (key: string | null) => void;
  onFocusedBlockChange: (payload: FocusedBlockPayload | null) => void;
  // Fix 5: bump licznika w PlannerPage po udanym zaplanowaniu pozycji
  // backlogu (drop na siatkę) — sidebar trzyma go w deps swojego fetch-efektu,
  // żeby lista "Do zaplanowania" odświeżyła się bez pełnego przeładowania.
  onBacklogScheduled?: () => void;
}) {
  const router = useRouter();
  const [view, setView] = useState<"day" | "week">("week");
  const [anchor, setAnchor] = useState(() => new Date());
  // null do montażu: pozycja linii "teraz" liczona z zegara różni się między
  // SSR a hydratacją (mismatch), więc linia pojawia się dopiero na kliencie.
  const [now, setNow] = useState<Date | null>(null);
  // SSR/pierwsze renderowanie zawsze "1h" (identyczne z dotychczasowym
  // zachowaniem) — zapisany wybór z localStorage doczytujemy w useLayoutEffect
  // niżej (razem z auto-scrollem, patrz komentarz tam), więc nie ma osobnego
  // mismatchu hydratacji, a przeglądarka nigdy nie maluje przejściowego "1h".
  const [zoom, setZoom] = useState<Zoom>("1h");
  const hourHeightRem = zoom === "30min" ? 6 : 3;
  const hourHeightPx = hourHeightRem * 16; // zakłada domyślny root font-size 16px
  // Fix 4: domyślnie widoczna (true) — nadpisywana z localStorage w tym samym
  // mounted-layout-effect co zoom, więc SSR i pierwsze renderowanie klienta są zgodne.
  const [showNowLine, setShowNowLine] = useState(true);
  // Fix 5: domyślnie "all" (dotychczasowe zachowanie: 4 granice) — nadpisywane
  // z localStorage w tym samym mounted-layout-effect co zoom/linia teraz.
  const [boundaryLabelMode, setBoundaryLabelMode] = useState<BoundaryLabelMode>("all");
  // Fix 6: guard "tylko raz na montaż" dla auto-scrolla do interesującej
  // godziny — bez niego zoom (zmienia hourHeightPx) resetowałby scroll przy
  // każdej zmianie 1h/30min.
  const didAutoScrollRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [createDrag, setCreateDrag] = useState<CreateDragState | null>(null);
  const [quickCreate, setQuickCreate] = useState<{ draft: DragRangeDraft; position: { top: number; left: number } } | null>(
    null,
  );
  const [moveDrag, setMoveDrag] = useState<MoveDragState | null>(null);
  const moveDragRef = useRef<MoveDragState | null>(null);
  const [resizeDrag, setResizeDrag] = useState<ResizeDragState | null>(null);
  const resizeDragRef = useRef<ResizeDragState | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- odczyt zegara przeglądarki możliwy dopiero po montażu (patrz komentarz przy stanie)
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Fix (auto-scroll bez widocznego "skoku"): dawniej odczyt zoom/showNowLine/
  // boundaryLabelMode z localStorage i auto-scroll (niżej, przy segmentsByDay)
  // żyły w OSOBNYCH zwykłych useEffect — oba odpalają się PO pierwszym
  // pomalowaniu klatki, więc użytkownik na ułamek sekundy widział siatkę od
  // 00:00, zanim scrollTop (i ewentualnie zoom) doskoczyły do właściwego
  // miejsca. useLayoutEffect odpala się PRZED pomalowaniem — React commituje
  // zmiany stanu z niego synchronicznie zanim przeglądarka narysuje klatkę,
  // więc użytkownik widzi tylko stan końcowy. Scroll liczony z `resolvedZoom`
  // (świeży odczyt localStorage w TEJ SAMEJ funkcji), NIE z hourHeightPx z
  // domknięcia renderowania — setZoom(resolvedZoom) niżej nie zaktualizuje
  // hourHeightPx synchronicznie w tym samym wywołaniu (stan Reacta jest
  // asynchroniczny nawet w layout effect), więc licząc scrollTop wprost z
  // hourHeightPx złapalibyśmy STARĄ (domyślną "1h") wartość, gdyby zapisany
  // wybór to "30min" — dokładnie usterka, przed którą ostrzegał zgłaszający.
  // `now` zostaje w zwykłym useEffect wyżej (nie tutaj) — to jedyny stan tu,
  // którego SSR/hydratacja pierwszego renderu muszą się różnić (zegar
  // przeglądarki), więc musi poczekać na hydratację, inaczej niż zoom/scroll
  // (te nie wpływają na treść zserializowaną przez SSR w sposób, który by
  // się różnił — sam scrollTop to właściwość DOM, nie markup).
  useLayoutEffect(() => {
    const savedZoom = localStorage.getItem(ZOOM_STORAGE_KEY);
    const resolvedZoom: Zoom = savedZoom === "1h" || savedZoom === "30min" ? savedZoom : "1h";
    if (resolvedZoom !== zoom) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- odczyt localStorage możliwy dopiero po montażu
      setZoom(resolvedZoom);
    }
    const savedShowNowLine = localStorage.getItem(NOW_LINE_STORAGE_KEY);
    if (savedShowNowLine === "false") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- jak wyżej
      setShowNowLine(false);
    }
    const savedBoundaryLabelMode = localStorage.getItem(BOUNDARY_LABELS_STORAGE_KEY);
    if (savedBoundaryLabelMode === "all" || savedBoundaryLabelMode === "outer") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- jak wyżej
      setBoundaryLabelMode(savedBoundaryLabelMode);
    }

    if (didAutoScrollRef.current) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const resolvedHourHeightPx = (resolvedZoom === "30min" ? 6 : 3) * 16;
    const allSegments = Array.from(segmentsByDay.values()).flat();
    const minutes = initialScrollMinutes(allSegments, availability);
    container.scrollTop = (minutes / 60) * resolvedHourHeightPx;
    didAutoScrollRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- celowo TYLKO na montaż (didAutoScrollRef + resolvedZoom liczony wprost z localStorage tutaj, nie z zależności renderowania) — patrz komentarz wyżej
  }, []);

  function handleZoomChange(next: Zoom) {
    setZoom(next);
    localStorage.setItem(ZOOM_STORAGE_KEY, next);
  }

  // Fix 7: dawne handleNowLineToggle/handleBoundaryLabelModeChange (pisały do
  // localStorage z przycisków toolbara) usunięte razem z tymi przyciskami —
  // te same klucze teraz zapisuje wyłącznie app/ustawienia/page.tsx; ten
  // komponent tylko CZYTA je na montaż (mounted-effect wyżej), bez zmian.

  // Fix 2: klik POZA jakimkolwiek segmentem (albo Escape) czyści focus —
  // klik NA segmencie sam zarządza swoim stanem w endMoveDrag (pierwszy klik
  // ustawia focus, drugi klik na już wyfokusowanej karcie jest no-opem, patrz
  // endMoveDrag). Zmiana 1: formularz edycji mieszka teraz w sidebarze (sam
  // interaktywny — Select/Input/Button), więc klik tam NIE powinien czyścić
  // focusa na siatce — stąd wyjątek na "[data-planner-sidebar]" obok
  // istniejących wyjątków na portalowany Select/Popover content (portalują
  // się prosto do <body>, patrz components/ui/select.tsx SelectPrimitive.Portal).
  useEffect(() => {
    if (!focusedSegment) return;
    function handlePointerDown(e: PointerEvent) {
      const target = e.target as HTMLElement | null;
      const insidePanel =
        target?.closest("[data-segment-key]") ||
        target?.closest("[data-planner-sidebar]") ||
        target?.closest('[data-slot="select-content"]') ||
        target?.closest('[data-slot="popover-content"]');
      if (!insidePanel) onFocusedSegmentChange(null);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onFocusedSegmentChange(null);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [focusedSegment, onFocusedSegmentChange]);

  const blocksById = useMemo(() => new Map(blocks.map((b) => [b.id, b])), [blocks]);

  const visibleDays = useMemo(() => {
    const week = getWeekDays(anchor);
    return view === "week" ? week : [week.find((d) => localDateKey(d) === localDateKey(anchor)) ?? anchor];
  }, [anchor, view]);

  const rangeStart = visibleDays[0];
  const rangeEnd = visibleDays[visibleDays.length - 1];

  const segmentsByDay = useMemo(() => {
    const segments = computeGridSegments(blocks, rangeStart, rangeEnd);
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
  }, [blocks, rangeStart, rangeEnd]);

  // Fix 6/(bez skoku): auto-scroll do najwcześniejszego interesującego
  // momentu widocznego tygodnia przeniesiony do useLayoutEffect przy stanie
  // zoom/showNowLine/boundaryLabelMode wyżej (musi liczyć się z TĄ SAMĄ,
  // świeżo odczytaną wartością zoomu, patrz komentarz tam) — było tu jako
  // osobny zwykły useEffect, zostawiało widoczny skok od 00:00 przy każdym
  // przeładowaniu strony.

  // Fix 1 (feedback): granice (minuty) dla linii focusa — liczone RAZ tutaj
  // (nie per-dzień w pętli renderowania niżej), żeby overlay mógł
  // wyrenderować się jako jeden element na poziomie całego grida. Zmiana 4:
  // linie już NIE rozciągają się na całą szerokość kalendarza (wszystkie
  // dni) — tylko od osi godzin do prawej krawędzi KOLUMNY DNIA wyfokusowanej
  // karty, stąd dayIndex (pozycja tego dnia w visibleDays, do policzenia
  // ułamka szerokości w render) i type (kolor linii = kolor typu bloku,
  // TYPE_COLOR_VAR, zamiast neutralnego border-text-primary).
  const focusedGeometry = useMemo(() => {
    if (!focusedSegment) return null;
    for (const [day, daySegments] of segmentsByDay) {
      for (const segment of daySegments) {
        if (segment.phase === "buffer") continue;
        if (segmentFocusKey(segment) !== focusedSegment) continue;
        const { bufferBefore, bufferAfter } = findMergedBuffers(segment, daySegments);
        const boundaries = focusBoundaryMinutes(segment, bufferBefore, bufferAfter);
        const dayIndex = visibleDays.findIndex((d) => localDateKey(d) === day);
        return { boundaries, dayIndex: dayIndex === -1 ? 0 : dayIndex, type: segment.type };
      }
    }
    return null;
  }, [focusedSegment, segmentsByDay, visibleDays]);

  // Zmiana 1: blok+zakresy wyfokusowanego segmentu, przekazane w górę do
  // PlannerPage (a stamtąd do sidebara — patrz FocusedBlockPayload) — osobny
  // memo od focusedGeometry powyżej (ten napędza WYŁĄCZNIE linie prowadzące
  // na siatce, ten poniżej WYŁĄCZNIE zawartość panelu w sidebarze), żeby nie
  // mieszać dwóch niezależnych konsumentów jednego stanu focusa.
  const focusedBlockPayload = useMemo(
    () => (focusedSegment ? buildFocusedBlockPayload(focusedSegment, segmentsByDay, blocksById) : null),
    [focusedSegment, segmentsByDay, blocksById],
  );

  useEffect(() => {
    onFocusedBlockChange(focusedBlockPayload);
  }, [focusedBlockPayload, onFocusedBlockChange]);

  // Fix 3: id wyfokusowanego bloku — ALLE karty (wszystkie tygodniowe
  // instancje + scalone strefy buforu) tego samego blockId dostają pierścień
  // focusa, nie tylko kliknięty segment, patrz BlockCard#isFocused.
  const focusedBlockId = focusedBlockPayload?.block.id ?? null;

  const todayKey = localDateKey(now ?? new Date());
  const nowTop = now === null ? null : (minutesSinceMidnightNow(now) / 1440) * 100;
  // Fix 6: pozycja kolumny "dziś" wśród widocznych dni — do policzenia
  // szerokości białego łącznika (oś -> lewa krawędź kolumny dziś) niżej.
  // -1, gdy dziś nie jest w widocznym zakresie (np. inny tydzień) — wtedy
  // łącznik (i sama linia "teraz") w ogóle się nie renderuje.
  const todayDayIndex = visibleDays.findIndex((d) => localDateKey(d) === todayKey);

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

    // Task D2 (Fix 3 doprecyzowanie): kolizja TYLKO z buforem innego bloku
    // (over-buffer) zostaje dopuszczalna jak dawniej — mała pozycja z
    // backlogu nadal może usiąść w strefie dojazdu/odjazdu, patrz
    // classifyOverlap. Prawdziwa kolizja RDZENI ("conflict") już nie
    // abortuje po cichu — szuka najbliższego wolnego miejsca (Fix 3,
    // snapToNearestFreeSlot, bez własnych buforów: backlog-drop ich nie ma).
    const dayKey = localDateKey(day);
    const candidateStart = snapMinutes(startMinutes);
    const candidateEnd = snapMinutes(Math.min(candidateStart + item.durationMinutes, 24 * 60));
    const daySegs = segmentsByDay.get(dayKey) ?? [];
    let finalStart = candidateStart;
    if (classifyOverlap(daySegs, { startMinutes: candidateStart, endMinutes: candidateEnd }) === "conflict") {
      const snapped = snapToNearestFreeSlot(daySegs, {
        startMinutes: candidateStart,
        durationMinutes: candidateEnd - candidateStart,
        bufferBefore: 0,
        bufferAfter: 0,
      });
      if (snapped === null) {
        console.warn("Upuszczenie z backlogu zignorowane: brak wolnego miejsca w tym dniu");
        return;
      }
      finalStart = snapped;
    }

    const body = buildBacklogDropBody({ name: item.name, durationMinutes: item.durationMinutes, day, startMinutes: finalStart });
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
      if (!res.ok) {
        console.error("Nie udało się utworzyć bloku z backlogu", res.status);
        return;
      }
      // Fix 5: pozycja znika z "Do zaplanowania" (scheduledStart ustawiony na
      // konkretny termin) — te same, już snapnięte minuty co blok wyżej.
      // Istniejący endpoint, patrz app/api/backlog/[id]/schedule/route.ts.
      const finalEnd = Math.min(finalStart + item.durationMinutes, 24 * 60);
      await fetch(`/api/backlog/${item.id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: dateFromDayKeyAndMinutes(dayKey, finalStart).toISOString(),
          end: dateFromDayKeyAndMinutes(dayKey, finalEnd).toISOString(),
        }),
      });
      onBacklogScheduled?.();
      router.refresh();
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

  async function endMoveDrag(block: PlannerBlock, segmentKey: string) {
    const current = moveDragRef.current;
    moveDragRef.current = null;
    setMoveDrag(null);
    if (!current) return;

    if (!current.isDragging) {
      // Zmiana 1/2: pierwszy klik (bez przeciągnięcia) na segmencie ustawia
      // focus (dashed guide-lines na siatce + edit view w sidebarze, patrz
      // PlannerPage/PlannerSidebar) — drugi klik na TYM SAMYM, już
      // wyfokusowanym segmencie jest no-opem (sidebar już pokazuje edytowalny
      // formularz). Klik na INNYM segmencie po prostu podmienia focus.
      if (focusedSegment === segmentKey) {
        return;
      }
      onFocusedSegmentChange(segmentKey);
      return;
    }
    const targetDayKey = current.targetDayKey ?? current.sourceDayKey;
    if (targetDayKey === current.sourceDayKey && current.deltaMinutes === 0) return;

    const toDate = visibleDays.find((d) => localDateKey(d) === targetDayKey);
    if (!toDate) return;

    // Fix 3: dwie ETYKIETY (karty bloków) nigdy nie mogą się nakładać —
    // ANI rdzeniem, ANI obwiednią bufora dojazdu/powrotu. Zamiast dawnego
    // "conflict = abort, over-buffer = pozwól" (co renderowało karty obok
    // siebie w pół szerokości), szukamy najbliższego wolnego miejsca dla
    // PEŁNEJ obwiedni (bufferBefore/bufferAfter tego bloku) i tam lądujemy —
    // dopiero brak jakiegokolwiek wolnego miejsca w dniu abortuje ruch.
    const preview = shiftBlockTime(block, current.deltaMinutes);
    const candidateStart = hhmmToMinutes(preview.startTime);
    const rawEnd = hhmmToMinutes(preview.endTime);
    // ponytail: zawinięcie przez północ liczone jako "do końca doby" tylko na
    // potrzeby TEJ kontroli (nie generuje segmentu dnia następnego jak
    // computeGridSegments) — wystarczające dla wykrycia kolizji w widocznym dniu.
    const candidateEnd = rawEnd <= candidateStart ? 24 * 60 : rawEnd;
    const daySegs = segmentsByDay.get(targetDayKey) ?? [];
    const snappedStart = snapToNearestFreeSlot(daySegs, {
      startMinutes: candidateStart,
      durationMinutes: candidateEnd - candidateStart,
      bufferBefore: block.bufferBefore ?? 0,
      bufferAfter: block.bufferAfter ?? 0,
      excludeBlockId: block.id,
    });
    if (snappedStart === null) {
      console.warn("Przesunięcie zignorowane: brak wolnego miejsca w tym dniu");
      return;
    }

    const patch = buildMovePatch(block, current.fromDay, toDate, current.deltaMinutes + (snappedStart - candidateStart));
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

  function startResizeDrag(
    e: ReactPointerEvent<HTMLDivElement>,
    blockId: string,
    dayKey: string,
    edge: ResizeEdge | BufferResizeEdge,
  ) {
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

    // Fix 4: uchwyt na ZEWNĘTRZNEJ krawędzi (strefa buforu) zmienia
    // bufferBefore/bufferAfter zamiast startTime/endTime — osobna gałąź,
    // reszta funkcji (poniżej) dotyczy WYŁĄCZNIE uchwytów granicy zmiany
    // ("start"/"end"), nietkniętych tym fixem.
    if (current.edge === "buffer-before" || current.edge === "buffer-after") {
      const bufferEdge = current.edge === "buffer-before" ? "before" : "after";
      const field = bufferEdge === "before" ? "bufferBefore" : "bufferAfter";
      const patch = buildBufferResizePatch(block, bufferEdge, current.currentMinutes);
      if (patch[field as keyof typeof patch] === (block[field] ?? 0)) return; // brak zmiany

      startTransition(async () => {
        applyOptimistic({ kind: "patch", id: block.id, patch });
        const res = await fetch(`/api/blocks/${block.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (res.ok) router.refresh();
        else console.error("Nie udało się zmienić bufora bloku", res.status);
      });
      return;
    }

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

        {/* Fix 7: "Linia teraz" i "Znaczniki" przeniesione do /ustawienia
            (nie-częste przełączniki, nie należą do "essentials" toolbara) —
            zastąpione ikoną koła zębatego, tym samym wzorcem kwadratowego
            przycisku ikon-only co Poprzedni/Następny wyżej. Stan
            (showNowLine/boundaryLabelMode) i jego odczyt z localStorage na
            montaż zostają w tym komponencie bez zmian — ustawienia strona
            tylko zapisuje te same klucze, PlannerGrid odczytuje je znowu przy
            następnym mount/nawigacji.
            Fix 3: "ml-auto" (było "ml-2") — koło zębate ląduje na PRAWYM
            końcu toolbara zamiast wśród lewych kontrolek; strefa czasowa
            (dawniej tu, ml-auto) przeniesiona do szyny nawigacji (AppShell),
            patrz komentarz przy "Kalendarz — MVP" tam. */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="ml-auto"
          onClick={() => router.push("/ustawienia")}
          aria-label="Ustawienia"
        >
          <Settings />
        </Button>
      </div>

      {/* Jedyny scrollowany kontener (pion + poziom, gdy 7 dni szersze niż
          viewport) — toolbar wyżej celowo POZA nim, patrz komentarz przy nim.
          Fix 6: ref do niego — auto-scroll na montaż ustawia scrollTop tego
          diva (patrz efekt przy segmentsByDay wyżej). */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto">
        {/* Fix 1 (feedback): osobny wrapper "w-max min-w-full" (zamiast
            "relative flex flex-1" wprost na kontenerze scrolla wyżej) — kotwica
            dla overlay linii focusa niżej MUSI mieć szerokość PRAWDZIWEJ
            zawartości (oś + wszystkie dni, np. 952px), nie tylko widocznego
            (przewijalnego) fragmentu kontenera scrolla (np. 742px, gdy 7 dni
            nie mieści się w viewport) — inaczej linie ucinałyby się na
            krawędzi widoku zamiast sięgać do ostatniej kolumny dnia.
            "min-w-full": gdy zawartość węższa niż viewport (np. widok "Dzień"),
            wrapper i tak wypełnia całą dostępną szerokość jak dawniej. */}
        <div className="relative flex w-max min-w-full">
        <div className="w-14 shrink-0">
          {/* sticky: ta sama logika co nagłówek dnia obok — trzyma pusty
              nagłówek kolumny godzin w miejscu przy pionowym scrollu, żeby
              liczby godzin nie "wjeżdżały" pod przyklejone nagłówki dni.
              Fix (stacking): z-50 (było z-20) — musi maskować WSZYSTKIE
              overlaye w treści (linie focusa/łącznik "teraz" z-10, popover
              z-40), inaczej scrollowane pod spód linie/etykiety malują się
              NAD sticky nagłówkiem zamiast znikać pod nim, patrz komentarz
              przy overlayach niżej. */}
          <div className="sticky top-0 z-50 h-12 border-b border-border bg-bg-secondary" />
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
                    bez potrzeby liczenia wysokości toolbara. Fix (stacking):
                    z-50 (było z-20) — musi maskować WSZYSTKIE overlaye w
                    treści (karty z-10/z-20, popover z-40, linie focusa/
                    łącznik "teraz" z-10), inaczej przy scrollu w dół
                    (wcześniejsze godziny "wjeżdżają" pod nagłówek) te
                    elementy malowałyby się NAD sticky paskiem zamiast znikać
                    pod nim. */}
                <div className="sticky top-0 z-50 flex h-12 flex-row items-center justify-center gap-2 border-b border-border bg-bg-secondary text-body">
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

                    // Fix 4: podgląd LIVE przy przeciąganiu zewnętrznej
                    // krawędzi bufora (ten sam segment, ta sama logika co
                    // resizePreview wyżej, tylko dla "buffer-before"/
                    // "buffer-after" zamiast "start"/"end").
                    const bufferResizePreview =
                      resizingHere &&
                      resizingHere.blockId === segment.blockId &&
                      (resizingHere.edge === "buffer-before" || resizingHere.edge === "buffer-after")
                        ? resizingHere
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
                    const { bufferBefore, bufferAfter } = findMergedBuffers(segment, daySegments);

                    const segmentKey = segmentFocusKey(segment);
                    const block = blocksById.get(segment.blockId);

                    return (
                      <BlockCard
                        key={`${segment.blockId}-${dayKey}-${i}`}
                        segment={segment}
                        isBeingDragged={moveDrag?.isDragging === true && moveDrag.blockId === segment.blockId}
                        resizePreviewMinutes={resizePreview}
                        resizeEdge={resizePreview !== null ? (resizingHere!.edge as ResizeEdge) : null}
                        bufferBeforeStartMinutes={bufferBefore?.startMinutes}
                        bufferAfterEndMinutes={bufferAfter?.endMinutes}
                        bufferResizePreviewMinutes={bufferResizePreview?.currentMinutes ?? null}
                        bufferResizeEdge={bufferResizePreview ? (bufferResizePreview.edge as "buffer-before" | "buffer-after") : null}
                        overnightCaption={computeOvernightCaption(segment, block, segmentsByDay)}
                        // Zmiana 3: ikona Repeat w rogu karty tylko dla bloków
                        // CYKLICZNYCH (startDate puste — "do odwołania") —
                        // jednorazowe (startDate ustawiony na konkretny dzień)
                        // jej nie dostają, patrz DESIGN.md Shapes.
                        isRecurring={!block?.startDate}
                        segmentKey={segmentKey}
                        // Fix 3: WSZYSTKIE karty tego blockId (nie tylko
                        // kliknięty segment) dostają pierścień focusa —
                        // wszystkie instancje tygodniowe + scalone bufory.
                        isFocused={segment.blockId === focusedBlockId}
                        note={block?.note ?? null}
                        // Faza "overnight" (okres do wyjazdu) nie ma jeszcze
                        // własnego pola do edycji przez przeciąganie
                        // (to nie startTime/endTime bloku, tylko
                        // departureTime) — bez blokady przeciągnięcie tej
                        // krawędzi po cichu nadpisałoby endTime błędną
                        // wartością. Godziny samej zmiany ("shift") nadal
                        // rozciągalne jak wcześniej.
                        canResizeStart={segment.phase === "shift" && isEdgeResizable(segment, "start")}
                        canResizeEnd={segment.phase === "shift" && isEdgeResizable(segment, "end")}
                        // Fix 4: uchwyt zewnętrznej krawędzi bufora — tylko
                        // gdy strefa RZECZYWIŚCIE istnieje (bufferBefore/
                        // bufferAfter niżej), żeby nie nachodzić na uchwyt
                        // granicy zmiany, kiedy bufor ma zerową długość
                        // (wtedy obie krawędzie pokrywałyby się w tym samym
                        // miejscu — 0% wysokości strefy). ponytail: "dodanie"
                        // bufora przez przeciągnięcie z zera nie jest jeszcze
                        // wspierane (brak uchwytu przy zerowym buforze) —
                        // upgrade, gdyby użytkownik tego potrzebował.
                        canResizeBufferBefore={segment.phase === "shift" && isEdgeResizable(segment, "start") && !!bufferBefore}
                        canResizeBufferAfter={segment.phase === "shift" && isEdgeResizable(segment, "end") && !!bufferAfter}
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
                          if (block) void endMoveDrag(block, segmentKey);
                        }}
                        onResizeStart={(e, edge) => startResizeDrag(e, segment.blockId, dayKey, edge)}
                        onResizeMove={moveResizeDrag}
                        onResizeUp={(e) => {
                          if (block) void endResizeDrag(e, block);
                        }}
                      />
                    );
                  })}
                  {movePreview &&
                    (() => {
                      // Fix 5: podgląd przeciągania pokazuje CAŁĄ obwiednię
                      // (dojazd + zmiana + odjazd), nie tylko rdzeń zmiany —
                      // to cały ten zakres jest zarezerwowanym czasem po
                      // upuszczeniu (patrz snapToNearestFreeSlot, który już
                      // liczy kolizje po obwiedni). Bufory rozciągają się od
                      // shiftowanych (o deltaMinutes) godzin start/end tego
                      // samego bloku — ten sam draggedBlock co movePreview
                      // wyżej w tej samej kolumnie dnia.
                      const previewStart = hhmmToMinutes(movePreview.startTime);
                      const rawEnd = hhmmToMinutes(movePreview.endTime);
                      const previewEnd = rawEnd <= previewStart ? 24 * 60 : rawEnd;
                      const envelopeTop = Math.max(0, previewStart - (draggedBlock?.bufferBefore ?? 0));
                      const envelopeBottom = Math.min(24 * 60, previewEnd + (draggedBlock?.bufferAfter ?? 0));
                      return (
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-x-1 z-20 overflow-hidden rounded-sm border border-dashed border-text-primary bg-text-primary/10 px-2 py-1 text-caption font-caption"
                          style={{
                            top: `${(envelopeTop / 1440) * 100}%`,
                            height: `${(Math.max(15, envelopeBottom - envelopeTop) / 1440) * 100}%`,
                          }}
                        >
                          <div className="tabular-nums text-text-primary">
                            {movePreview.startTime}–{movePreview.endTime}
                          </div>
                        </div>
                      );
                    })()}
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
                      // -translate-y-1/2: kontener ma wysokość kropki (8px) —
                      // bez przesunięcia jego GÓRNA krawędź siedziała na
                      // pozycji czasu, a środek kropki 4px niżej niż biały
                      // łącznik po lewej. Teraz środek kropki = dokładna
                      // pozycja czasu = oś białego łącznika i czerwonej linii.
                      className="pointer-events-none absolute right-0 left-0 z-10 flex -translate-y-1/2 items-center"
                      style={{ top: `${nowTop}%` }}
                      aria-hidden="true"
                    >
                      <span className="-ml-1 h-2 w-2 shrink-0 rounded-full bg-danger" />
                      {/* Fix 6: odcinek NA PRAWO od kropki (przez kolumnę
                          dzisiejszego dnia) jest teraz PEŁNY (był przerywany) —
                          border-t na elemencie 0-wysokości, bez border-dashed
                          daje lity pasek bg-danger. Łącznik OD osi DO kropki
                          (lewa strona, przez ewentualne wcześniejsze dni
                          tygodnia) renderuje się osobno na poziomie overlayu
                          linii focusa, patrz niżej — ten div sięga tylko do
                          lewej krawędzi TEJ kolumny (left-0), nie do osi. */}
                      <span className="h-0 flex-1 border-t border-danger" />
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

        {/* Fix 6: łącznik OD osi godzin DO kropki linii "teraz" (lewa krawędź
            kolumny "dziś") — biały, przerywany, rozciąga się przez
            ewentualne wcześniejsze dni widocznego tygodnia. Ten sam poziom
            overlayu ("w-max min-w-full" wrapper, top = sticky nagłówek +
            spacer) co linie prowadzące focusa niżej — stąd ta sama matematyka
            ułamka szerokości (dayIndex/liczba dni, BEZ +1: kończy się na
            LEWEJ krawędzi kolumny dziś, nie na jej prawej, żeby nie zachodzić
            na już wyrenderowany pełny czerwony odcinek w tej kolumnie).
            Fix 2 (z-index): z-10 (było z-30) — ten sam poziom co karty
            zwykłe/w-kolumnie czerwona linia "teraz", więc łącznik maluje się
            NAD paskami niedostępności (bez z-index/tło) i pod QuickCreatePopover
            (z-40) oraz pod sticky nagłówkami (z-50) zamiast nad nimi. */}
        {showNowLine && now !== null && todayDayIndex !== -1 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 z-10"
            style={{ top: `calc(3rem + ${TOP_SPACER_REM}rem)`, height: `${hourHeightRem * 24}rem` }}
          >
            <div
              className="absolute -translate-y-1/2 border-t border-dashed border-text-primary"
              style={{
                top: `${nowTop}%`,
                left: "3.5rem",
                width: `calc((100% - 3.5rem) * ${todayDayIndex / visibleDays.length})`,
              }}
            />
          </div>
        )}

        {/* Fix 1 (feedback): linie prowadzące focusa na CAŁĄ szerokość
            (oś godzin + wszystkie dni, patrz "w-max min-w-full" wrapper
            wyżej — dzięki niemu inset-x-0 tutaj sięga prawdziwej szerokości
            zawartości, nie tylko przewijalnego fragmentu), jeden element
            zamiast osobnego markera w każdej kolumnie dnia. "top" offsetu =
            sticky nagłówek dnia/osi (h-12 = 3rem) + spacer nad godziną 00:00
            (TOP_SPACER_REM) — dokładnie ten sam punkt zero co siatka godzin w
            osi i w data-grid-body każdego dnia (oba poprzedzone identycznym
            nagłówkiem+spacerem w normalnym flow, patrz te elementy wyżej).
            Fix 2 (z-index, ten sam bug co łącznik "teraz" wyżej): z-10 (było
            z-30) — nie mogą już malować się NAD QuickCreatePopover (z-40) ani
            nad sticky nagłówkami (z-50). */}
        {focusedGeometry && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 z-10"
            style={{ top: `calc(3rem + ${TOP_SPACER_REM}rem)`, height: `${hourHeightRem * 24}rem` }}
          >
            {focusedGeometry.boundaries.map((minutes, i) => {
              // Zmiana 4: linia sięga tylko do prawej krawędzi kolumny
              // wyfokusowanego dnia (nie całego tygodnia) — ponytail: ułamek
              // liczony wprost z pozycji dnia w visibleDays, zakłada że
              // kolumny dzielą pozostałą (po osi) szerokość równo (prawdziwe
              // dopóki min-w-32 na kolumnę nie wymusza poziomego scrolla);
              // upgrade do dokładnego rect z daysWrapperRef, gdyby to się
              // okazało zauważalnie niedokładne na wąskich ekranach.
              const dayRightFraction = (focusedGeometry.dayIndex + 1) / visibleDays.length;
              const colorVar = TYPE_COLOR_VAR[focusedGeometry.type] ?? "--color-overnight-block";
              // Fix 1 (poprzednia wersja renderowała WSZYSTKIE linie zawsze i
              // filtrowała tylko etykiety — użytkownik zgłosił, że tryb
              // "skrajne" ma pokazywać TYLKO obwiednię karty, linie środkowe
              // (start/koniec samej zmiany) też znikają, nie tylko ich
              // etykiety): "skrajne" renderuje wyłącznie pierwszą i ostatnią
              // granicę (linia + etykieta razem), "wszystkie" — komplet.
              const isOuterBoundary = i === 0 || i === focusedGeometry.boundaries.length - 1;
              const showBoundary = boundaryLabelMode === "all" || isOuterBoundary;
              return (
                <Fragment key={minutes}>
                  {showBoundary && (
                    <>
                      {/* Fix 5b (odziedziczone): etykieta HUGA treść (bez
                          stałego w-14/text-right, jak czerwona etykieta
                          "teraz") — prawa krawędź kotwiczona dokładnie w
                          miejscu, gdzie zaczynała się przy stałej szerokości
                          (left: 3.5rem = start kreskowanej linii),
                          -translate-x-full ciągnie box w lewo od tej
                          krawędzi, więc rośnie w kierunku osi zamiast
                          zachodzić na siatkę dni. */}
                      <span
                        className="tabular-nums absolute top-0 z-10 -translate-x-full -translate-y-1/2 rounded-sm border bg-surface px-1 text-caption font-caption font-medium"
                        style={{ top: `${(minutes / 1440) * 100}%`, left: "3.5rem", borderColor: `var(${colorVar})`, color: `var(${colorVar})` }}
                      >
                        {minutesToHHMM(minutes)}
                      </span>
                      <div
                        className="absolute border-t border-dashed"
                        style={{
                          top: `${(minutes / 1440) * 100}%`,
                          left: "3.5rem",
                          width: `calc((100% - 3.5rem) * ${dayRightFraction})`,
                          borderColor: `var(${colorVar})`,
                        }}
                      />
                    </>
                  )}
                </Fragment>
              );
            })}
          </div>
        )}
        </div>
      </div>
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
  bufferResizePreviewMinutes,
  bufferResizeEdge,
  canResizeBufferBefore,
  canResizeBufferAfter,
  overnightCaption,
  isRecurring,
  isFocused,
  note,
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
  /** Fix 4: minuty pod kursorem podczas przeciągania ZEWNĘTRZNEJ krawędzi bufora — null poza tym drag. */
  bufferResizePreviewMinutes: number | null;
  /** Fix 4: która zewnętrzna krawędź jest aktualnie przeciągana (null poza tym drag). */
  bufferResizeEdge: "buffer-before" | "buffer-after" | null;
  /** Fix 4: uchwyt na górze strefy dojazdu — tylko gdy ta strefa istnieje (bufferBeforeStartMinutes zdefiniowane). */
  canResizeBufferBefore: boolean;
  /** Fix 4: uchwyt na dole strefy odjazdu — tylko gdy ta strefa istnieje (bufferAfterEndMinutes zdefiniowane). */
  canResizeBufferAfter: boolean;
  overnightCaption: string | null;
  /** Zmiana 3: brak startDate na bloku = cykliczny "do odwołania" — dostaje ikonę Repeat w rogu karty. */
  isRecurring: boolean;
  /** Fix 3: ta karta należy do wyfokusowanego bloku (dowolna instancja/scalony bufor) — dostaje pierścień w kolorze własnego typu. */
  isFocused: boolean;
  /** Fix 2b: notatka bloku — dodatkowa linia, tylko gdy karta ma na to miejsce (patrz isCompactCore niżej). */
  note: string | null;
  segmentKey: string;
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onResizeStart: (e: ReactPointerEvent<HTMLDivElement>, edge: ResizeEdge | "buffer-before" | "buffer-after") => void;
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
  // Fix 4: przy aktywnym drag zewnętrznej krawędzi bufora podglądamy nową
  // granicę na żywo (clamp do granicy zmiany — bufor wizualnie nie może
  // "przejechać" na drugą stronę startu/końca zmiany, ten sam clamp co
  // serwerowy buildBufferResizePatch robi finalnie przy >=0).
  const mergedTop =
    bufferResizeEdge === "buffer-before" && bufferResizePreviewMinutes !== null
      ? Math.min(startMinutes, bufferResizePreviewMinutes)
      : (bufferBeforeStartMinutes ?? startMinutes);
  const mergedBottom =
    bufferResizeEdge === "buffer-after" && bufferResizePreviewMinutes !== null
      ? Math.max(endMinutes, bufferResizePreviewMinutes)
      : (bufferAfterEndMinutes ?? endMinutes);
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

  // Fix 3: pierścień focusa w kolorze WŁASNEGO typu bloku — ta sama zmienna
  // co poświata/pasek akcentu (glowColorVar) — boxShadow zamiast Tailwind
  // ring-*, żeby nie kolidować o --tw-ring-color z resztą inline stylów karty.
  const focusRingStyle = isFocused ? ({ boxShadow: `0 0 0 2px var(${glowColorVar})` } as CSSProperties) : undefined;
  // Fix 2: przy focusie obramowanie ma być SYMETRYCZNE na wszystkich
  // krawędziach (pierścień boxShadow wyżej przejmuje rolę nośnika koloru) —
  // zamiast zmieniać szerokość border-l-[3px] (co przesunęłoby treść karty o
  // 2px, patrz padding liczony od krawędzi obramowania), zostawiamy szerokość
  // bez zmian i tylko maskujemy KOLOR lewej krawędzi na przezroczysty. Bez
  // zmiany szerokości -> zero layout jumpu przy wejściu/wyjściu z focusa.
  const focusBorderStyle = isFocused ? ({ borderLeftColor: "transparent" } as CSSProperties) : undefined;

  // Task A/B: realny czas trwania (minuty) stref kreskowanych dojazdu/odjazdu
  // — pod etykietami "Dojazd"/"Odjazd" niżej; ukrywamy etykietę poniżej ~20
  // minut wysokości, żeby tekst się zmieścił (patrz guard przy renderze).
  const beforeZoneMinutes = startMinutes - mergedTop;
  const afterZoneMinutes = mergedBottom - endMinutes;
  // Policzone RAZ (nie inline dwa razy w JSX niżej) — poza ponytail-DRY,
  // TypeScript inaczej nie zawęża "hidden" | "compact" | "full" do
  // "compact" | "full" dla formatBufferLabel mimo identycznego guardu obok.
  const beforeLabelMode = bufferLabelMode(beforeZoneMinutes);
  const afterLabelMode = bufferLabelMode(afterZoneMinutes);
  // Fix 3: karta zbyt krótka na 3 linie tekstu (nazwa + godziny + typ) traci
  // najmniej istotną (typ) i dostaje ciaśniejszy padding pionowy — stały
  // py-2 (8px) na karcie wysokości np. 24px "zjadał" 1/3 miejsca samym
  // paddingiem, przez co widoczny tekst wyglądał jakby zaczynał się w
  // połowie karty zamiast od góry. Pełne info i tak dostępne przez focus
  // (Fix 2 — SegmentFocusPanel), więc ucięcie trzeciej linii nic nie traci.
  const isCompactCore = endMinutes - startMinutes < 45;

  return (
    <div
      data-segment-key={segmentKey}
      className={`absolute touch-none overflow-hidden rounded-sm border border-l-[3px] border-border transition-shadow duration-200 ease-out motion-reduce:transition-none ${isOvernightPhase ? "z-0" : segment.overBuffer ? "z-20" : "z-10"} ${accentClass} ${fillClass} ${
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
        ...focusBorderStyle,
        ...focusRingStyle,
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
          {/* Fix (etykiety buforu, format podpisany): znak "−" niesie
              kierunek "dojazd" sam w sobie — słowo "Dojazd" celowo pominięte
              na obu poziomach szczegółowości (compact i full), patrz
              DESIGN.md. Godzina graniczna = mergedTop (start tej strefy). */}
          {beforeLabelMode !== "hidden" && (
            <span className={textClass}>{formatBufferLabel("before", beforeZoneMinutes, minutesToHHMM(mergedTop), beforeLabelMode)}</span>
          )}
        </div>
      )}
      {corePercentBottom < 100 && (
        <div
          aria-hidden="true"
          className="buffer-stripes pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-start pl-2 text-caption font-caption"
          style={{ height: `${100 - corePercentBottom}%`, "--stripe-color": stripeColor } as CSSProperties}
        >
          {afterLabelMode !== "hidden" && (
            <span className={textClass}>{formatBufferLabel("after", afterZoneMinutes, minutesToHHMM(mergedBottom), afterLabelMode)}</span>
          )}
        </div>
      )}
      {/* Fix 4: uchwyt na SAMEJ GÓRZE strefy dojazdu (top: 0%) — zmienia
          bufferBefore, w odróżnieniu od uchwytu granicy zmiany niżej
          (corePercentTop%, zmienia startTime). Renderuje się tylko gdy
          strefa faktycznie istnieje (canResizeBufferBefore), więc nigdy nie
          pokrywa się z uchwytem granicy zmiany przy zerowym buforze. */}
      {canResizeBufferBefore && (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 z-10 h-2 cursor-ns-resize"
          onPointerDown={(e) => onResizeStart(e, "buffer-before")}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeUp}
        />
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
          {/* Zmiana 3: marker "cykliczny" (bez konkretnej daty) — ukryty na
              zbyt krótkich kartach, ten sam próg co trzecia linia (typ)
              niżej, patrz DESIGN.md Shapes. */}
          {isRecurring && !isCompactCore && (
            <Repeat aria-hidden="true" className={`pointer-events-none absolute top-1 right-1 h-3 w-3 opacity-70 ${textClass}`} />
          )}
          <div className="truncate pr-4 font-medium">
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
          {/* Fix 2b: notatka jako dodatkowa linia — tylko gdy karta ma miejsce
              (ten sam próg co linia typu wyżej), żeby nie zjadać miejsca na
              już i tak ciasnych kartach. */}
          {!isCompactCore && note && <div className="truncate opacity-75">{note}</div>}
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
      {/* Fix 4: uchwyt na SAMYM DOLE strefy odjazdu (bottom: 0%) — zmienia
          bufferAfter, symetrycznie do uchwytu bufferBefore na górze. */}
      {canResizeBufferAfter && (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 z-10 h-2 cursor-ns-resize"
          onPointerDown={(e) => onResizeStart(e, "buffer-after")}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeUp}
        />
      )}
    </div>
  );
}

