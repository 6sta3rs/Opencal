import { expect, it } from "vitest";
import {
  applyBlocksAction,
  bufferLabelMode,
  buildBacklogDropBody,
  buildBufferResizePatch,
  buildMoveBlockPatch,
  buildMovePatch,
  buildQuickCreateBody,
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
  swapWeekday,
  type GridSegment,
} from "./planner-grid";

/** Segment minimalny do testów snapToNearestFreeSlot — tylko pola, na których operuje funkcja. */
function seg(blockId: string, startMinutes: number, endMinutes: number, phase: GridSegment["phase"] = "shift"): GridSegment {
  return {
    blockId,
    name: blockId,
    type: "work",
    staysOvernight: false,
    phase,
    day: "2026-07-06",
    startMinutes,
    endMinutes,
    continuesFromPrevDay: false,
    continuesToNextDay: false,
  };
}

it("bufferLabelMode: <20min ukryty, 20-44min compact, >=45min full", () => {
  expect(bufferLabelMode(19)).toBe("hidden");
  expect(bufferLabelMode(20)).toBe("compact");
  expect(bufferLabelMode(44)).toBe("compact");
  expect(bufferLabelMode(45)).toBe("full");
});

it("focusBoundaryMinutes: bez buforów daje tylko start/koniec zmiany", () => {
  expect(focusBoundaryMinutes({ startMinutes: 540, endMinutes: 600 })).toEqual([540, 600]);
});

// Fix 6: scroll startowy siatki przy montażu — patrz PlannerGrid (efekt z useRef guard).
it("initialScrollMinutes: segmenty obecne -> najwcześniejszy start minus 30, przycięty do >=0", () => {
  const segments = [{ startMinutes: 600 }, { startMinutes: 60 }, { startMinutes: 900 }];
  expect(initialScrollMinutes(segments)).toBe(30);
});

it("initialScrollMinutes: przycina do 0, gdy najwcześniejszy start jest bliżej północy niż 30 min", () => {
  expect(initialScrollMinutes([{ startMinutes: 10 }])).toBe(0);
});

it("initialScrollMinutes: brak segmentów -> najwcześniejsza włączona godzina dostępności", () => {
  const availability = [
    { dayOfWeek: 1, enabled: true, startTime: "09:00", endTime: "17:00" },
    { dayOfWeek: 2, enabled: true, startTime: "07:30", endTime: "15:00" },
    { dayOfWeek: 3, enabled: false, startTime: "00:00", endTime: "00:00" },
  ];
  expect(initialScrollMinutes([], availability)).toBe(450); // 07:30
});

it("initialScrollMinutes: brak segmentów i brak dostępności -> domyślne 08:00 (480 min)", () => {
  expect(initialScrollMinutes([])).toBe(480);
});

it("focusBoundaryMinutes: oba bufory dają 4 granice posortowane rosnąco", () => {
  const boundaries = focusBoundaryMinutes(
    { startMinutes: 540, endMinutes: 600 },
    { startMinutes: 520 },
    { endMinutes: 620 },
  );
  expect(boundaries).toEqual([520, 540, 600, 620]);
});

it("focusBoundaryMinutes: tylko bufferBefore daje 3 granice", () => {
  const boundaries = focusBoundaryMinutes({ startMinutes: 540, endMinutes: 600 }, { startMinutes: 520 });
  expect(boundaries).toEqual([520, 540, 600]);
});

it("blok w obrębie jednego dnia daje jeden segment z właściwym dniem i godzinami", () => {
  const blocks = [
    {
      id: "b1",
      name: "Praca",
      type: "work",
      startTime: "09:00",
      endTime: "17:00",
      daysOfWeek: [1], // poniedziałek
      endDate: null,
    },
  ];

  // 2026-07-06 = poniedziałek
  const segments = computeGridSegments(blocks, new Date("2026-07-06"), new Date("2026-07-06"));

  expect(segments).toHaveLength(1);
  expect(segments[0]).toMatchObject({
    blockId: "b1",
    day: "2026-07-06",
    startMinutes: 9 * 60,
    endMinutes: 17 * 60,
  });
});

it("nocna zmiana 17:00–02:00 dzieli się na dwa segmenty po obu stronach północy", () => {
  const blocks = [
    {
      id: "b2",
      name: "Nocka",
      type: "work",
      startTime: "17:00",
      endTime: "02:00",
      daysOfWeek: [1],
      endDate: null,
      staysOvernight: true,
    },
  ];

  // 2026-07-06 = poniedziałek; zakres obejmuje też wtorek, żeby zmieściła się kontynuacja
  const segments = computeGridSegments(blocks, new Date("2026-07-06"), new Date("2026-07-07"));

  expect(segments).toHaveLength(2);
  expect(segments[0]).toMatchObject({
    blockId: "b2",
    day: "2026-07-06",
    startMinutes: 17 * 60,
    endMinutes: 24 * 60,
    continuesFromPrevDay: false,
    continuesToNextDay: true,
  });
  expect(segments[1]).toMatchObject({
    blockId: "b2",
    day: "2026-07-07",
    startMinutes: 0,
    endMinutes: 2 * 60,
    continuesFromPrevDay: true,
    continuesToNextDay: false,
  });
});

it("blok typu 'overnight' emituje segmenty fazy overnight (staysOvernight) zamiast shift, także z buforami", () => {
  const blocks = [
    {
      id: "b-ov",
      name: "Nocleg",
      type: "overnight",
      startTime: "21:00",
      endTime: "07:00",
      daysOfWeek: [1], // poniedziałek
      endDate: null,
      bufferBefore: 30,
      bufferAfter: 15,
    },
  ];

  // 2026-07-06 = poniedziałek; zakres obejmuje wtorek dla kontynuacji przez północ
  const segments = computeGridSegments(blocks, new Date("2026-07-06"), new Date("2026-07-07"));

  const overnightSegments = segments.filter((s) => s.phase === "overnight");
  expect(overnightSegments).toHaveLength(2);
  expect(overnightSegments[0]).toMatchObject({
    blockId: "b-ov",
    day: "2026-07-06",
    phase: "overnight",
    staysOvernight: true,
    startMinutes: 21 * 60,
    endMinutes: 24 * 60,
    continuesToNextDay: true,
  });
  expect(overnightSegments[1]).toMatchObject({
    blockId: "b-ov",
    day: "2026-07-07",
    phase: "overnight",
    staysOvernight: true,
    startMinutes: 0,
    endMinutes: 7 * 60,
    continuesFromPrevDay: true,
  });

  // Bufory przed/po przechodzą przez zwykłą ścieżkę emisji (niezależną od
  // shift/overnight) — bufferBefore przed 21:00, bufferAfter po 07:00.
  const bufferSegments = segments.filter((s) => s.phase === "buffer");
  expect(bufferSegments.find((s) => s.bufferKind === "before")).toMatchObject({
    day: "2026-07-06",
    startMinutes: 21 * 60 - 30,
    endMinutes: 21 * 60,
  });
  expect(bufferSegments.find((s) => s.bufferKind === "after")).toMatchObject({
    day: "2026-07-07",
    startMinutes: 7 * 60,
    endMinutes: 7 * 60 + 15,
  });
});

