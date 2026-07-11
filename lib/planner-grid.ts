import { getInstances } from "./recurrence";
import type { AvailabilityDay } from "./availability";

export type PlannerBlock = {
  id: string;
  name: string;
  type: string;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  endDate: Date | string | null;
  startDate?: Date | string | null;
  isPaused?: boolean;
  staysOvernight?: boolean;
  bufferBefore?: number;
  bufferAfter?: number;
  departureTime?: Date | string | null;
  // Jawny, niezależny start okresu noclegu (odsprzęgnięty od końca zmiany) —
  // patrz komentarz przy hasOvernightExtension w computeGridSegments.
  overnightStart?: Date | string | null;
  exceptions?: {
    date: Date | string;
    startTime?: string | null;
    endTime?: string | null;
    cancelled?: boolean;
  }[];
};

export type GridSegment = {
  blockId: string;
  name: string;
  type: string;
  staysOvernight: boolean;
  // "shift" = godziny samej zmiany (startTime..endTime); "overnight" = okres
  // po zmianie do wyjazdu (departureTime), osobny wizualnie element — patrz
  // komentarz przy pętli niżej; "buffer" = bufor dojazdu/powrotu
  // (bufferBefore/bufferAfter), tło pod kartą, patrz komentarz niżej.
  phase: "shift" | "overnight" | "buffer";
  // Tylko dla phase "buffer": czy to bufor przed zmianą (dojazd), po
  // zmianie/noclegu (powrót/odjazd), czy dojazd do MIEJSCA NOCLEGU (luka
  // jawna między końcem zmiany a overnightStart — patrz komentarz przy
  // hasExplicitGap w computeGridSegments).
  bufferKind?: "before" | "after" | "overnight-before";
  day: string; // "YYYY-MM-DD", local
  startMinutes: number; // minutes since local midnight, 0..1440
  endMinutes: number; // minutes since local midnight, 0..1440 (> startMinutes)
  continuesFromPrevDay: boolean; // segment zaczyna się dokładnie o północy, a ciąg dalszy zaczął się wcześniej
  continuesToNextDay: boolean; // segment kończy się dokładnie o północy, a ciąg dalszy trwa dalej
};

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** Poniedziałek..niedziela tygodnia zawierającego `anchor` (lokalna strefa czasowa). */
export function getWeekDays(anchor: Date): Date[] {
  const monday = new Date(anchor);
  monday.setHours(0, 0, 0, 0);
  const isoDayOfWeek = (monday.getDay() + 6) % 7; // pon=0 .. niedz=6
  monday.setDate(monday.getDate() - isoDayOfWeek);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
}

