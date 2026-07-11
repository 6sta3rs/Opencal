import { calculateEarnings } from "./earnings";

export type LineItemInput = { label: string; amount: number };

export type EarningsFormState = {
  start: string; // wartość <input type="datetime-local">, np. "2026-07-10T06:00"
  end: string;
  breakDuration: number;
  hourlyRate: number;
  lineItems: LineItemInput[];
};

// Konwertuje stan formularza (stringi z datetime-local) na kształt
// EarningsInput i liczy sumę — jedno miejsce, z którego korzysta i podgląd
// live w EarningsPanel, i (docelowo) zapis przez /api/entries.
export function calculateFormEarnings(form: EarningsFormState): number {
  if (!form.start || !form.end) return 0;
  return calculateEarnings(
    {
      start: new Date(form.start),
      end: new Date(form.end),
      breakDuration: form.breakDuration,
      hourlyRate: form.hourlyRate,
      additionalPay: 0,
    },
    form.lineItems,
  );
}
