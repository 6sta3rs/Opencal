import { expect, it } from "vitest";
import { getInstances } from "./recurrence";

it("blok pon+śr 'do odwołania' zwraca instancje w każdym tygodniu zakresu", () => {
  const block = {
    name: "Praca",
    startTime: "05:00",
    endTime: "06:00",
    daysOfWeek: [1, 3],
    endDate: null,
  };

  // 2026-07-06 = poniedziałek, zakres 2 tygodnie
  const instances = getInstances(block, new Date("2026-07-06"), new Date("2026-07-19"));

  expect(instances).toHaveLength(4);
  expect(instances.map((i) => i.start.getDay())).toEqual([1, 3, 1, 3]);
});

it("blok z datą końcową nie generuje instancji po tej dacie", () => {
  const block = {
    name: "Kurs",
    startTime: "10:00",
    endTime: "13:00",
    daysOfWeek: [1],
    endDate: new Date("2026-07-06"),
  };

  const instances = getInstances(block, new Date("2026-07-06"), new Date("2026-07-19"));

  expect(instances).toHaveLength(1);
});

it("wyjątek z nową godziną zmienia tylko tę instancję, pozostałe tygodnie bez zmian", () => {
  const block = {
    name: "Praca",
    startTime: "05:00",
    endTime: "06:00",
    daysOfWeek: [1],
    endDate: null,
  };
  // 2026-07-13 = drugi poniedziałek zakresu
  const exceptions = [{ date: new Date("2026-07-13"), startTime: "08:00", endTime: "09:00" }];

  const instances = getInstances(block, new Date("2026-07-06"), new Date("2026-07-19"), exceptions);

  expect(instances).toHaveLength(2);
  expect(instances[0].start.getHours()).toBe(5);
  expect(instances[1].start.getHours()).toBe(8);
  expect(instances[1].end.getHours()).toBe(9);
});

it("odwołana instancja (np. święto) znika, a pozostałe tygodnie serii zostają", () => {
  const block = {
    name: "Praca",
    startTime: "05:00",
    endTime: "06:00",
    daysOfWeek: [1],
    endDate: null,
  };
  const exceptions = [{ date: new Date("2026-07-13"), cancelled: true }];

  const instances = getInstances(block, new Date("2026-07-06"), new Date("2026-07-19"), exceptions);

  expect(instances).toHaveLength(1);
  expect(instances[0].start.toISOString().slice(0, 10)).toBe("2026-07-06");
});

it("blok wstrzymany nie generuje żadnych instancji, a wznowienie przywraca serię", () => {
  const block = {
    name: "Praca",
    startTime: "05:00",
    endTime: "06:00",
    daysOfWeek: [1],
    endDate: null,
  };
  const range = [new Date("2026-07-06"), new Date("2026-07-19")] as const;

  expect(getInstances({ ...block, isPaused: true }, ...range)).toHaveLength(0);
  expect(getInstances({ ...block, isPaused: false }, ...range)).toHaveLength(2);
});

it("zmiana nocna 17:00–02:00 daje instancję kończącą się następnego dnia", () => {
  const block = {
    name: "Nocka",
    startTime: "17:00",
    endTime: "02:00",
    daysOfWeek: [1],
    endDate: null,
  };

  const [instance] = getInstances(block, new Date("2026-07-06"), new Date("2026-07-06"));

  expect(instance.start.toISOString().slice(0, 10)).toBe("2026-07-06");
  expect(instance.end.toISOString().slice(0, 10)).toBe("2026-07-07");
  expect(instance.end.getHours()).toBe(2);
});