it("Fix 2b: jednorazowy blok typu 'overnight' (startDate/endDate + staysOvernight/departureTime z formularza) daje ciągły przebieg noclegu Pon 21:00 -> Śr 07:00", () => {
  const blocks = [
    {
      id: "b-ov-oneoff",
      name: "Delegacja",
      type: "overnight",
      startTime: "21:00",
      endTime: "07:00",
      daysOfWeek: [1], // poniedziałek — dzień startDate
      startDate: new Date("2026-07-06"), // poniedziałek
      endDate: new Date("2026-07-06"),
      staysOvernight: true,
      departureTime: new Date("2026-07-08T07:00:00"), // środa 07:00
    },
  ];

  // Pon 2026-07-06 .. Śr 2026-07-08
  const segments = computeGridSegments(blocks, new Date("2026-07-06"), new Date("2026-07-08"));

  expect(segments).toHaveLength(3);
  expect(segments[0]).toMatchObject({
    phase: "overnight",
    day: "2026-07-06",
    startMinutes: 21 * 60,
    endMinutes: 24 * 60,
    continuesFromPrevDay: false,
    continuesToNextDay: true,
  });
  expect(segments[1]).toMatchObject({
    phase: "overnight",
    day: "2026-07-07",
    startMinutes: 0,
    endMinutes: 24 * 60,
    continuesFromPrevDay: true,
    continuesToNextDay: true,
  });
  expect(segments[2]).toMatchObject({
    phase: "overnight",
    day: "2026-07-08",
    startMinutes: 0,
    endMinutes: 7 * 60,
    continuesFromPrevDay: true,
    continuesToNextDay: false,
  });
});

it("nocleg z wyjazdem 2 dni później: zmiana i okres noclegu to osobne segmenty (osobny element, nie ten sam blok wizualnie)", () => {
  const blocks = [
    {
      id: "b3",
      name: "Delegacja",
      type: "work",
      startTime: "20:00",
      endTime: "22:00",
      daysOfWeek: [1], // poniedziałek
      endDate: null,
      staysOvernight: true,
      // wyjazd w środę o 05:00 — 2 dni po zmianie, mimo że sama zmiana
      // (20:00–22:00) w ogóle nie przechodzi przez północ
      departureTime: new Date("2026-07-08T05:00:00"),
    },
  ];

  // 2026-07-06 = poniedziałek .. 2026-07-08 = środa
  const segments = computeGridSegments(blocks, new Date("2026-07-06"), new Date("2026-07-08"));

  // 4 segmenty: sama zmiana (shift) osobno od 3 dni okresu noclegu (overnight)
  expect(segments).toHaveLength(4);
  expect(segments[0]).toMatchObject({
    phase: "shift",
    staysOvernight: false,
    day: "2026-07-06",
    startMinutes: 20 * 60,
    endMinutes: 22 * 60,
    continuesFromPrevDay: false,
    continuesToNextDay: false,
  });
  expect(segments[1]).toMatchObject({
    phase: "overnight",
    staysOvernight: true,
    day: "2026-07-06",
    startMinutes: 22 * 60,
    endMinutes: 24 * 60,
    continuesFromPrevDay: false,
    continuesToNextDay: true,
  });
  expect(segments[2]).toMatchObject({
    phase: "overnight",
    staysOvernight: true,
    day: "2026-07-07",
    startMinutes: 0,
    endMinutes: 24 * 60,
    continuesFromPrevDay: true,
    continuesToNextDay: true,
  });
  expect(segments[3]).toMatchObject({
    phase: "overnight",
    staysOvernight: true,
    day: "2026-07-08",
    startMinutes: 0,
    endMinutes: 5 * 60,
    continuesFromPrevDay: true,
    continuesToNextDay: false,
  });
});

it("nocleg z wyjazdem następnego dnia rano: overnight ciągnie się od końca zmiany do 24:00 ORAZ od 00:00 do wyjazdu (bez ucięcia na północy)", () => {
  const blocks = [
    {
      id: "b4",
      name: "Zmiana",
      type: "work",
      startTime: "10:00",
      endTime: "19:00",
      daysOfWeek: [1], // poniedziałek
      endDate: null,
      staysOvernight: true,
      // wyjazd we wtorek o 07:00 — po zmianie kończącej się o 19:00 w poniedziałek
      departureTime: new Date("2026-07-07T07:00:00"),
    },
  ];

  // 2026-07-06 = poniedziałek .. 2026-07-07 = wtorek
  const segments = computeGridSegments(blocks, new Date("2026-07-06"), new Date("2026-07-07"));

  expect(segments).toHaveLength(3);
  expect(segments[0]).toMatchObject({ phase: "shift", day: "2026-07-06", startMinutes: 10 * 60, endMinutes: 19 * 60 });
  expect(segments[1]).toMatchObject({
    phase: "overnight",
    day: "2026-07-06",
    startMinutes: 19 * 60,
    endMinutes: 24 * 60,
    continuesToNextDay: true,
  });
  expect(segments[2]).toMatchObject({
    phase: "overnight",
    day: "2026-07-07",
    startMinutes: 0,
    endMinutes: 7 * 60,
    continuesFromPrevDay: true,
  });
});

it("nocleg: overnightStart jawny > instance.end tworzy lukę bez segmentu między końcem zmiany a startem noclegu", () => {
  const blocks = [
    {
      id: "b4b",
      name: "Zmiana",
      type: "work",
      startTime: "10:00",
      endTime: "19:00",
      daysOfWeek: [1], // poniedziałek
      endDate: null,
      staysOvernight: true,
      overnightStart: new Date("2026-07-06T21:00:00"),
      departureTime: new Date("2026-07-07T07:00:00"),
    },
  ];

  // 2026-07-06 = poniedziałek .. 2026-07-07 = wtorek
  const segments = computeGridSegments(blocks, new Date("2026-07-06"), new Date("2026-07-07"));

  expect(segments).toHaveLength(3);
  expect(segments[0]).toMatchObject({ phase: "shift", day: "2026-07-06", startMinutes: 10 * 60, endMinutes: 19 * 60 });
  // luka 19:00-21:00 nie ma żadnego segmentu — sprawdzane pośrednio przez to,
  // że segments[1] zaczyna się dopiero o 21:00, nie o 19:00.
  expect(segments[1]).toMatchObject({
    phase: "overnight",
    day: "2026-07-06",
    startMinutes: 21 * 60,
    endMinutes: 24 * 60,
    continuesFromPrevDay: false,
    continuesToNextDay: true,
  });
  expect(segments[2]).toMatchObject({
    phase: "overnight",
    day: "2026-07-07",
    startMinutes: 0,
    endMinutes: 7 * 60,
    continuesFromPrevDay: true,
    continuesToNextDay: false,
  });
});