export function computeGridSegments(
  blocks: PlannerBlock[],
  rangeStart: Date,
  rangeEnd: Date,
): GridSegment[] {
  const segments: GridSegment[] = [];

  for (const block of blocks) {
    const instances = getInstances(
      {
        startTime: block.startTime,
        endTime: block.endTime,
        daysOfWeek: block.daysOfWeek,
        endDate: block.endDate ? toDate(block.endDate) : null,
        startDate: block.startDate ? toDate(block.startDate) : null,
        isPaused: block.isPaused,
      },
      rangeStart,
      rangeEnd,
      (block.exceptions ?? []).map((e) => ({
        date: toDate(e.date),
        startTime: e.startTime,
        endTime: e.endTime,
        cancelled: e.cancelled,
      })),
    );

    for (const instance of instances) {
      // Nocleg w pracy: wyjazd może wypaść kilka dni po naturalnym końcu
      // zmiany (nie tylko następnej nocy) — ten sam warunek co
      // lib/gap-finding.ts#busyInterval. Gdy wyjazd faktycznie rozciąga
      // pobyt poza koniec zmiany, dzielimy na dwie fazy: "shift" (godziny
      // pracy, normalny kolor typu, bez kreskowania) i "overnight" (czas do
      // wyjazdu, osobny element z etykietą "Nocleg") — użytkownik chciał,
      // żeby to nie był jeden zlepiony blok. Bez wyjazdu (albo wyjazd <=
      // koniec zmiany, np. zwykła nocna zmiana 17:00–02:00) wszystko zostaje
      // jedną fazą "shift" — bez zmiany w zachowaniu sprzed tej funkcji.
      const departure = block.staysOvernight && block.departureTime ? toDate(block.departureTime) : null;
      const hasOvernightExtension = !!(departure && departure > instance.end);
      const instanceEnd = hasOvernightExtension ? departure! : instance.end;

      // Jawny start noclegu (Change 3): domyślnie nocleg zaczyna się dokładnie
      // na końcu zmiany (stare zachowanie, gdy pole nieustawione — zero zmian
      // w istniejących testach). Gdy ustawiony, przycięty (clamp) do
      // instance.end w razie błędnych danych (user ustawił go PRZED końcem
      // zmiany) — ujemna luka nie ma sensu, więc po prostu wracamy do starego
      // zachowania w tym przypadku.
      const overnightStart =
        hasOvernightExtension && block.overnightStart
          ? (() => {
              const raw = toDate(block.overnightStart!);
              return raw > instance.end ? raw : instance.end;
            })()
          : null;
      // Jawna luka = overnightStart faktycznie przesunięty poza instance.end
      // (nie przycięty z powrotem do niego wyżej) — tylko wtedy ma sens
      // osobny bufor "dojazd do noclegu" (Task B): dojazd DO miejsca
      // noclegu, gdy ono nie jest tym samym miejscem co koniec zmiany.
      const hasExplicitGap = !!(overnightStart && overnightStart.getTime() > instance.end.getTime());

      let cursor = instance.start;
      while (cursor < instanceEnd) {
        // Skok przez lukę między końcem zmiany a jawnym startem noclegu —
        // luka nie dostaje żadnego segmentu (po prostu nic tam nie renderuje
        // się na siatce).
        if (overnightStart && cursor.getTime() === instance.end.getTime() && overnightStart > cursor) {
          cursor = overnightStart;
          if (cursor >= instanceEnd) break;
        }

        const dayStart = new Date(cursor);
        dayStart.setHours(0, 0, 0, 0);
        const nextDayStart = new Date(dayStart);
        nextDayStart.setDate(nextDayStart.getDate() + 1);
        // Blok typu "overnight" (Fix 3: nocleg jako osobny typ) jest CAŁY
        // fazą "overnight" — nie tylko część po departureTime jak przy
        // staysOvernight na zmianie roboczej. To automatycznie daje mu
        // wszystkie istniejące zachowania fazy overnight (wyłączony z
        // layoutOverlaps column-packing, ignorowany przez classifyOverlap,
        // z-0, tint+glow, bez tekstu) bez dotykania tamtego kodu.
        const phase: "shift" | "overnight" =
          block.type === "overnight" ? "overnight" : cursor < instance.end ? "shift" : "overnight";
        // Granica fazy (koniec zmiany) tnie segment tak samo jak granica
        // doby — dzięki temu "shift" i "overnight" tego samego dnia
        // wychodzą jako dwa sąsiadujące segmenty zamiast jednego.
        const phaseBoundary = phase === "shift" ? instance.end : instanceEnd;
        const segmentEnd = phaseBoundary < nextDayStart ? phaseBoundary : nextDayStart;
        const isMidnightCut = segmentEnd.getTime() === nextDayStart.getTime();

        segments.push({
          blockId: block.id,
          name: block.name,
          type: block.type,
          staysOvernight: phase === "overnight" || (!!block.staysOvernight && !hasOvernightExtension),
          phase,
          day: localDateKey(dayStart),
          startMinutes: minutesSinceMidnight(cursor),
          endMinutes: isMidnightCut ? 24 * 60 : minutesSinceMidnight(segmentEnd),
          // "Ciąg dalszy" tylko na prawdziwej granicy doby (cięcie o
          // północy) — cięcie w połowie dnia na granicy faz (koniec zmiany
          // = początek noclegu) to sąsiedztwo, nie kontynuacja.
          continuesFromPrevDay: cursor.getTime() === dayStart.getTime() && dayStart.getTime() > instance.start.getTime(),
          continuesToNextDay: isMidnightCut && nextDayStart.getTime() < instanceEnd.getTime(),
        });

        cursor = segmentEnd;
      }

      // Bufory dojazdu/powrotu (dojazd przed zmianą, powrót po zmianie —
      // a przy noclegu z rozciągniętym pobytem: po WYJEŹDZIE, nie po końcu
      // zmiany, bo osoba wraca do domu po departureTime — instanceEnd już to
      // uwzględnia, patrz wyżej). ponytail: przycinamy do granic doby zamiast
      // dzielić na segmenty jak "overnight" — bufor to zwykle kilka-kilkadziesiąt
      // minut, rzadko realnie przechodzi przez północ; upgrade analogiczny do
      // pętli "overnight" wyżej, gdyby to się okazało potrzebne.
      const bufferBefore = block.bufferBefore ?? 0;
      const bufferAfter = block.bufferAfter ?? 0;

      if (bufferBefore > 0) {
        const dayStart = new Date(instance.start);
        dayStart.setHours(0, 0, 0, 0);
        const rawStart = new Date(instance.start.getTime() - bufferBefore * 60000);
        const clippedStart = rawStart < dayStart ? dayStart : rawStart;
        segments.push({
          blockId: block.id,
          name: block.name,
          type: block.type,
          staysOvernight: false,
          phase: "buffer",
          bufferKind: "before",
          day: localDateKey(dayStart),
          startMinutes: minutesSinceMidnight(clippedStart),
          endMinutes: minutesSinceMidnight(instance.start),
          continuesFromPrevDay: false,
          continuesToNextDay: false,
        });
      }

      if (bufferAfter > 0) {
        const dayStart = new Date(instanceEnd);
        dayStart.setHours(0, 0, 0, 0);
        const nextDayStart = new Date(dayStart);
        nextDayStart.setDate(nextDayStart.getDate() + 1);
        const rawEnd = new Date(instanceEnd.getTime() + bufferAfter * 60000);
        const clippedEnd = rawEnd > nextDayStart ? nextDayStart : rawEnd;
        const isMidnightCut = clippedEnd.getTime() === nextDayStart.getTime();
        segments.push({
          blockId: block.id,
          name: block.name,
          type: block.type,
          staysOvernight: false,
          phase: "buffer",
          bufferKind: "after",
          day: localDateKey(dayStart),
          startMinutes: minutesSinceMidnight(instanceEnd),
          endMinutes: isMidnightCut ? 24 * 60 : minutesSinceMidnight(clippedEnd),
          continuesFromPrevDay: false,
          continuesToNextDay: false,
        });
      }

      // Dojazd do miejsca noclegu (Task B): tylko gdy jest jawna luka między
      // koniec zmiany i overnightStart (patrz hasExplicitGap wyżej) — bez
      // luki nocleg zaczyna się dokładnie w miejscu pracy, więc "dojazd" nie
      // ma sensu. Kończy się dokładnie na overnightStart, przycięty tak, żeby
      // NIGDY nie wchodzić na rdzeń zmiany (floor = instance.end).
      if (hasExplicitGap && bufferBefore > 0) {
        const dayStart = new Date(overnightStart!);
        dayStart.setHours(0, 0, 0, 0);
        const rawStart = new Date(overnightStart!.getTime() - bufferBefore * 60000);
        const floored = rawStart < instance.end ? instance.end : rawStart;
        const clippedStart = floored < dayStart ? dayStart : floored;
        segments.push({
          blockId: block.id,
          name: block.name,
          type: block.type,
          staysOvernight: false,
          phase: "buffer",
          bufferKind: "overnight-before",
          day: localDateKey(dayStart),
          startMinutes: minutesSinceMidnight(clippedStart),
          endMinutes: minutesSinceMidnight(overnightStart!),
          continuesFromPrevDay: false,
          continuesToNextDay: false,
        });
      }
    }
  }

  return segments;
}

