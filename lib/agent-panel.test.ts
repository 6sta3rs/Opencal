import { expect, it } from "vitest";
import { formatSlotLabel, slotToBlockBody } from "./agent-panel";
import { getInstances } from "./recurrence";

it("formatuje slot na polską etykietę dzień + zakres godzin dla karty sugestii", () => {
  // 2026-07-13 = poniedziałek
  const slot = { start: "2026-07-13T16:00:00.000Z", end: "2026-07-13T19:00:00.000Z" };

  const label = formatSlotLabel(slot);

  const start = new Date(slot.start);
  const end = new Date(slot.end);
  const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const dayLabel = start.toLocaleDateString("pl-PL", { weekday: "short", day: "numeric", month: "numeric" });

  expect(label).toBe(`${dayLabel}, ${hhmm(start)}–${hhmm(end)}`);
});

it("konwertuje slot agenta na body dla POST /api/blocks z godzinami HH:MM i dniem tygodnia startu", () => {
  // 2026-07-13 = poniedziałek
  const slot = { start: "2026-07-13T16:00:00.000Z", end: "2026-07-13T19:00:00.000Z" };

  const body = slotToBlockBody(slot);

  expect(body.startTime).toBe(
    `${String(new Date(slot.start).getHours()).padStart(2, "0")}:${String(new Date(slot.start).getMinutes()).padStart(2, "0")}`,
  );
  expect(body.endTime).toBe(
    `${String(new Date(slot.end).getHours()).padStart(2, "0")}:${String(new Date(slot.end).getMinutes()).padStart(2, "0")}`,
  );
  expect(body.daysOfWeek).toEqual([new Date(slot.start).getDay()]);
});

it("endDate ustawiony tak, że getInstances zwraca dokładnie jedną instancję (bez cyklicznego powtórzenia co tydzień)", () => {
  const slot = { start: "2026-07-13T16:00:00.000Z", end: "2026-07-13T19:00:00.000Z" };
  const body = slotToBlockBody(slot);

  // Przeszukujemy szeroki, wielotygodniowy zakres — mimo że daysOfWeek dopasuje się
  // co tydzień, blok jednorazowy ma wystąpić tylko raz.
  const instances = getInstances(body, new Date("2026-07-01"), new Date("2026-08-31"));

  expect(instances).toHaveLength(1);
});