it("nocleg: overnightStart ustawiony PRZED końcem zmiany zostaje przycięty do instance.end (bez ujemnej luki, stare zachowanie)", () => {
  const blocks = [
    {
      id: "b4c",
      name: "Zmiana",
      type: "work",
      startTime: "10:00",
      endTime: "19:00",
      daysOfWeek: [1],
      endDate: null,
      staysOvernight: true,
      overnightStart: new Date("2026-07-06T18:00:00"), // przed końcem zmiany (19:00) — błędne dane usera
      departureTime: new Date("2026-07-07T07:00:00"),
    },
  ];

  const segments = computeGridSegments(blocks, new Date("2026-07-06"), new Date("2026-07-07"));

  expect(segments).toHaveLength(3);
  expect(segments[1]).toMatchObject({
    phase: "overnight",
    day: "2026-07-06",
    startMinutes: 19 * 60, // przycięte do instance.end, NIE 18:00
    endMinutes: 24 * 60,
  });
});

it("computeGridSegments emituje segmenty 'buffer' przed i po zmianie, gdy bufferBefore/bufferAfter > 0", () => {
  const blocks = [
    {
      id: "b5",
      name: "Praca",
      type: "work",
      startTime: "09:00",
      endTime: "17:00",
      daysOfWeek: [1], // poniedziałek
      endDate: null,
      bufferBefore: 30,
      bufferAfter: 15,
    },
  ];

  const segments = computeGridSegments(blocks, new Date("2026-07-06"), new Date("2026-07-06"));

  expect(segments).toHaveLength(3);
  expect(segments[0]).toMatchObject({ phase: "shift", startMinutes: 9 * 60, endMinutes: 17 * 60 });
  expect(segments[1]).toMatchObject({
    phase: "buffer",
    bufferKind: "before",
    day: "2026-07-06",
    startMinutes: 8 * 60 + 30,
    endMinutes: 9 * 60,
  });
  expect(segments[2]).toMatchObject({
    phase: "buffer",
    bufferKind: "after",
    day: "2026-07-06",
    startMinutes: 17 * 60,
    endMinutes: 17 * 60 + 15,
  });
});

it("computeGridSegments przycina bufor do granic doby, gdy przechodzi przez północ (bez dzielenia na segmenty)", () => {
  const blocks = [
    {
      id: "b6",
      name: "Praca",
      type: "work",
      startTime: "00:30",
      endTime: "08:00",
      daysOfWeek: [1],
      endDate: null,
      bufferBefore: 60, // 60 min przed 00:30 przechodzi przez północ -> przycięte do 00:00
    },
  ];

  const segments = computeGridSegments(blocks, new Date("2026-07-06"), new Date("2026-07-06"));

  const buffer = segments.find((s) => s.phase === "buffer" && s.bufferKind === "before");
  expect(buffer).toMatchObject({ day: "2026-07-06", startMinutes: 0, endMinutes: 30 });
});

it("computeGridSegments: bufor 'po' na noclegu z rozciągniętym pobytem stosuje się po DEPARTURE, nie po końcu zmiany", () => {
  const blocks = [
    {
      id: "b7",
      name: "Zmiana",
      type: "work",
      startTime: "10:00",
      endTime: "19:00",
      daysOfWeek: [1], // poniedziałek
      endDate: null,
      staysOvernight: true,
      departureTime: new Date("2026-07-07T07:00:00"), // wtorek 07:00
      bufferAfter: 20,
    },
  ];

  const segments = computeGridSegments(blocks, new Date("2026-07-06"), new Date("2026-07-07"));

  const afterBuffer = segments.find((s) => s.phase === "buffer" && s.bufferKind === "after");
  expect(afterBuffer).toMatchObject({
    day: "2026-07-07",
    startMinutes: 7 * 60,
    endMinutes: 7 * 60 + 20,
  });
});

it("layoutOverlaps: kartę nakładającą się z buforem INNEGO bloku (bez konfliktu zmiana-zmiana) oznacza overBuffer: true", () => {
  const segments = [
    { blockId: "a", name: "A", type: "work", staysOvernight: false, phase: "shift" as const, day: "2026-07-06", startMinutes: 9 * 60, endMinutes: 10 * 60, continuesFromPrevDay: false, continuesToNextDay: false },
    { blockId: "b", name: "B", type: "course", staysOvernight: false, phase: "buffer" as const, bufferKind: "before" as const, day: "2026-07-06", startMinutes: 9 * 60 + 30, endMinutes: 11 * 60, continuesFromPrevDay: false, continuesToNextDay: false },
  ];

  const laidOut = layoutOverlaps(segments);

  const a = laidOut.find((s) => s.blockId === "a")!;
  expect(a.overBuffer).toBe(true);
});

it("layoutOverlaps: bez nakładania z buforem innego bloku overBuffer zostaje undefined/false", () => {
  const segments = [
    { blockId: "a", name: "A", type: "work", staysOvernight: false, phase: "shift" as const, day: "2026-07-06", startMinutes: 9 * 60, endMinutes: 10 * 60, continuesFromPrevDay: false, continuesToNextDay: false },
  ];

  const laidOut = layoutOverlaps(segments);

  expect(laidOut[0].overBuffer).toBeFalsy();
});

it("classifyOverlap: 'conflict' gdy kandydat nakłada się z fazą 'shift' innego bloku", () => {
  const daySegments = [
    { blockId: "a", name: "A", type: "work", staysOvernight: false, phase: "shift" as const, day: "2026-07-06", startMinutes: 9 * 60, endMinutes: 12 * 60, continuesFromPrevDay: false, continuesToNextDay: false },
  ];

  expect(classifyOverlap(daySegments, { startMinutes: 10 * 60, endMinutes: 11 * 60 })).toBe("conflict");
});