export type LaidOutSegment = GridSegment & { col: number; colCount: number; overBuffer?: boolean };

/** Czy dwa zakresy [startMinutes, endMinutes) nakładają się w czasie. */
function rangesOverlap(
  a: { startMinutes: number; endMinutes: number },
  b: { startMinutes: number; endMinutes: number },
): boolean {
  return a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
}

/**
 * Nakładające się w czasie segmenty tego samego dnia dostają osobne kolumny,
 * żeby renderować się obok siebie zamiast jeden na drugim.
 *
 * Kolumny liczone PER-KLASTER nakładania (Task C): segmenty grupujemy w
 * klastry transitywnie (A nakłada B, B nakłada C -> A,B,C w jednym klastrze),
 * kolumny liczone osobno w każdym klastrze — jedna nakładająca się para w
 * dniu nie wpływa już na colCount niezależnych, nienakładających się kart
 * tego samego dnia (poprzedni ponytail: liczone globalnie dla całego dnia).
 */
export function layoutOverlaps(segments: GridSegment[]): LaidOutSegment[] {
  // Nocleg i bufory dojazdu/powrotu to tło na całą szerokość dnia — karty
  // renderują się nad nimi, więc nie biorą udziału w podziale na kolumny.
  const background = segments.filter((s) => s.phase === "overnight" || s.phase === "buffer");
  const overnight = background.map((s) => ({ ...s, col: 0, colCount: 1 }));
  const bufferSegments = background.filter((s) => s.phase === "buffer");
  const sorted = segments
    .filter((s) => s.phase !== "overnight" && s.phase !== "buffer")
    .sort((a, b) => a.startMinutes - b.startMinutes);

  const clusters: GridSegment[][] = [];
  let clusterEnd = -Infinity;
  for (const seg of sorted) {
    if (clusters.length === 0 || seg.startMinutes >= clusterEnd) {
      clusters.push([seg]);
    } else {
      clusters[clusters.length - 1].push(seg);
    }
    clusterEnd = Math.max(clusterEnd, seg.endMinutes);
  }

  const placed: (GridSegment & { col: number; colCount: number })[] = [];
  for (const cluster of clusters) {
    const columnEnds: number[] = [];
    const clusterPlaced: (GridSegment & { col: number })[] = [];
    for (const seg of cluster) {
      let col = columnEnds.findIndex((end) => end <= seg.startMinutes);
      if (col === -1) col = columnEnds.length;
      columnEnds[col] = seg.endMinutes;
      clusterPlaced.push({ ...seg, col });
    }
    // Max 2 kolumny na klaster (user: "max 2 etykiety w linii") — trzecia i
    // kolejna nakładająca się karta dzieli kolumnę z pierwszą/drugą zamiast
    // dostawać własną coraz węższą kolumnę (col modulo colCount).
    const colCount = Math.min(2, Math.max(1, columnEnds.length));
    placed.push(...clusterPlaced.map((seg) => ({ ...seg, col: seg.col % colCount, colCount })));
  }

  // Task D3: karta "shift" bez konfliktu zmiana-zmiana, ale nakładająca
  // bufor INNEGO bloku, renderuje się w pół szerokości nad tym buforem
  // (overBuffer: true) — patrz BlockCard. Liczone osobno od klastrowania
  // wyżej (bufory celowo poza podziałem na kolumny).
  const withOverBuffer: LaidOutSegment[] = placed.map((seg) => {
    if (seg.phase !== "shift") return seg;
    const hasShiftConflict = placed.some(
      (o) => o.blockId !== seg.blockId && o.phase === "shift" && rangesOverlap(o, seg),
    );
    if (hasShiftConflict) return seg;
    const overBuffer = bufferSegments.some((b) => b.blockId !== seg.blockId && rangesOverlap(b, seg));
    return overBuffer ? { ...seg, overBuffer: true } : seg;
  });

  return [...overnight, ...withOverBuffer];
}

