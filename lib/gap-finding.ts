import { atTime, getInstances } from "./recurrence";

const DAY_MS = 24 * 60 * 60 * 1000;

type GapBlock = {
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  endDate: Date | null;
  bufferBefore?: number;
  bufferAfter?: number;
  staysOvernight?: boolean;
  departureTime?: Date | null;
};

type GapRequest = {
  durationMinutes: number;
  bufferBefore?: number;
  bufferAfter?: number;
  // ponytail: tylko "po HH:MM" względem dnia startu luki — dołożyć "before"
  // i luki wielodniowe, gdy agent zacznie przekazywać pełne okna preferencji
  preferredWindow?: { after: string };
};

type Gap = { start: Date; end: Date };

// Źródło zewnętrznej zajętości (np. Google Calendar) — ticket 08 podmieni
// mock na realny odczyt API, dlatego kontrakt jest asynchroniczny.
export type BusySource = (rangeStart: Date, rangeEnd: Date) => Promise<Gap[]>;

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

// Instancja bloku → przedział zajętości: bufory po obu stronach,
// a przy noclegu koniec przeciągnięty do wyjazdu z pracy.
function busyInterval(block: GapBlock, instance: Gap): Gap {
  // ponytail: przy noclegu jedno departureTime rozciąga każdą instancję
  // kończącą się przed nim — wystarcza dla pojedynczego wyjazdu; przy
  // cyklicznych noclegach departureTime musi stać się regułą per instancja
  const stayedUntil =
    block.staysOvernight && block.departureTime && block.departureTime > instance.end
      ? block.departureTime
      : instance.end;
  return {
    start: addMinutes(instance.start, -(block.bufferBefore ?? 0)),
    end: addMinutes(stayedUntil, block.bufferAfter ?? 0),
  };
}

export function findGaps(
  blocks: GapBlock[],
  rangeStart: Date,
  rangeEnd: Date,
  request: GapRequest,
  externalBusy: Gap[] = [],
): Gap[] {
  // ponytail: lookback 1 dzień łapie zmiany nocne (i ich bufory) wystające
  // w zakres — wydłużyć, gdy blok będzie mógł blokować czas dłużej niż dobę
  const lookbackStart = new Date(rangeStart.getTime() - DAY_MS);
  const busy = blocks
    .flatMap((block) =>
      getInstances(block, lookbackStart, rangeEnd).map((instance) => busyInterval(block, instance)),
    )
    .concat(externalBusy)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  // Sweep kursorem po posortowanej zajętości scala nachodzące przedziały
  // (własne bloki i eventy zewnętrzne) — kursor idzie tylko do przodu,
  // więc nakładki nie dublują zajętości ani nie tworzą fałszywych luk.

  const gaps: Gap[] = [];
  let cursor = rangeStart;

  for (const interval of busy) {
    if (interval.start > cursor)
      gaps.push({ start: cursor, end: interval.start < rangeEnd ? interval.start : rangeEnd });
    if (interval.end > cursor) cursor = interval.end;
  }
  if (cursor < rangeEnd) gaps.push({ start: cursor, end: rangeEnd });

  const after = request.preferredWindow?.after;
  const clipped = after
    ? gaps.map((gap) => {
        const windowStart = atTime(gap.start, after);
        return windowStart > gap.start ? { start: windowStart, end: gap.end } : gap;
      })
    : gaps;

  const requiredMinutes =
    (request.bufferBefore ?? 0) + request.durationMinutes + (request.bufferAfter ?? 0);
  return clipped.filter((gap) => gap.end >= addMinutes(gap.start, requiredMinutes));
}

export async function findGapsWithBusySource(
  blocks: GapBlock[],
  rangeStart: Date,
  rangeEnd: Date,
  request: GapRequest,
  busySource: BusySource,
): Promise<Gap[]> {
  return findGaps(blocks, rangeStart, rangeEnd, request, await busySource(rangeStart, rangeEnd));
}
