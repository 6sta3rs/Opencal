export type BlockFormValues = {
  name: string;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
};

export type BlockFormErrors = Partial<Record<keyof BlockFormValues, string>>;

// ponytail: ten sam wzorzec co server-side w app/api/blocks/route.ts —
// duplikacja jednej linijki, nie warto importować z pliku route (pociągnąłby
// prismę do bundla klienta).
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validateBlockForm(values: BlockFormValues): BlockFormErrors {
  const errors: BlockFormErrors = {};
  if (!values.name.trim()) errors.name = "Nazwa jest wymagana.";
  if (!HHMM.test(values.startTime)) errors.startTime = "Godzina musi mieć format HH:MM.";
  if (!HHMM.test(values.endTime)) errors.endTime = "Godzina musi mieć format HH:MM.";
  if (values.daysOfWeek.length === 0) errors.daysOfWeek = "Wybierz co najmniej jeden dzień tygodnia.";
  return errors;
}

// Fix 2b: formularz jednorazowego noclegu (typ "overnight") — Start/Koniec to
// para data+godzina (shadcn Calendar + time input) zamiast dni tygodnia +
// jedna para godzin jak w zwykłym bloku, stąd osobna walidacja.
export type OvernightRangeFormValues = {
  name: string;
  startDate: Date | null;
  startTime: string;
  endDate: Date | null;
  endTime: string;
};

export type OvernightRangeFormErrors = Partial<Record<"name" | "start" | "end", string>>;

function combineDateAndTime(date: Date, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

export function validateOvernightRangeForm(values: OvernightRangeFormValues): OvernightRangeFormErrors {
  const errors: OvernightRangeFormErrors = {};
  if (!values.name.trim()) errors.name = "Nazwa jest wymagana.";
  if (!values.startDate || !HHMM.test(values.startTime)) errors.start = "Wybierz datę i godzinę początku.";
  if (!values.endDate || !HHMM.test(values.endTime)) errors.end = "Wybierz datę i godzinę końca.";
  if (!errors.start && !errors.end) {
    const start = combineDateAndTime(values.startDate!, values.startTime);
    const end = combineDateAndTime(values.endDate!, values.endTime);
    if (end <= start) errors.end = "Koniec musi być po początku.";
  }
  return errors;
}
