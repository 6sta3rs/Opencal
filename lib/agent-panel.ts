export type Slot = { start: string; end: string };

function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Etykieta karty sugestii agenta: dzień tygodnia + data + zakres godzin, po polsku
// (ten sam wzorzec co formatShiftLabel w PlannerSidebar, ale bez zależności od
// tamtego pliku — poza moim zakresem edycji w tym tickecie).
export function formatSlotLabel(slot: Slot): string {
  const start = new Date(slot.start);
  const dayLabel = start.toLocaleDateString("pl-PL", { weekday: "short", day: "numeric", month: "numeric" });
  return `${dayLabel}, ${hhmm(slot.start)}–${hhmm(slot.end)}`;
}

// Konwertuje wolne okno znalezione przez agenta na body dla POST /api/blocks —
// jednorazowy blok (nie cykl): daysOfWeek = [dzień startu], startDate/endDate
// zawężają okno do dokładnie jednego dnia. getInstances porównuje
// `day <= endDate` z zachowaniem pory dnia iterującego wskaźnika, więc "koniec
// tego samego dnia" mógłby wypaść przed nim w niektórych zakresach —
// "dzień później" pokrywa cały dzień startu niezależnie od pory i wyklucza
// powtórkę za tydzień w przód. Sama górna granica NIE wystarcza: przy
// przeszukiwaniu szerokiego zakresu wstecz ten sam dzień tygodnia sprzed
// startu (np. tydzień wcześniej) nadal by pasował — stąd też startDate jako
// dolna granica (patrz lib/recurrence.ts).
// ponytail: startDate nie jest jeszcze kolumną w schemacie RecurringBlock —
// POST /api/blocks musi go pominąć/odrzucić do czasu migracji; zgłoszone jako
// osobne zadanie (patrz spawn_task w tej sesji), żeby Faza B nie trafiła na
// 500 przy realnym zapisie sugestii agenta.
export function slotToBlockBody(slot: Slot) {
  const start = new Date(slot.start);
  const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDate = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
  return {
    name: "Sugestia agenta",
    type: "personal",
    startTime: hhmm(slot.start),
    endTime: hhmm(slot.end),
    daysOfWeek: [start.getDay()],
    startDate,
    endDate,
  };
}