/**
 * Klasyfikuje kandydata (nowy blok albo przesunięcie/upuszczenie istniejącego)
 * względem segmentów dnia (Task D1) — "conflict" wygrywa nad "over-buffer":
 * osoba nie może robić dwóch rzeczy naraz, ale kolizja tylko z buforem
 * dojazdu/powrotu jest dopuszczalna (renderuje się w pół szerokości, patrz
 * overBuffer w layoutOverlaps). Segmenty "overnight" ignorowane całkowicie —
 * wolno się z nimi nakładać dowolnie.
 */
export function classifyOverlap(
  daySegments: GridSegment[],
  candidate: { startMinutes: number; endMinutes: number; excludeBlockId?: string },
): "conflict" | "over-buffer" | "clear" {
  const others = daySegments.filter((s) => s.blockId !== candidate.excludeBlockId);
  if (others.some((s) => s.phase === "shift" && rangesOverlap(s, candidate))) return "conflict";
  if (others.some((s) => s.phase === "buffer" && rangesOverlap(s, candidate))) return "over-buffer";
  return "clear";
}

/**
 * Ile treści zmieści się w etykiecie strefy dojazdu/odjazdu, w zależności od
 * realnej wysokości strefy (minuty) — "hidden" poniżej 20 min (same paski,
 * bez tekstu, nie ma miejsca), "compact" 20-44 min (jedna linia "{min}min"),
 * "full" od 45 min (dwuwierszowe "Dojazd"/"Odjazd" + "{min}min").
 */
