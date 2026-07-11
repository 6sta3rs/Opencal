import { expect, it } from "vitest";
import { findGaps, findGapsWithBusySource, type BusySource } from "./gap-finding";

// 2026-07-06 = poniedziałek (por. lib/recurrence.test.ts)

it("dwa bloki w dniu → jedna luka między nimi", () => {
  const blocks = [
    { name: "Praca", startTime: "05:00", endTime: "06:00", daysOfWeek: [1], endDate: null },
    { name: "Kurs", startTime: "10:00", endTime: "13:00", daysOfWeek: [1], endDate: null },
  ];

  const gaps = findGaps(
    blocks,
    new Date("2026-07-06T05:00"),
    new Date("2026-07-06T13:00"),
    { durationMinutes: 60 },
  );

  expect(gaps).toEqual([
    { start: new Date("2026-07-06T06:00"), end: new Date("2026-07-06T10:00") },
  ]);
});

it("luka krótsza niż żądane durationMinutes jest odrzucana", () => {
  const blocks = [
    { name: "Praca", startTime: "05:00", endTime: "06:00", daysOfWeek: [1], endDate: null },
    { name: "Kurs", startTime: "10:00", endTime: "13:00", daysOfWeek: [1], endDate: null },
  ];

  const gaps = findGaps(
    blocks,
    new Date("2026-07-06T05:00"),
    new Date("2026-07-06T13:00"),
    { durationMinutes: 300 },
  );

  expect(gaps).toEqual([]);
});

it("dzień bez bloków → całe okno zakresu jako jedna luka", () => {
  const blocks = [
    { name: "Praca", startTime: "05:00", endTime: "06:00", daysOfWeek: [2], endDate: null },
  ];

  // poniedziałek — blok wypada tylko we wtorek
  const gaps = findGaps(
    blocks,
    new Date("2026-07-06T00:00"),
    new Date("2026-07-07T00:00"),
    { durationMinutes: 60 },
  );

  expect(gaps).toEqual([
    { start: new Date("2026-07-06T00:00"), end: new Date("2026-07-07T00:00") },
  ]);
});

it("preferredWindow 'po 14:00' odcina kandydatów sprzed tej godziny", () => {
  const blocks = [
    { name: "Kurs", startTime: "15:00", endTime: "16:00", daysOfWeek: [1], endDate: null },
  ];

  const gaps = findGaps(
    blocks,
    new Date("2026-07-06T00:00"),
    new Date("2026-07-07T00:00"),
    { durationMinutes: 60, preferredWindow: { after: "14:00" } },
  );

  expect(gaps).toEqual([
    { start: new Date("2026-07-06T14:00"), end: new Date("2026-07-06T15:00") },
    { start: new Date("2026-07-06T16:00"), end: new Date("2026-07-07T00:00") },
  ]);
});

it("praca 17:00–02:00 z buforem po 45 min → wolne dopiero od 02:45", () => {
  const blocks = [
    {
      name: "Praca",
      startTime: "17:00",
      endTime: "02:00",
      daysOfWeek: [1],
      endDate: null,
      bufferAfter: 45,
    },
  ];

  // wtorkowy poranek po nocnej zmianie z poniedziałku
  const gaps = findGaps(
    blocks,
    new Date("2026-07-07T00:00"),
    new Date("2026-07-07T12:00"),
    { durationMinutes: 60 },
  );

  expect(gaps).toEqual([
    { start: new Date("2026-07-07T02:45"), end: new Date("2026-07-07T12:00") },
  ]);
});

it("zmiana poranna 5:00–6:00 z buforami 25/25 → wolne do 04:35 i od 06:25", () => {
  const blocks = [
    {
      name: "Zmiana poranna",
      startTime: "05:00",
      endTime: "06:00",
      daysOfWeek: [1],
      endDate: null,
      bufferBefore: 25,
      bufferAfter: 25,
    },
  ];

  const gaps = findGaps(
    blocks,
    new Date("2026-07-06T00:00"),
    new Date("2026-07-06T12:00"),
    { durationMinutes: 60 },
  );

  expect(gaps).toEqual([
    { start: new Date("2026-07-06T00:00"), end: new Date("2026-07-06T04:35") },
    { start: new Date("2026-07-06T06:25"), end: new Date("2026-07-06T12:00") },
  ]);
});

it("kurs 3h z buforami żądania 15/15 wymaga łącznie 3h30min wolnego okna", () => {
  const blocks = [
    { name: "A", startTime: "08:00", endTime: "10:00", daysOfWeek: [1], endDate: null },
    { name: "B", startTime: "13:20", endTime: "14:00", daysOfWeek: [1], endDate: null },
    { name: "C", startTime: "17:30", endTime: "18:00", daysOfWeek: [1], endDate: null },
  ];

  // luka 10:00–13:20 ma 3h20min (za mało), luka 14:00–17:30 ma 3h30min (wystarcza)
  const gaps = findGaps(
    blocks,
    new Date("2026-07-06T08:00"),
    new Date("2026-07-06T18:00"),
    { durationMinutes: 180, bufferBefore: 15, bufferAfter: 15 },
  );

  expect(gaps).toEqual([
    { start: new Date("2026-07-06T14:00"), end: new Date("2026-07-06T17:30") },
  ]);
});