it("classifyOverlap: 'over-buffer' gdy kandydat nakłada tylko bufor innego bloku (bez konfliktu zmiana-zmiana)", () => {
  const daySegments = [
    { blockId: "a", name: "A", type: "work", staysOvernight: false, phase: "buffer" as const, bufferKind: "before" as const, day: "2026-07-06", startMinutes: 8 * 60 + 30, endMinutes: 9 * 60, continuesFromPrevDay: false, continuesToNextDay: false },
  ];

  expect(classifyOverlap(daySegments, { startMinutes: 8 * 60 + 45, endMinutes: 9 * 60 + 15 })).toBe("over-buffer");
});

it("classifyOverlap: 'clear' gdy kandydat nie nakłada żadnej fazy 'shift' ani 'buffer'", () => {
  const daySegments = [
    { blockId: "a", name: "A", type: "work", staysOvernight: false, phase: "shift" as const, day: "2026-07-06", startMinutes: 9 * 60, endMinutes: 12 * 60, continuesFromPrevDay: false, continuesToNextDay: false },
  ];

  expect(classifyOverlap(daySegments, { startMinutes: 13 * 60, endMinutes: 14 * 60 })).toBe("clear");
});

it("classifyOverlap: excludeBlockId pozwala blokowi ignorować własne segmenty (przesuwany blok nie koliduje sam ze sobą)", () => {
  const daySegments = [
    { blockId: "a", name: "A", type: "work", staysOvernight: false, phase: "shift" as const, day: "2026-07-06", startMinutes: 9 * 60, endMinutes: 12 * 60, continuesFromPrevDay: false, continuesToNextDay: false },
  ];

  expect(classifyOverlap(daySegments, { startMinutes: 10 * 60, endMinutes: 11 * 60, excludeBlockId: "a" })).toBe("clear");
});

it("computeGridSegments: luka jawna między końcem zmiany a startem noclegu dostaje DODATKOWY bufor 'overnight-before' (dojazd do noclegu) obok bufora przed zmianą", () => {
  const blocks = [
    {
      id: "b8",
      name: "Zmiana",
      type: "work",
      startTime: "10:00",
      endTime: "19:00",
      daysOfWeek: [1], // poniedziałek
      endDate: null,
      staysOvernight: true,
      overnightStart: new Date("2026-07-06T21:00:00"),
      departureTime: new Date("2026-07-07T07:00:00"),
      bufferBefore: 30,
    },
  ];

  const segments = computeGridSegments(blocks, new Date("2026-07-06"), new Date("2026-07-07"));

  const beforeShift = segments.find((s) => s.phase === "buffer" && s.bufferKind === "before");
  expect(beforeShift).toMatchObject({ day: "2026-07-06", startMinutes: 9 * 60 + 30, endMinutes: 10 * 60 });

  const beforeOvernight = segments.find((s) => s.phase === "buffer" && s.bufferKind === "overnight-before");
  expect(beforeOvernight).toMatchObject({ day: "2026-07-06", startMinutes: 20 * 60 + 30, endMinutes: 21 * 60 });
});

it("computeGridSegments: bufor 'overnight-before' nie powstaje bez jawnej luki (nocleg zaczyna się od razu po zmianie)", () => {
  const blocks = [
    {
      id: "b9",
      name: "Zmiana",
      type: "work",
      startTime: "10:00",
      endTime: "19:00",
      daysOfWeek: [1],
      endDate: null,
      staysOvernight: true,
      departureTime: new Date("2026-07-07T07:00:00"),
      bufferBefore: 30,
    },
  ];

  const segments = computeGridSegments(blocks, new Date("2026-07-06"), new Date("2026-07-07"));

  expect(segments.find((s) => s.phase === "buffer" && s.bufferKind === "overnight-before")).toBeUndefined();
});

it("computeGridSegments: bufor 'overnight-before' jest przycięty tak, by nigdy nie zaczynać się przed końcem zmiany", () => {
  const blocks = [
    {
      id: "b10",
      name: "Zmiana",
      type: "work",
      startTime: "10:00",
      endTime: "19:00",
      daysOfWeek: [1],
      endDate: null,
      staysOvernight: true,
      overnightStart: new Date("2026-07-06T19:10:00"), // luka tylko 10 minut
      departureTime: new Date("2026-07-07T07:00:00"),
      bufferBefore: 30, // 30 min > 10 min luki -> przycięte do instance.end (19:00)
    },
  ];

  const segments = computeGridSegments(blocks, new Date("2026-07-06"), new Date("2026-07-07"));

  const beforeOvernight = segments.find((s) => s.phase === "buffer" && s.bufferKind === "overnight-before");
  expect(beforeOvernight).toMatchObject({ startMinutes: 19 * 60, endMinutes: 19 * 60 + 10 });
});

it("getWeekDays zwraca 7 dni od poniedziałku do niedzieli tego samego tygodnia, nawet dla kotwicy w niedzielę", () => {
  // 2026-07-12 = niedziela (tydzień 2026-07-06 pon. .. 2026-07-12 niedz.)
  const days = getWeekDays(new Date("2026-07-12"));

  expect(days).toHaveLength(7);
  expect(days.map(localDateKey)).toEqual([
    "2026-07-06",
    "2026-07-07",
    "2026-07-08",
    "2026-07-09",
    "2026-07-10",
    "2026-07-11",
    "2026-07-12",
  ]);
});

it("layoutOverlaps dzieli nakładające się segmenty na osobne kolumny obok siebie", () => {
  const segments = [
    { blockId: "a", name: "A", type: "work", staysOvernight: false, phase: "shift" as const, day: "2026-07-06", startMinutes: 9 * 60, endMinutes: 12 * 60, continuesFromPrevDay: false, continuesToNextDay: false },
    { blockId: "b", name: "B", type: "course", staysOvernight: false, phase: "shift" as const, day: "2026-07-06", startMinutes: 10 * 60, endMinutes: 11 * 60, continuesFromPrevDay: false, continuesToNextDay: false },
  ];

  const laidOut = layoutOverlaps(segments);

  expect(laidOut).toHaveLength(2);
  expect(laidOut[0].col).toBe(0);
  expect(laidOut[1].col).toBe(1);
  expect(laidOut[0].colCount).toBe(2);
  expect(laidOut[1].colCount).toBe(2);
});

it("layoutOverlaps traktuje segment noclegowy jako tło — nie dzieli kolumn z nakładającą się kartą", () => {
  const segments = [
    { blockId: "n", name: "Nocleg", type: "work", staysOvernight: true, phase: "overnight" as const, day: "2026-07-06", startMinutes: 0, endMinutes: 7 * 60, continuesFromPrevDay: true, continuesToNextDay: false },
    { blockId: "b", name: "Kurs", type: "course", staysOvernight: false, phase: "shift" as const, day: "2026-07-06", startMinutes: 5 * 60, endMinutes: 6 * 60, continuesFromPrevDay: false, continuesToNextDay: false },
  ];

  const laidOut = layoutOverlaps(segments);

  expect(laidOut.every((s) => s.col === 0 && s.colCount === 1)).toBe(true);
});