export function bufferLabelMode(minutes: number): "hidden" | "compact" | "full" {
  if (minutes < 20) return "hidden";
  if (minutes < 45) return "compact";
  return "full";
}

/**
 * Granice (minuty od lokalnej północy) do przerywanych linii focusa (Fix 1) —
 * start/koniec samej zmiany zawsze, plus start bufora-przed i/lub koniec
 * bufora-po, jeśli scalona karta je ma (patrz dopasowanie bufferBefore/
 * bufferAfter w PlannerGrid, ta sama para co dla scalonej karty — nie
 * duplikujemy tego dopasowania tutaj). Posortowane rosnąco, bez duplikatów
 * (przypadek zdegenerowany: bufor zerowej długości styka się dokładnie z
 * granicą zmiany).
 */
export function focusBoundaryMinutes(
  segment: { startMinutes: number; endMinutes: number },
  bufferBefore?: { startMinutes: number },
  bufferAfter?: { endMinutes: number },
): number[] {
  const boundaries = new Set<number>([segment.startMinutes, segment.endMinutes]);
  if (bufferBefore) boundaries.add(bufferBefore.startMinutes);
  if (bufferAfter) boundaries.add(bufferAfter.endMinutes);
  return [...boundaries].sort((a, b) => a - b);
}

export const SNAP_MINUTES = 15;

/** Zaokrągla minuty od północy do najbliższych 15 minut i przycina do 0..1440. */
export function snapMinutes(minutes: number, snapTo = SNAP_MINUTES): number {
  const clamped = Math.min(Math.max(minutes, 0), 24 * 60);
  return Math.round(clamped / snapTo) * snapTo;
}

/** Offset w pikselach wewnątrz kolumny dnia -> zaokrąglone minuty od północy. */
export function pixelOffsetToMinutes(offsetPx: number, hourHeightPx: number): number {
  if (hourHeightPx <= 0) return 0;
  return snapMinutes((offsetPx / hourHeightPx) * 60);
}

