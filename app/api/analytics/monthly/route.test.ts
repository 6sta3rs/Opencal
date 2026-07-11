import { beforeAll, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST as CREATE_ENTRY } from "../../entries/route";
import { GET } from "./route";

// ponytail: ten plik jest jedynym właścicielem wpisów w 2026-08/09 — czyścimy
// je na starcie, żeby powtórne uruchomienia (i inne pliki testowe dzielące
// tabelę TimeEntry) nie zafałszowały sum liczonych na całym miesiącu
beforeAll(async () => {
  await prisma.timeEntry.deleteMany({
    where: { start: { gte: new Date(2026, 7, 1), lt: new Date(2026, 9, 1) } },
  });
});

async function createEntry(body: Record<string, unknown>) {
  const res = await CREATE_ENTRY(
    new Request("http://localhost/api/entries", { method: "POST", body: JSON.stringify(body) }),
  );
  return res.json();
}

it("suma godzin i zarobków zgadza się z wpisami miesiąca (przerwy odjęte, klient rozbity, szkice pominięte)", async () => {
  await createEntry({
    start: "2026-08-03T06:00:00.000Z",
    end: "2026-08-03T16:00:00.000Z",
    breakDuration: 0,
    hourlyRate: 32,
    additionalPay: 0,
    client: "Acme",
  }); // 10h × 32 = 320
  await createEntry({
    start: "2026-08-10T08:00:00.000Z",
    end: "2026-08-10T12:00:00.000Z",
    breakDuration: 30,
    hourlyRate: 40,
    additionalPay: 0,
  }); // 3.5h × 40 = 140
  await createEntry({
    start: "2026-08-15T06:00:00.000Z",
    end: "2026-08-15T16:00:00.000Z",
    breakDuration: 0,
    hourlyRate: 32,
    additionalPay: 0,
    isDraft: true,
  }); // szkic — pominięty w sumach

  const res = await GET(new Request("http://localhost/api/analytics/monthly?month=2026-08"));
  expect(res.status).toBe(200);
  const summary = await res.json();
  expect(summary.totalHours).toBe(13.5);
  expect(summary.totalEarnings).toBe(460);
  expect(summary.byClient).toContainEqual(
    expect.objectContaining({ client: "Acme", hours: 10, earnings: 320 }),
  );
});

it("rozbicie wg dnia tygodnia wskazuje najbardziej dochodowy dzień", async () => {
  const topDay = new Date(2026, 7, 20); // 2026-08-20 lokalnie
  await createEntry({
    start: "2026-08-20T06:00:00.000Z",
    end: "2026-08-20T16:00:00.000Z",
    breakDuration: 0,
    hourlyRate: 100,
    additionalPay: 0,
  }); // 10h × 100 = 1000, wyraźnie najwyższy dzień

  const res = await GET(new Request("http://localhost/api/analytics/monthly?month=2026-08"));
  const summary = await res.json();
  const best = summary.byDayOfWeek.reduce((a: { earnings: number }, b: { earnings: number }) =>
    b.earnings > a.earnings ? b : a,
  );
  expect(best.day).toBe(topDay.getDay());
  expect(best.earnings).toBeGreaterThanOrEqual(1000);
});

it("miesiąc bez wpisów → same zera, nie błąd", async () => {
  const res = await GET(new Request("http://localhost/api/analytics/monthly?month=2026-09"));
  expect(res.status).toBe(200);
  const summary = await res.json();
  expect(summary.totalHours).toBe(0);
  expect(summary.totalEarnings).toBe(0);
  expect(summary.byClient).toEqual([]);
  expect(summary.byDayOfWeek.every((d: { hours: number; earnings: number }) => d.hours === 0 && d.earnings === 0)).toBe(true);
});

it("odrzuca month w złym formacie (400)", async () => {
  const res = await GET(new Request("http://localhost/api/analytics/monthly?month=lipiec"));
  expect(res.status).toBe(400);
});