it("layoutOverlaps: per-klaster — jedna nakładająca się para nie wpływa na colCount niezależnej trzeciej karty tego dnia", () => {
  const segments = [
    { blockId: "a", name: "A", type: "work", staysOvernight: false, phase: "shift" as const, day: "2026-07-06", startMinutes: 9 * 60, endMinutes: 12 * 60, continuesFromPrevDay: false, continuesToNextDay: false },
    { blockId: "b", name: "B", type: "course", staysOvernight: false, phase: "shift" as const, day: "2026-07-06", startMinutes: 10 * 60, endMinutes: 11 * 60, continuesFromPrevDay: false, continuesToNextDay: false },
    { blockId: "c", name: "C", type: "personal", staysOvernight: false, phase: "shift" as const, day: "2026-07-06", startMinutes: 15 * 60, endMinutes: 16 * 60, continuesFromPrevDay: false, continuesToNextDay: false },
  ];

  const laidOut = layoutOverlaps(segments);

  const a = laidOut.find((s) => s.blockId === "a")!;
  const b = laidOut.find((s) => s.blockId === "b")!;
  const c = laidOut.find((s) => s.blockId === "c")!;
  expect(a.colCount).toBe(2);
  expect(b.colCount).toBe(2);
  expect(a.col).not.toBe(b.col);
  expect(c.colCount).toBe(1);
  expect(c.col).toBe(0);
});

it("layoutOverlaps ogranicza kolumny do maks. 2 — trzecia nakładająca się karta dzieli kolumnę z pierwszą (col%2)", () => {
  const segments = [
    { blockId: "a", name: "A", type: "work", staysOvernight: false, phase: "shift" as const, day: "2026-07-06", startMinutes: 9 * 60, endMinutes: 12 * 60, continuesFromPrevDay: false, continuesToNextDay: false },
    { blockId: "b", name: "B", type: "course", staysOvernight: false, phase: "shift" as const, day: "2026-07-06", startMinutes: 9 * 60, endMinutes: 12 * 60, continuesFromPrevDay: false, continuesToNextDay: false },
    { blockId: "c", name: "C", type: "personal", staysOvernight: false, phase: "shift" as const, day: "2026-07-06", startMinutes: 9 * 60, endMinutes: 12 * 60, continuesFromPrevDay: false, continuesToNextDay: false },
  ];

  const laidOut = layoutOverlaps(segments);

  const a = laidOut.find((s) => s.blockId === "a")!;
  const b = laidOut.find((s) => s.blockId === "b")!;
  const c = laidOut.find((s) => s.blockId === "c")!;
  expect(a.colCount).toBe(2);
  expect(b.colCount).toBe(2);
  expect(c.colCount).toBe(2);
  expect(a.col).toBe(0);
  expect(b.col).toBe(1);
  expect(c.col).toBe(0);
});

it("layoutOverlaps nie dzieli segmentów, które się nie nakładają", () => {
  const segments = [
    { blockId: "a", name: "A", type: "work", staysOvernight: false, phase: "shift" as const, day: "2026-07-06", startMinutes: 9 * 60, endMinutes: 10 * 60, continuesFromPrevDay: false, continuesToNextDay: false },
    { blockId: "b", name: "B", type: "course", staysOvernight: false, phase: "shift" as const, day: "2026-07-06", startMinutes: 10 * 60, endMinutes: 11 * 60, continuesFromPrevDay: false, continuesToNextDay: false },
  ];

  const laidOut = layoutOverlaps(segments);

  expect(laidOut.every((s) => s.col === 0 && s.colCount === 1)).toBe(true);
});

it("blok jednorazowy (startDate ustawiony) nie pojawia się przed swoim startDate", () => {
  const blocks = [
    {
      id: "b3",
      name: "Jednorazowy",
      type: "personal",
      startTime: "10:00",
      endTime: "11:00",
      daysOfWeek: [1], // poniedziałek
      startDate: new Date("2026-07-13T00:00:00"),
      endDate: new Date("2026-07-13T00:00:00"),
    },
  ];

  // 2026-07-06 to też poniedziałek, ale przed startDate — nie powinien się pojawić
  const segments = computeGridSegments(blocks, new Date("2026-07-06"), new Date("2026-07-06"));

  expect(segments).toHaveLength(0);
});

it("snapMinutes zaokrągla do najbliższych 15 minut i przycina do 0..1440", () => {
  expect(snapMinutes(7)).toBe(0);
  expect(snapMinutes(8)).toBe(15);
  expect(snapMinutes(52)).toBe(45);
  expect(snapMinutes(-10)).toBe(0);
  expect(snapMinutes(1450)).toBe(1440);
});

it("pixelOffsetToMinutes przelicza offset piksela na zaokrąglone minuty wg wysokości godziny", () => {
  // 48px = 1h przy hourHeightPx=48; 100px ≈ 2h5min -> zaokrąglone do 15 min
  expect(pixelOffsetToMinutes(48, 48)).toBe(60);
  expect(pixelOffsetToMinutes(100, 48)).toBe(120);
  expect(pixelOffsetToMinutes(0, 48)).toBe(0);
});

it("minutesToHHMM formatuje minuty od północy jako HH:MM", () => {
  expect(minutesToHHMM(0)).toBe("00:00");
  expect(minutesToHHMM(9 * 60)).toBe("09:00");
  expect(minutesToHHMM(23 * 60 + 45)).toBe("23:45");
});

it("dragRangeToDraft normalizuje kolejność, zaokrągla do 15 min i formatuje dzień", () => {
  const day = new Date("2026-07-06"); // poniedziałek
  const draft = dragRangeToDraft(day, 10 * 60 + 40, 9 * 60 + 5); // odwrócone, zaokrąglone

  expect(draft).toEqual({
    date: "2026-07-06",
    dayOfWeek: 1,
    startTime: "09:00",
    endTime: "10:45",
  });
});

it("dragRangeToDraft wymusza minimalny zakres 15 min gdy start==koniec po zaokrągleniu", () => {
  const day = new Date("2026-07-06");
  const draft = dragRangeToDraft(day, 9 * 60, 9 * 60 + 2);

  expect(draft.startTime).toBe("09:00");
  expect(draft.endTime).toBe("09:15");
});

