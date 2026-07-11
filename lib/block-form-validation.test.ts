import { expect, it } from "vitest";
import { validateBlockForm, validateOvernightRangeForm } from "./block-form-validation";

it("brak nazwy → błąd przy polu name", () => {
  const errors = validateBlockForm({
    name: "",
    startTime: "09:00",
    endTime: "17:00",
    daysOfWeek: [1],
  });

  expect(errors.name).toBeDefined();
});

it("startTime spoza formatu HH:MM → błąd przy polu startTime", () => {
  const errors = validateBlockForm({
    name: "Praca",
    startTime: "9:00",
    endTime: "17:00",
    daysOfWeek: [1],
  });

  expect(errors.startTime).toBeDefined();
});

it("endTime spoza formatu HH:MM → błąd przy polu endTime", () => {
  const errors = validateBlockForm({
    name: "Praca",
    startTime: "09:00",
    endTime: "25:00",
    daysOfWeek: [1],
  });

  expect(errors.endTime).toBeDefined();
});

it("brak wybranego dnia tygodnia → błąd przy polu daysOfWeek", () => {
  const errors = validateBlockForm({
    name: "Praca",
    startTime: "09:00",
    endTime: "17:00",
    daysOfWeek: [],
  });

  expect(errors.daysOfWeek).toBeDefined();
});

it("poprawne dane → brak błędów", () => {
  const errors = validateBlockForm({
    name: "Praca",
    startTime: "09:00",
    endTime: "17:00",
    daysOfWeek: [1],
  });

  expect(errors).toEqual({});
});

it("validateOvernightRangeForm: brak nazwy → błąd przy polu name", () => {
  const errors = validateOvernightRangeForm({
    name: "",
    startDate: new Date("2026-07-06"),
    startTime: "21:00",
    endDate: new Date("2026-07-08"),
    endTime: "07:00",
  });

  expect(errors.name).toBeDefined();
});

it("validateOvernightRangeForm: brak wybranej daty startu → błąd przy polu start", () => {
  const errors = validateOvernightRangeForm({
    name: "Delegacja",
    startDate: null,
    startTime: "21:00",
    endDate: new Date("2026-07-08"),
    endTime: "07:00",
  });

  expect(errors.start).toBeDefined();
});

it("validateOvernightRangeForm: brak wybranej daty końca → błąd przy polu end", () => {
  const errors = validateOvernightRangeForm({
    name: "Delegacja",
    startDate: new Date("2026-07-06"),
    startTime: "21:00",
    endDate: null,
    endTime: "07:00",
  });

  expect(errors.end).toBeDefined();
});

it("validateOvernightRangeForm: koniec nie po początku → błąd przy polu end", () => {
  const errors = validateOvernightRangeForm({
    name: "Delegacja",
    startDate: new Date("2026-07-08"),
    startTime: "07:00",
    endDate: new Date("2026-07-06"),
    endTime: "21:00",
  });

  expect(errors.end).toBeDefined();
});

it("validateOvernightRangeForm: poprawne dane → brak błędów", () => {
  const errors = validateOvernightRangeForm({
    name: "Delegacja",
    startDate: new Date("2026-07-06"),
    startTime: "21:00",
    endDate: new Date("2026-07-08"),
    endTime: "07:00",
  });

  expect(errors).toEqual({});
});
