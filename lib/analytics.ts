import { calculateEarnings, type EarningsInput } from "./earnings";

type Entry = EarningsInput & {
  client: string | null;
  lineItems: { amount: number }[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

// Podsumowanie miesiąca: sumy + rozbicie wg dnia tygodnia i klienta.
// Szkice (isDraft) filtruje wywołujący (route) przed przekazaniem tutaj.
export function summarizeMonth(entries: Entry[]) {
  const byDayOfWeek = Array.from({ length: 7 }, (_, day) => ({ day, hours: 0, earnings: 0 }));
  const byClientMap = new Map<string, { hours: number; earnings: number }>();
  let totalHours = 0;
  let totalEarnings = 0;

  for (const entry of entries) {
    const hours =
      ((entry.end.getTime() - entry.start.getTime()) / 60000 - entry.breakDuration) / 60;
    const earnings = calculateEarnings(entry, entry.lineItems);
    totalHours += hours;
    totalEarnings += earnings;

    const day = byDayOfWeek[entry.start.getDay()];
    day.hours += hours;
    day.earnings += earnings;

    const clientKey = entry.client ?? "brak klienta";
    const client = byClientMap.get(clientKey) ?? { hours: 0, earnings: 0 };
    client.hours += hours;
    client.earnings += earnings;
    byClientMap.set(clientKey, client);
  }

  return {
    totalHours: round2(totalHours),
    totalEarnings: round2(totalEarnings),
    byDayOfWeek: byDayOfWeek.map((d) => ({ ...d, hours: round2(d.hours), earnings: round2(d.earnings) })),
    byClient: Array.from(byClientMap, ([client, v]) => ({
      client,
      hours: round2(v.hours),
      earnings: round2(v.earnings),
    })),
  };
}