it("buildQuickCreateBody bez powtarzania tworzy blok jednorazowy z daysOfWeek+startDate+endDate tego dnia", () => {
  const body = buildQuickCreateBody({
    name: "Siłownia",
    type: "personal",
    repeatWeekly: false,
    date: "2026-07-06",
    dayOfWeek: 1,
    startTime: "09:00",
    endTime: "10:00",
  });

  expect(body.name).toBe("Siłownia");
  expect(body.daysOfWeek).toEqual([1]);
  expect(body.startDate).not.toBeNull();
  expect(body.endDate).not.toBeNull();
  expect(new Date(body.startDate as string).toDateString()).toBe(new Date("2026-07-06").toDateString());
});

it("buildQuickCreateBody z powtarzaniem tworzy blok cykliczny bez startDate/endDate", () => {
  const body = buildQuickCreateBody({
    name: "Siłownia",
    type: "personal",
    repeatWeekly: true,
    date: "2026-07-06",
    dayOfWeek: 1,
    startTime: "09:00",
    endTime: "10:00",
  });

  expect(body.daysOfWeek).toEqual([1]);
  expect(body.startDate).toBeNull();
  expect(body.endDate).toBeNull();
});

it("swapWeekday zamienia jeden dzień w daysOfWeek na inny", () => {
  expect(swapWeekday([1, 3], 1, 2)).toEqual([2, 3]);
});

it("swapWeekday nie tworzy duplikatu gdy dzień docelowy już istnieje", () => {
  expect(swapWeekday([1, 2], 1, 2)).toEqual([2]);
});

it("swapWeekday nie zmienia niczego, gdy fromDay nie jest w tablicy", () => {
  expect(swapWeekday([2, 3], 1, 5)).toEqual([2, 3]);
});

it("buildMoveBlockPatch dla bloku jednorazowego przesuwa startDate/endDate i daysOfWeek na nowy dzień", () => {
  const patch = buildMoveBlockPatch(
    { daysOfWeek: [1], startDate: new Date("2026-07-06T00:00:00"), endDate: new Date("2026-07-06T00:00:00") },
    1,
    new Date("2026-07-07"), // wtorek
  );

  expect(patch.daysOfWeek).toEqual([2]);
  expect(new Date(patch.startDate as string).toDateString()).toBe(new Date("2026-07-07").toDateString());
  expect(new Date(patch.endDate as string).toDateString()).toBe(new Date("2026-07-07").toDateString());
});

it("buildMoveBlockPatch dla bloku cyklicznego tylko podmienia dzień w daysOfWeek", () => {
  const patch = buildMoveBlockPatch({ daysOfWeek: [1, 3], startDate: null, endDate: null }, 1, new Date("2026-07-07"));

  expect(patch).toEqual({ daysOfWeek: [2, 3] });
});

it("getUnavailableRanges w dzień roboczy zwraca zakresy przed startem i po końcu godzin pracy", () => {
  const monday = new Date("2026-07-06"); // poniedziałek
  const ranges = getUnavailableRanges(monday, { days: [1, 2, 3, 4, 5], start: 9, end: 17 });

  expect(ranges).toEqual([
    { startMinutes: 0, endMinutes: 9 * 60 },
    { startMinutes: 17 * 60, endMinutes: 24 * 60 },
  ]);
});

it("getUnavailableRanges w weekend zwraca cały dzień jako niedostępny", () => {
  const saturday = new Date("2026-07-11");
  const ranges = getUnavailableRanges(saturday, { days: [1, 2, 3, 4, 5], start: 9, end: 17 });

  expect(ranges).toEqual([{ startMinutes: 0, endMinutes: 24 * 60 }]);
});

it("hhmmToMinutes zamienia HH:MM na minuty od północy", () => {
  expect(hhmmToMinutes("00:00")).toBe(0);
  expect(hhmmToMinutes("09:15")).toBe(9 * 60 + 15);
  expect(hhmmToMinutes("23:59")).toBe(23 * 60 + 59);
});

it("isEdgeResizable: górna krawędź tylko na segmencie z prawdziwym startem", () => {
  const real = { continuesFromPrevDay: false, continuesToNextDay: true } as never;
  const cut = { continuesFromPrevDay: true, continuesToNextDay: false } as never;
  expect(isEdgeResizable(real, "start")).toBe(true);
  expect(isEdgeResizable(cut, "start")).toBe(false);
});

it("isEdgeResizable: dolna krawędź tylko na segmencie z prawdziwym końcem", () => {
  const real = { continuesFromPrevDay: true, continuesToNextDay: false } as never;
  const cut = { continuesFromPrevDay: false, continuesToNextDay: true } as never;
  expect(isEdgeResizable(real, "end")).toBe(true);
  expect(isEdgeResizable(cut, "end")).toBe(false);
});

it("buildResizeBlockPatch przeciąga dolną krawędź (koniec) na nową godzinę", () => {
  const block = { startTime: "09:00", endTime: "17:00" };
  expect(buildResizeBlockPatch(block, "end", 18 * 60)).toEqual({ endTime: "18:00" });
});

it("buildResizeBlockPatch przeciąga górną krawędź (start) na nową godzinę", () => {
  const block = { startTime: "09:00", endTime: "17:00" };
  expect(buildResizeBlockPatch(block, "start", 8 * 60)).toEqual({ startTime: "08:00" });
});

it("buildResizeBlockPatch pilnuje minimalnych 15 minut przy skracaniu od dołu", () => {
  const block = { startTime: "09:00", endTime: "17:00" };
  expect(buildResizeBlockPatch(block, "end", 9 * 60)).toEqual({ endTime: "09:15" });
});

it("buildResizeBlockPatch pilnuje minimalnych 15 minut przy skracaniu od góry", () => {
  const block = { startTime: "09:00", endTime: "17:00" };
  expect(buildResizeBlockPatch(block, "start", 17 * 60)).toEqual({ startTime: "16:45" });
});

it("buildResizeBlockPatch dla nocnej zmiany liczy koniec z zawinięciem przez północ", () => {
  const block = { startTime: "17:00", endTime: "02:00" };
  expect(buildResizeBlockPatch(block, "end", 3 * 60)).toEqual({ endTime: "03:00" });
});

it("pixelDeltaToMinutes zamienia różnicę pikseli na zaokrąglone minuty (dodatnie i ujemne)", () => {
  expect(pixelDeltaToMinutes(48, 48)).toBe(60);
  expect(pixelDeltaToMinutes(-48, 48)).toBe(-60);
  expect(pixelDeltaToMinutes(0, 48)).toBe(0);
});

it("shiftBlockTime przesuwa start i koniec o deltę minut, zachowując czas trwania", () => {
  const block = { startTime: "09:00", endTime: "17:00" };
  expect(shiftBlockTime(block, 60)).toEqual({ startTime: "10:00", endTime: "18:00" });
});

