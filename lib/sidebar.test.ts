import { expect, it } from "vitest";
import { findNearestShift, formatBlockHours } from "./sidebar";

it("znajduje najbliższą nadchodzącą zmianę spośród bloków", () => {
  const now = new Date("2026-07-06T08:00:00"); // poniedziałek 08:00

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

  const nearest = findNearestShift(blocks, now);

  expect(nearest).toMatchObject({ blockId: "b1", name: "Praca" });
  expect(nearest?.start).toEqual(new Date("2026-07-06T09:00:00"));
});

it("pomija wstrzymane bloki (isPaused)", () => {
  const now = new Date("2026-07-06T08:00:00");

  const blocks = [
    {
      id: "b1",
      name: "Wstrzymana",
      type: "work",
      startTime: "09:00",
      endTime: "17:00",
      daysOfWeek: [1],
      endDate: null,
      isPaused: true,
    },
  ];

  expect(findNearestShift(blocks, now)).toBeNull();
});

it("gdy trwa zmiana teraz, zwraca ją zamiast kolejnej w przyszłości", () => {
  const now = new Date("2026-07-06T10:00:00"); // w trakcie zmiany 09:00-17:00

  const blocks = [
    {
      id: "b1",
      name: "Trwająca",
      type: "work",
      startTime: "09:00",
      endTime: "17:00",
      daysOfWeek: [1],
      endDate: null,
    },
  ];

  const nearest = findNearestShift(blocks, now);
  expect(nearest?.blockId).toBe("b1");
  expect(nearest?.start).toEqual(new Date("2026-07-06T09:00:00"));
});

it("spośród kilku bloków wybiera ten z najwcześniejszym startem", () => {
  const now = new Date("2026-07-06T08:00:00");

  const blocks = [
    {
      id: "later",
      name: "Później",
      type: "work",
      startTime: "12:00",
      endTime: "16:00",
      daysOfWeek: [1],
      endDate: null,
    },
    {
      id: "sooner",
      name: "Wcześniej",
      type: "course",
      startTime: "09:00",
      endTime: "11:00",
      daysOfWeek: [1],
      endDate: null,
    },
  ];

  expect(findNearestShift(blocks, now)?.blockId).toBe("sooner");
});

it("formatuje długość bloku w godzinach", () => {
  expect(formatBlockHours("09:00", "17:00")).toBe("8h");
});

it("formatuje długość bloku nocnego przechodzącego przez północ", () => {
  expect(formatBlockHours("22:00", "06:00")).toBe("8h");
});

it("formatuje niepełne godziny z przecinkiem", () => {
  expect(formatBlockHours("09:00", "12:30")).toBe("3,5h");
});
