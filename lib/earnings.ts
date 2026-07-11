export type EarningsInput = {
  start: Date;
  end: Date;
  breakDuration: number;
  hourlyRate: number;
  additionalPay: number;
};

// (minuty(end-start) - przerwa)/60 × stawka + dodatek, zaokrąglone do groszy.
// ponytail: liczymy na float (minuty int, stawka float) i zaokrąglamy wynik —
// sufit: przy dużych kwotach/wielu operacjach float gubi grosze, przejść na
// Decimal (np. decimal.js) gdyby pojawiły się rozjazdy w audycie
export function calculateEarnings(
  entry: EarningsInput,
  lineItems: { amount: number }[] = [],
): number {
  const minutes =
    (entry.end.getTime() - entry.start.getTime()) / 60000 - entry.breakDuration;
  const hours = minutes / 60;
  const extras = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const total = hours * entry.hourlyRate + entry.additionalPay + extras;
  return Math.round(total * 100) / 100;
}

// Dokleja wyliczone `earnings` do odpowiedzi API (POST/PATCH entries, line-items).
export function withEarnings<
  T extends EarningsInput & { lineItems?: { amount: number }[] },
>(entry: T) {
  return { ...entry, earnings: calculateEarnings(entry, entry.lineItems ?? []) };
}