it("shiftBlockTime zawija nocną zmianę przez północ (17:00–02:00 +2h -> 19:00–04:00)", () => {
  const block = { startTime: "17:00", endTime: "02:00" };
  expect(shiftBlockTime(block, 120)).toEqual({ startTime: "19:00", endTime: "04:00" });
});

it("shiftBlockTime obsługuje ujemną deltę z zawinięciem pod północ", () => {
  const block = { startTime: "01:00", endTime: "03:00" };
  expect(shiftBlockTime(block, -120)).toEqual({ startTime: "23:00", endTime: "01:00" });
});

it("buildMovePatch bez przesunięcia pionowego (delta=0) daje ten sam patch co buildMoveBlockPatch", () => {
  const block = { daysOfWeek: [1, 3], startDate: null, endDate: null, startTime: "09:00", endTime: "17:00" };
  const patch = buildMovePatch(block, 1, new Date("2026-07-07"), 0);
  expect(patch).toEqual({ daysOfWeek: [2, 3] });
});

it("buildMovePatch z przesunięciem pionowym w tym samym dniu dokleja tylko nowe godziny", () => {
  const block = { daysOfWeek: [1], startDate: null, endDate: null, startTime: "09:00", endTime: "17:00" };
  const patch = buildMovePatch(block, 1, new Date("2026-07-06"), 60);
  expect(patch).toEqual({ daysOfWeek: [1], startTime: "10:00", endTime: "18:00" });
});

it("buildMovePatch łączy zmianę dnia i godziny w jednym patchu (przeciąganie po skosie)", () => {
  const block = { daysOfWeek: [1], startDate: null, endDate: null, startTime: "09:00", endTime: "17:00" };
  const patch = buildMovePatch(block, 1, new Date("2026-07-07"), 60);
  expect(patch).toEqual({ daysOfWeek: [2], startTime: "10:00", endTime: "18:00" });
});

it("getUnavailableRangesFromAvailability: dzień wyłączony jest niedostępny w całości", () => {
  const monday = new Date("2026-07-06");
  const ranges = getUnavailableRangesFromAvailability(monday, [
    { dayOfWeek: 1, enabled: false, startTime: "09:00", endTime: "17:00" },
  ]);
  expect(ranges).toEqual([{ startMinutes: 0, endMinutes: 24 * 60 }]);
});

it("getUnavailableRangesFromAvailability: dzień włączony daje zakresy przed startem i po końcu", () => {
  const monday = new Date("2026-07-06");
  const ranges = getUnavailableRangesFromAvailability(monday, [
    { dayOfWeek: 1, enabled: true, startTime: "08:00", endTime: "16:00" },
  ]);
  expect(ranges).toEqual([
    { startMinutes: 0, endMinutes: 8 * 60 },
    { startMinutes: 16 * 60, endMinutes: 24 * 60 },
  ]);
});

it("isDayAvailableForCreate: bez propa availability zawsze true (fallback)", () => {
  expect(isDayAvailableForCreate(new Date("2026-07-06"), undefined)).toBe(true);
});

it("isDayAvailableForCreate: dzień wyłączony w availability blokuje tworzenie", () => {
  const monday = new Date("2026-07-06");
  expect(
    isDayAvailableForCreate(monday, [{ dayOfWeek: 1, enabled: false, startTime: "09:00", endTime: "17:00" }]),
  ).toBe(false);
});

it("isDayAvailableForCreate: dzień włączony w availability pozwala tworzyć", () => {
  const monday = new Date("2026-07-06");
  expect(
    isDayAvailableForCreate(monday, [{ dayOfWeek: 1, enabled: true, startTime: "09:00", endTime: "17:00" }]),
  ).toBe(true);
});

it("buildBacklogDropBody buduje jednorazowy blok 'personal' od zaokrąglonego drop-Y na czas trwania pozycji backlogu", () => {
  const body = buildBacklogDropBody({
    name: "Siłownia",
    durationMinutes: 60,
    day: new Date("2026-07-06"), // poniedziałek
    startMinutes: 9 * 60 + 5, // niezaokrąglone — funkcja ma to znapować
  });

  expect(body.name).toBe("Siłownia");
  expect(body.type).toBe("personal");
  expect(body.startTime).toBe("09:00");
  expect(body.endTime).toBe("10:00");
  expect(body.daysOfWeek).toEqual([1]);
  expect(body.startDate).not.toBeNull();
});

it("buildBacklogDropBody przycina koniec do 24:00 gdy drop blisko północy przekroczyłby dobę", () => {
  const body = buildBacklogDropBody({
    name: "Krótkie",
    durationMinutes: 120,
    day: new Date("2026-07-06"),
    startMinutes: 23 * 60,
  });

  // endTime "00:00" wygląda na czas trwania 0, ale getInstances (lib/recurrence.ts)
  // zawija end<=start o +24h — więc "23:00"-"00:00" to poprawnie 1h, nie cała doba.
  expect(body.startTime).toBe("23:00");
  expect(body.endTime).toBe("00:00");
});

it("applyBlocksAction 'patch' scala pola patcha w blok o pasującym id", () => {
  const blocks = [
    { id: "a", name: "A", type: "work", startTime: "09:00", endTime: "17:00", daysOfWeek: [1], endDate: null },
    { id: "b", name: "B", type: "course", startTime: "10:00", endTime: "11:00", daysOfWeek: [2], endDate: null },
  ];

  const result = applyBlocksAction(blocks, { kind: "patch", id: "a", patch: { endTime: "18:00" } });

  expect(result.find((b) => b.id === "a")).toMatchObject({ startTime: "09:00", endTime: "18:00" });
  expect(result.find((b) => b.id === "b")).toEqual(blocks[1]);
});

it("applyBlocksAction 'patch' na nieznane id nic nie zmienia", () => {
  const blocks = [
    { id: "a", name: "A", type: "work", startTime: "09:00", endTime: "17:00", daysOfWeek: [1], endDate: null },
  ];

  const result = applyBlocksAction(blocks, { kind: "patch", id: "nope", patch: { endTime: "18:00" } });

  expect(result).toEqual(blocks);
});

it("applyBlocksAction 'add' dokleja nowy blok na koniec listy", () => {
  const blocks = [
    { id: "a", name: "A", type: "work", startTime: "09:00", endTime: "17:00", daysOfWeek: [1], endDate: null },
  ];
  const newBlock = { id: "optimistic-1", name: "Siłownia", type: "personal", startTime: "09:00", endTime: "10:00", daysOfWeek: [1], endDate: null };

  const result = applyBlocksAction(blocks, { kind: "add", block: newBlock });

  expect(result).toEqual([blocks[0], newBlock]);
});