it("bufory liczą się per blok — blok bez buforów nie zawęża luki ze swojej strony", () => {
  const blocks = [
    {
      name: "Praca",
      startTime: "08:00",
      endTime: "10:00",
      daysOfWeek: [1],
      endDate: null,
      bufferAfter: 30,
    },
    { name: "Kurs", startTime: "14:00", endTime: "16:00", daysOfWeek: [1], endDate: null },
  ];

  const gaps = findGaps(
    blocks,
    new Date("2026-07-06T08:00"),
    new Date("2026-07-06T16:00"),
    { durationMinutes: 60 },
  );

  expect(gaps).toEqual([
    { start: new Date("2026-07-06T10:30"), end: new Date("2026-07-06T14:00") },
  ]);
});

it("nocleg w pracy: zero wolnych okien między końcem zmiany a departureTime", () => {
  const blocks = [
    {
      name: "Nocka z noclegiem",
      startTime: "17:00",
      endTime: "02:00",
      daysOfWeek: [2],
      endDate: null,
      staysOvernight: true,
      departureTime: new Date("2026-07-08T09:00"), // środa rano
    },
  ];

  // zmiana z wtorku kończy się w środę 02:00, ale wyjazd dopiero o 09:00
  const gaps = findGaps(
    blocks,
    new Date("2026-07-08T00:00"),
    new Date("2026-07-08T12:00"),
    { durationMinutes: 60 },
  );

  expect(gaps).toEqual([
    { start: new Date("2026-07-08T09:00"), end: new Date("2026-07-08T12:00") },
  ]);
});

it("nocleg w pracy: pierwsze wolne okno zaczyna się departureTime + bufferAfter", () => {
  const blocks = [
    {
      name: "Nocka z noclegiem",
      startTime: "17:00",
      endTime: "02:00",
      daysOfWeek: [2],
      endDate: null,
      bufferAfter: 25,
      staysOvernight: true,
      departureTime: new Date("2026-07-08T09:00"),
    },
  ];

  const gaps = findGaps(
    blocks,
    new Date("2026-07-08T00:00"),
    new Date("2026-07-08T12:00"),
    { durationMinutes: 60 },
  );

  expect(gaps).toEqual([
    { start: new Date("2026-07-08T09:25"), end: new Date("2026-07-08T12:00") },
  ]);
});

it("zewnętrzny event (lekarz 10:00–11:00) wycina lukę tak samo jak własny blok", () => {
  const blocks = [
    { name: "Praca", startTime: "05:00", endTime: "06:00", daysOfWeek: [1], endDate: null },
  ];
  const externalBusy = [
    { start: new Date("2026-07-06T10:00"), end: new Date("2026-07-06T11:00") },
  ];

  const gaps = findGaps(
    blocks,
    new Date("2026-07-06T05:00"),
    new Date("2026-07-06T13:00"),
    { durationMinutes: 60 },
    externalBusy,
  );

  expect(gaps).toEqual([
    { start: new Date("2026-07-06T06:00"), end: new Date("2026-07-06T10:00") },
    { start: new Date("2026-07-06T11:00"), end: new Date("2026-07-06T13:00") },
  ]);
});

it("event nakładający się na blok nie dubluje zajętości — przedziały są scalane", () => {
  const blocks = [
    { name: "Praca", startTime: "08:00", endTime: "12:00", daysOfWeek: [1], endDate: null },
  ];
  // event zaczyna się w trakcie bloku i kończy po nim → zajętość 08:00–14:00
  const externalBusy = [
    { start: new Date("2026-07-06T10:00"), end: new Date("2026-07-06T14:00") },
  ];

  const gaps = findGaps(
    blocks,
    new Date("2026-07-06T06:00"),
    new Date("2026-07-06T18:00"),
    { durationMinutes: 60 },
    externalBusy,
  );

  expect(gaps).toEqual([
    { start: new Date("2026-07-06T06:00"), end: new Date("2026-07-06T08:00") },
    { start: new Date("2026-07-06T14:00"), end: new Date("2026-07-06T18:00") },
  ]);
});

it("findGapsWithBusySource: eventy z BusySource wycinają luki jak własne bloki", async () => {
  const blocks = [
    { name: "Praca", startTime: "05:00", endTime: "06:00", daysOfWeek: [1], endDate: null },
  ];
  const mockGcal: BusySource = async () => [
    { start: new Date("2026-07-06T10:00"), end: new Date("2026-07-06T11:00") },
  ];

  const gaps = await findGapsWithBusySource(
    blocks,
    new Date("2026-07-06T05:00"),
    new Date("2026-07-06T13:00"),
    { durationMinutes: 60 },
    mockGcal,
  );

  expect(gaps).toEqual([
    { start: new Date("2026-07-06T06:00"), end: new Date("2026-07-06T10:00") },
    { start: new Date("2026-07-06T11:00"), end: new Date("2026-07-06T13:00") },
  ]);
});

it("staysOvernight=false → bufor liczy się od końca zmiany jak w tickecie 04", () => {
  const blocks = [
    {
      name: "Nocka bez noclegu",
      startTime: "17:00",
      endTime: "02:00",
      daysOfWeek: [2],
      endDate: null,
      bufferAfter: 25,
      staysOvernight: false,
      departureTime: null,
    },
  ];

  const gaps = findGaps(
    blocks,
    new Date("2026-07-08T00:00"),
    new Date("2026-07-08T12:00"),
    { durationMinutes: 60 },
  );

  expect(gaps).toEqual([
    { start: new Date("2026-07-08T02:25"), end: new Date("2026-07-08T12:00") },
  ]);
});