export function minutesToHHMM(minutesSinceMidnight: number): string {
  const total = Math.min(Math.max(minutesSinceMidnight, 0), 24 * 60);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Czas trwania od `start` do `end` (minuty od północy), zawijając przez północ gdy end<start. Equal start/end = 0 min (nie 24h) — chcemy to złapać jako "za krótko", nie jako pełną dobę. */
function wrapDuration(startMinutes: number, endMinutes: number): number {
  return endMinutes < startMinutes ? endMinutes + 24 * 60 - startMinutes : endMinutes - startMinutes;
}

/** Piksele przeciągnięcia (delta, może być ujemna) -> zaokrąglone minuty. Bez clampowania do 0..1440 (snapMinutes by ucięło ujemne wartości). */
export function pixelDeltaToMinutes(deltaPx: number, hourHeightPx: number, snapTo = SNAP_MINUTES): number {
  if (hourHeightPx <= 0) return 0;
  return Math.round((deltaPx / hourHeightPx) * 60 / snapTo) * snapTo;
}

export type DragRangeDraft = {
  date: string; // YYYY-MM-DD, lokalnie
  dayOfWeek: number; // 0=niedz..6=sob (Date#getDay), zgodnie z daysOfWeek API
  startTime: string; // HH:MM
  endTime: string; // HH:MM
};

/** Zakres przeciągnięcia (piksele -> minuty już policzone) -> gotowy draft do QuickCreatePopover. */
export function dragRangeToDraft(day: Date, minutesA: number, minutesB: number): DragRangeDraft {
  const start = snapMinutes(Math.min(minutesA, minutesB));
  let end = snapMinutes(Math.max(minutesA, minutesB));
  if (end <= start) end = Math.min(start + SNAP_MINUTES, 24 * 60);

  return {
    date: localDateKey(day),
    dayOfWeek: day.getDay(),
    startTime: minutesToHHMM(start),
    endTime: minutesToHHMM(end),
  };
}

export type QuickCreateInput = {
  name: string;
  type: string;
  repeatWeekly: boolean;
  date: string; // YYYY-MM-DD lokalnie
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

/** Lokalna północ danego dnia (YYYY-MM-DD) jako ISO string — format akceptowany przez POST /api/blocks. */
function localDateKeyToIsoMidnight(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toISOString();
}

/** Buduje body dla POST /api/blocks z draftu QuickCreatePopover (jednorazowy albo cykliczny). */
export function buildQuickCreateBody(input: QuickCreateInput) {
  const base = {
    name: input.name,
    type: input.type,
    startTime: input.startTime,
    endTime: input.endTime,
    daysOfWeek: [input.dayOfWeek],
  };
  if (input.repeatWeekly) {
    return { ...base, startDate: null, endDate: null };
  }
  const iso = localDateKeyToIsoMidnight(input.date);
  return { ...base, startDate: iso, endDate: iso };
}

export type BacklogDropInput = {
  name: string;
  durationMinutes: number;
  day: Date;
  startMinutes: number; // niezaokrąglone minuty od północy (np. z pixelOffsetToMinutes) — funkcja sama znapuje
};

/**
 * Buduje body dla POST /api/blocks z pozycji backlogu upuszczonej na siatkę
 * (drag & drop) — jednorazowy blok (nie cykliczny) w miejscu i na czas trwania
 * pozycji backlogu. Typ "personal" na sztywno: BacklogItem nie ma własnego
 * pola type (patrz PlannerSidebar#BacklogItem), a "personal" to najbezpieczniejszy
 * domyślny wybór dla nieoznaczonego zadania z listy "Do zaplanowania".
 */
export function buildBacklogDropBody(input: BacklogDropInput) {
  const start = snapMinutes(input.startMinutes);
  const end = snapMinutes(Math.min(start + input.durationMinutes, 24 * 60));

  return buildQuickCreateBody({
    name: input.name,
    type: "personal",
    repeatWeekly: false,
    date: localDateKey(input.day),
    dayOfWeek: input.day.getDay(),
    startTime: minutesToHHMM(start),
    endTime: minutesToHHMM(end <= start ? Math.min(start + SNAP_MINUTES, 24 * 60) : end),
  });
}

/** Podmienia jeden dzień tygodnia na inny w daysOfWeek, bez duplikatów. */
export function swapWeekday(daysOfWeek: number[], fromDay: number, toDay: number): number[] {
  if (!daysOfWeek.includes(fromDay) || fromDay === toDay) return daysOfWeek;
  const next = new Set(daysOfWeek);
  next.delete(fromDay);
  next.add(toDay);
  return [...next].sort((a, b) => a - b);
}

export type MoveBlockInput = {
  daysOfWeek: number[];
  startDate?: Date | string | null;
  endDate?: Date | string | null;
};

/**
 * Buduje PATCH body dla przeciągnięcia bloku na inny dzień (poziomo).
 *
 * ponytail: dla bloku cyklicznego przesuwa całą serię (podmiana dnia w
 * daysOfWeek), nie pojedynczą instancję — model danych nie ma per-instance
 * przesunięcia dnia, tylko przesunięcie godziny (BlockInstanceException).
 * Upgrade do przesunięcia pojedynczej instancji wymagałby rozszerzenia
 * BlockInstanceException o docelowy dzień.
 */
export function buildMoveBlockPatch(block: MoveBlockInput, fromDay: number, toDate: Date) {
  const toDay = toDate.getDay();
  if (block.startDate) {
    const iso = localDateKeyToIsoMidnight(localDateKey(toDate));
    return { daysOfWeek: [toDay], startDate: iso, endDate: iso };
  }
  return { daysOfWeek: swapWeekday(block.daysOfWeek, fromDay, toDay) };
}

export type ResizeEdge = "start" | "end";

/**
 * Krawędź jest przeciągalna tylko na segmencie z prawdziwym brzegiem
 * instancji — nie na "ucięciu" przez północ (continuesFromPrevDay /
 * continuesToNextDay), bo tam nie ma czego edytować (to kontynuacja, nie
 * realny koniec/start).
 */
export function isEdgeResizable(
  segment: Pick<GridSegment, "continuesFromPrevDay" | "continuesToNextDay">,
  edge: ResizeEdge,
): boolean {
  return edge === "start" ? !segment.continuesFromPrevDay : !segment.continuesToNextDay;
}

/**
 * Buduje PATCH body dla przeciągnięcia krawędzi bloku (resize). `newMinutes`
 * to minuty od północy pod kursorem (już zaokrąglone przez
 * pixelOffsetToMinutes, ale snapMinutes tu ponownie dla bezpieczeństwa przy
 * bezpośrednim wywołaniu). Pilnuje minimalnego czasu trwania (SNAP_MINUTES),
 * licząc z zawinięciem przez północ tak samo jak lib/recurrence.ts.
 */
export function buildResizeBlockPatch(
  block: { startTime: string; endTime: string },
  edge: ResizeEdge,
  newMinutes: number,
): { startTime: string } | { endTime: string } {
  const snapped = snapMinutes(newMinutes);
  if (edge === "end") {
    const s = hhmmToMinutes(block.startTime);
    let e = snapped;
    if (wrapDuration(s, e) < SNAP_MINUTES) e = (s + SNAP_MINUTES) % (24 * 60);
    return { endTime: minutesToHHMM(e) };
  }
  const e = hhmmToMinutes(block.endTime);
  let s = snapped;
  if (wrapDuration(s, e) < SNAP_MINUTES) s = (e - SNAP_MINUTES + 24 * 60) % (24 * 60);
  return { startTime: minutesToHHMM(s) };
}

/** Przesuwa start+koniec bloku o deltę minut (dodatnią lub ujemną), zachowując czas trwania i zawijając przez północ (mod 24h). */
export function shiftBlockTime(
  block: { startTime: string; endTime: string },
  deltaMinutes: number,
): { startTime: string; endTime: string } {
  const s = hhmmToMinutes(block.startTime);
  const e = hhmmToMinutes(block.endTime);
  const duration = wrapDuration(s, e);
  const newS = ((s + deltaMinutes) % (24 * 60) + 24 * 60) % (24 * 60);
  const newE = (newS + duration) % (24 * 60);
  return { startTime: minutesToHHMM(newS), endTime: minutesToHHMM(newE) };
}

/**
 * Łączy poziome przeciągnięcie (zmiana dnia, buildMoveBlockPatch) z pionowym
 * (zmiana godziny, shiftBlockTime) w jeden PATCH — przeciąganie po skosie
 * zmienia dzień i godzinę naraz. deltaMinutes=0 -> sam patch dnia, bez pól
 * czasowych (brak zmiany).
 */
export function buildMovePatch(
  block: MoveBlockInput & { startTime: string; endTime: string },
  fromDay: number,
  toDate: Date,
  deltaMinutes: number,
) {
  const dayPatch = buildMoveBlockPatch(block, fromDay, toDate);
  if (deltaMinutes === 0) return dayPatch;
  return { ...dayPatch, ...shiftBlockTime(block, deltaMinutes) };
}

export type WorkingHours = { days: number[]; start: number; end: number };

/**
 * Zakresy (w minutach od północy) NIEDOSTĘPNE dla danego dnia względem godzin
 * pracy — do wizualnego zacieniowania siatki (skośne paski). Poza właściwym
 * gap-finding — to tylko podkład wizualny.
 */
export function getUnavailableRanges(
  day: Date,
  workingHours: WorkingHours,
): { startMinutes: number; endMinutes: number }[] {
  if (!workingHours.days.includes(day.getDay())) {
    return [{ startMinutes: 0, endMinutes: 24 * 60 }];
  }
  const ranges: { startMinutes: number; endMinutes: number }[] = [];
  if (workingHours.start > 0) ranges.push({ startMinutes: 0, endMinutes: workingHours.start * 60 });
  if (workingHours.end < 24) ranges.push({ startMinutes: workingHours.end * 60, endMinutes: 24 * 60 });
  return ranges;
}

/**
 * Wariant getUnavailableRanges oparty o dane z modułu dostępności
 * (lib/availability.ts) zamiast stałej WORKING_HOURS: dzień wyłączony (lub
 * brak wpisu dla tego dnia — ponytail: traktujemy jak wyłączony, bezpieczny
 * domyślny wybór dla nieznanego stanu) jest niedostępny w całości; dzień
 * włączony daje zakresy przed startTime i po endTime.
 */
export function getUnavailableRangesFromAvailability(
  day: Date,
  availability: AvailabilityDay[],
): { startMinutes: number; endMinutes: number }[] {
  const entry = availability.find((a) => a.dayOfWeek === day.getDay());
  if (!entry || !entry.enabled) return [{ startMinutes: 0, endMinutes: 24 * 60 }];
  const ranges: { startMinutes: number; endMinutes: number }[] = [];
  const start = hhmmToMinutes(entry.startTime);
  const end = hhmmToMinutes(entry.endTime);
  if (start > 0) ranges.push({ startMinutes: 0, endMinutes: start });
  if (end < 24 * 60) ranges.push({ startMinutes: end, endMinutes: 24 * 60 });
  return ranges;
}

export type BlocksAction =
  | { kind: "patch"; id: string; patch: Partial<PlannerBlock> }
  | { kind: "add"; block: PlannerBlock };

/**
 * Reducer dla useOptimistic w PlannerGrid: aplikuje zmianę na liście bloków
 * natychmiast (przed odpowiedzią serwera). "patch" scala pola w blok o
 * pasującym id (no-op gdy id nieznane — np. blok już usunięty gdzie indziej);
 * "add" dokleja nowy (tymczasowy) blok na koniec, używane przy drop backlogu.
 */
export function applyBlocksAction(state: PlannerBlock[], action: BlocksAction): PlannerBlock[] {
  if (action.kind === "add") return [...state, action.block];
  return state.map((b) => (b.id === action.id ? { ...b, ...action.patch } : b));
}

/**
 * Czy wolno zacząć drag-to-create (tworzenie nowego bloku) w danym dniu.
 * Bez propa availability (fallback przed integracją) — zawsze true. Dzień
 * wyłączony blokuje TYLKO tworzenie; istniejące bloki nadal można w niego
 * przeciągnąć (patrz PlannerGrid — brak analogicznej blokady w move-drag).
 */
export function isDayAvailableForCreate(day: Date, availability?: AvailabilityDay[]): boolean {
  if (!availability) return true;
  const entry = availability.find((a) => a.dayOfWeek === day.getDay());
  return !!entry?.enabled;
}
