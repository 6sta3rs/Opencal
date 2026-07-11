import { getInstances } from "./recurrence";
import { getWeekDays } from "./planner-grid";
import type { PlannerBlock } from "./planner-grid";

// ponytail: te same 4 typy co PlannerGrid.TYPE_LABELS — nie ma tu wspólnego
// modułu, bo lista jest trywialna (4 stałe stringi) i nie warto łączyć plików
// dla tego jednej stałej.
export const BLOCK_TYPES = ["work", "course", "personal", "overnight"] as const;

export type NearestShift = {
  blockId: string;
  name: string;
  type: string;
  staysOvernight: boolean;
  start: Date;
  end: Date;
};

/**
 * Najbliższa zmiana (trwająca lub nadchodząca) spośród wszystkich
 * nie-wstrzymanych bloków, licząc od `now` w oknie `horizonDays` dni naprzód.
 */
export function findNearestShift(
  blocks: PlannerBlock[],
  now: Date,
  horizonDays = 14,
): NearestShift | null {
  const rangeEnd = new Date(now);
  rangeEnd.setDate(rangeEnd.getDate() + horizonDays);

  let nearest: NearestShift | null = null;

  for (const block of blocks) {
    const instances = getInstances(
      {
        startTime: block.startTime,
        endTime: block.endTime,
        daysOfWeek: block.daysOfWeek,
        endDate: block.endDate ? new Date(block.endDate) : null,
        isPaused: block.isPaused,
      },
      now,
      rangeEnd,
      (block.exceptions ?? []).map((e) => ({
        date: new Date(e.date),
        startTime: e.startTime,
        endTime: e.endTime,
        cancelled: e.cancelled,
      })),
    );

    for (const instance of instances) {
      if (instance.end <= now) continue; // już się skończyła
      if (!nearest || instance.start < nearest.start) {
        nearest = {
          blockId: block.id,
          name: block.name,
          type: block.type,
          staysOvernight: block.staysOvernight ?? false,
          start: instance.start,
          end: instance.end,
        };
      }
    }
  }

  return nearest;
}

/**
 * Długość bloku ("HH:MM" → "HH:MM") jako etykieta godzin, np. "8h" albo
 * "3,5h". Obsługuje bloki przechodzące przez północ (nocleg).
 */
export function formatBlockHours(startTime: string, endTime: string): string {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const diffMinutes = ((toMinutes(endTime) - toMinutes(startTime)) + 1440) % 1440;
  const hours = diffMinutes / 60;
  const label = Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace(".", ",");
  return `${label}h`;
}

/**
 * Suma zaplanowanych godzin w tygodniu (pon-niedz zawierającym `now`),
 * pogrupowana wg typu bloku — do statystyk w sidebarze. Ta sama metoda co
 * lib/planner-grid.ts#computeGridSegments (getInstances na zakresie tygodnia),
 * ale bez rozbicia na segmenty/bufory — tu liczy się tylko suma godzin.
 */
export function weeklyHoursByType(blocks: PlannerBlock[], now: Date): Record<string, number> {
  const week = getWeekDays(now);
  const rangeStart = week[0];
  const rangeEnd = week[week.length - 1];
  const totals: Record<string, number> = {};

  for (const block of blocks) {
    const instances = getInstances(
      {
        startTime: block.startTime,
        endTime: block.endTime,
        daysOfWeek: block.daysOfWeek,
        endDate: block.endDate ? new Date(block.endDate) : null,
        startDate: block.startDate ? new Date(block.startDate) : null,
        isPaused: block.isPaused,
      },
      rangeStart,
      rangeEnd,
      (block.exceptions ?? []).map((e) => ({
        date: new Date(e.date),
        startTime: e.startTime,
        endTime: e.endTime,
        cancelled: e.cancelled,
      })),
    );

    for (const instance of instances) {
      const hours = (instance.end.getTime() - instance.start.getTime()) / 3_600_000;
      totals[block.type] = (totals[block.type] ?? 0) + hours;
    }
  }

  return totals;
}
