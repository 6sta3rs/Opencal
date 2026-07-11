export type AvailabilityDay = {
  dayOfWeek: number; // 0=niedziela..6=sobota (Date#getDay)
  enabled: boolean;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
};

// Kolejność wyświetlania Pon..Nie zamiast natywnej Date#getDay (Nie=0..Sob=6).
export const MON_FIRST_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const DEFAULT_AVAILABILITY: AvailabilityDay[] = MON_FIRST_ORDER.map((dayOfWeek) => ({
  dayOfWeek,
  enabled: dayOfWeek >= 1 && dayOfWeek <= 5,
  startTime: "09:00",
  endTime: "17:00",
}));

export function sortMonFirst<T extends { dayOfWeek: number }>(days: T[]): T[] {
  return [...days].sort((a, b) => MON_FIRST_ORDER.indexOf(a.dayOfWeek) - MON_FIRST_ORDER.indexOf(b.dayOfWeek));
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// Zwraca komunikat błędu albo null gdy payload jest poprawny.
export function validateAvailabilityPayload(data: unknown): string | null {
  if (!Array.isArray(data) || data.length !== 7) {
    return "wymagana lista dokładnie 7 dni";
  }
  const seen = new Set<number>();
  for (const day of data) {
    if (
      typeof day !== "object" ||
      day === null ||
      typeof (day as AvailabilityDay).dayOfWeek !== "number" ||
      typeof (day as AvailabilityDay).enabled !== "boolean"
    ) {
      return "każdy dzień musi mieć dayOfWeek (liczba) i enabled (boolean)";
    }
    const { dayOfWeek, startTime, endTime } = day as AvailabilityDay;
    if (dayOfWeek < 0 || dayOfWeek > 6 || seen.has(dayOfWeek)) {
      return "dayOfWeek musi być unikalną liczbą 0-6";
    }
    seen.add(dayOfWeek);
    if (!HHMM.test(startTime) || !HHMM.test(endTime)) {
      return "startTime/endTime muszą mieć format HH:MM";
    }
  }
  return null;
}

const DAY_ABBR: Record<number, string> = {
  1: "pon.",
  2: "wt.",
  3: "śr.",
  4: "czw.",
  5: "pt.",
  6: "sob.",
  0: "niedz.",
};

// Zwięzłe podsumowanie dostępności do karty na /dostepnosc, np.
// "pon. – pt., 09:00 – 17:00; sob., 10:00 – 14:00". Sąsiadujące (w kolejności
// Pon..Nie) włączone dni o identycznych godzinach zwijamy w jeden zakres.
export function formatAvailabilitySummary(days: AvailabilityDay[]): string {
  const ordered = sortMonFirst(days).filter((d) => d.enabled);
  if (ordered.length === 0) {
    return "Brak dostępnych dni";
  }

  const groups: AvailabilityDay[][] = [];
  for (const day of ordered) {
    const last = groups[groups.length - 1];
    const prev = last?.[last.length - 1];
    const consecutive = prev
      ? MON_FIRST_ORDER.indexOf(day.dayOfWeek) === MON_FIRST_ORDER.indexOf(prev.dayOfWeek) + 1
      : false;
    if (last && consecutive && prev!.startTime === day.startTime && prev!.endTime === day.endTime) {
      last.push(day);
    } else {
      groups.push([day]);
    }
  }

  return groups
    .map((group) => {
      const first = group[0];
      const last = group[group.length - 1];
      const label =
        group.length === 1 ? DAY_ABBR[first.dayOfWeek] : `${DAY_ABBR[first.dayOfWeek]} – ${DAY_ABBR[last.dayOfWeek]}`;
      return `${label}, ${first.startTime} – ${first.endTime}`;
    })
    .join("; ");
}