it("applyBlocksAction 'remove' usuwa blok o pasującym id", () => {
  const blocks = [
    { id: "a", name: "A", type: "work", startTime: "09:00", endTime: "17:00", daysOfWeek: [1], endDate: null },
    { id: "b", name: "B", type: "course", startTime: "10:00", endTime: "11:00", daysOfWeek: [2], endDate: null },
  ];

  const result = applyBlocksAction(blocks, { kind: "remove", id: "a" });

  expect(result).toEqual([blocks[1]]);
});

it("applyBlocksAction 'remove' na nieznane id nic nie zmienia", () => {
  const blocks = [
    { id: "a", name: "A", type: "work", startTime: "09:00", endTime: "17:00", daysOfWeek: [1], endDate: null },
  ];

  const result = applyBlocksAction(blocks, { kind: "remove", id: "nope" });

  expect(result).toEqual(blocks);
});

it("snapToNearestFreeSlot: brak kolizji -> zwraca ten sam (zaokrąglony) start", () => {
  const result = snapToNearestFreeSlot([], { startMinutes: 600, durationMinutes: 60, bufferBefore: 0, bufferAfter: 0 });
  expect(result).toBe(600);
});

it("snapToNearestFreeSlot: kolizja dokładnie w żądanym miejscu -> przesuwa w dół (później) do najbliższego wolnego", () => {
  const daySegments = [seg("morning", 0, 600), seg("midday", 600, 660)];
  const result = snapToNearestFreeSlot(daySegments, { startMinutes: 600, durationMinutes: 60, bufferBefore: 0, bufferAfter: 0 });
  expect(result).toBe(660);
});

it("snapToNearestFreeSlot: reszta dnia zajęta -> przesuwa w górę (wcześniej)", () => {
  const daySegments = [seg("rest-of-day", 600, 1440)];
  const result = snapToNearestFreeSlot(daySegments, { startMinutes: 600, durationMinutes: 60, bufferBefore: 0, bufferAfter: 0 });
  expect(result).toBe(540);
});

it("snapToNearestFreeSlot: cały dzień zajęty -> null", () => {
  const daySegments = [seg("full-day", 0, 1440)];
  const result = snapToNearestFreeSlot(daySegments, { startMinutes: 600, durationMinutes: 60, bufferBefore: 0, bufferAfter: 0 });
  expect(result).toBeNull();
});

it("snapToNearestFreeSlot: excludeBlockId ignoruje własne segmenty bloku", () => {
  const daySegments = [seg("self", 600, 660)];
  const result = snapToNearestFreeSlot(daySegments, {
    startMinutes: 600,
    durationMinutes: 60,
    bufferBefore: 0,
    bufferAfter: 0,
    excludeBlockId: "self",
  });
  expect(result).toBe(600);
});

it("snapToNearestFreeSlot: bufor kandydata liczy się do obwiedni (kolizja mimo wolnego rdzenia)", () => {
  const daySegments = [seg("other", 660, 720)];
  // rdzeń 600-660 sam w sobie nie koliduje z other (660-720), ale bufferAfter=15
  // rozciąga obwiednię kandydata do 675, co już zachodzi na other -> musi się przesunąć.
  const result = snapToNearestFreeSlot(daySegments, {
    startMinutes: 600,
    durationMinutes: 60,
    bufferBefore: 0,
    bufferAfter: 15,
  });
  // Najbliższe wolne miejsce to 585 (15 min wcześniej: obwiednia 585-660,
  // styka się z "other" 660-720 bez zachodzenia) — bliżej niż 540.
  expect(result).toBe(585);
});

// Fix 4 (resize buforów za zewnętrzną krawędź scalonej karty): buforBefore/
// buforAfter liczone z pozycji przeciąganej zewnętrznej krawędzi względem
// stałej granicy zmiany (startTime/endTime nie ruszają się przy tym resize).
it("buildBufferResizePatch: zewnętrzna górna krawędź (before) liczy bufferBefore od startu zmiany", () => {
  const block = { startTime: "09:00", endTime: "17:00" };
  expect(buildBufferResizePatch(block, "before", 8 * 60 + 30)).toEqual({ bufferBefore: 30 });
});

it("buildBufferResizePatch: zewnętrzna dolna krawędź (after) liczy bufferAfter od końca zmiany", () => {
  const block = { startTime: "09:00", endTime: "17:00" };
  expect(buildBufferResizePatch(block, "after", 17 * 60 + 30)).toEqual({ bufferAfter: 30 });
});

it("buildBufferResizePatch: przeciągnięcie 'before' za granicę startu zmiany przycina do 0", () => {
  const block = { startTime: "09:00", endTime: "17:00" };
  expect(buildBufferResizePatch(block, "before", 9 * 60 + 10)).toEqual({ bufferBefore: 0 });
});

it("buildBufferResizePatch: przeciągnięcie 'after' za granicę końca zmiany przycina do 0", () => {
  const block = { startTime: "09:00", endTime: "17:00" };
  expect(buildBufferResizePatch(block, "after", 16 * 60 + 50)).toEqual({ bufferAfter: 0 });
});

it("buildBufferResizePatch: znapuje przeciąganą minutę do 15-minutowej siatki", () => {
  const block = { startTime: "09:00", endTime: "17:00" };
  // 08:42 (522 min) znapowane do 08:45 (525) -> bufferBefore = 540-525 = 15
  expect(buildBufferResizePatch(block, "before", 8 * 60 + 42)).toEqual({ bufferBefore: 15 });
});

// Fix (etykiety stref buforu): format podpisany znak + czas trwania + godzina
// graniczna — "−20 min · 08:40" (dojazd, musisz wyjechać o 08:40) / "+25 min ·
// 16:10" (odjazd, wolny dopiero o 16:10). Znak niesie kierunek, słowa
// "Dojazd"/"Odjazd" celowo pominięte (patrz DESIGN.md).
it("formatBufferLabel: pełny wariant 'before' ma minus, minuty, 'min' i godzinę graniczną", () => {
  expect(formatBufferLabel("before", 20, "08:40", "full")).toBe("−20 min · 08:40");
});

it("formatBufferLabel: pełny wariant 'after' ma plus, minuty, 'min' i godzinę graniczną", () => {
  expect(formatBufferLabel("after", 25, "16:10", "full")).toBe("+25 min · 16:10");
});

it("formatBufferLabel: wariant compact pomija słowo 'min' (mniej miejsca)", () => {
  expect(formatBufferLabel("before", 20, "08:40", "compact")).toBe("−20 · 08:40");
});
