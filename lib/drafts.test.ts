import { afterEach, expect, it } from "vitest";
import { prisma } from "./prisma";
import { ensureDrafts } from "./drafts";

// Testy dzielą prawdziwą bazę Postgres z dev serwerem (patrz vitest.config.ts)
// — bez tego sprzątania "Zmiana poranna" i jej szkice TimeEntry zostawałyby
// w bazie (i widoczne w UI) po każdym `pnpm vitest run`, tak jak w
// app/api/entries/drafts/route.test.ts. TimeEntry.blockId to zwykły String
// (bez FK/cascade w schema.prisma), więc kasujemy je jawnie przed blokiem.
afterEach(async () => {
  const blocks = await prisma.recurringBlock.findMany({ where: { name: "Zmiana poranna" } });
  await prisma.timeEntry.deleteMany({ where: { blockId: { in: blocks.map((b) => b.id) } } });
  await prisma.recurringBlock.deleteMany({ where: { name: "Zmiana poranna" } });
});

it("o godzinie startu instancji zmiany istnieje szkic wpisu z godzinami z grafiku", async () => {
  const now = new Date(2026, 6, 13, 5, 30); // 2026-07-13 05:30 lokalnie
  const block = await prisma.recurringBlock.create({
    data: {
      name: "Zmiana poranna",
      type: "work",
      startTime: "05:00",
      endTime: "06:00",
      daysOfWeek: [now.getDay()],
    },
  });

  await ensureDrafts(now);

  const drafts = await prisma.timeEntry.findMany({ where: { blockId: block.id } });
  expect(drafts).toHaveLength(1);
  expect(drafts[0]).toMatchObject({ isDraft: true, hourlyRate: 32 });
  expect(drafts[0].start.getHours()).toBe(5);
  expect(drafts[0].end.getHours()).toBe(6);
});

it("szkic nie dubluje się przy wielokrotnym wywołaniu dla tej samej instancji", async () => {
  const now = new Date(2026, 6, 20, 5, 30); // 2026-07-20 05:30 lokalnie
  const block = await prisma.recurringBlock.create({
    data: {
      name: "Zmiana poranna",
      type: "work",
      startTime: "05:00",
      endTime: "06:00",
      daysOfWeek: [now.getDay()],
    },
  });

  await ensureDrafts(now);
  await ensureDrafts(now);
  await ensureDrafts(new Date(now.getTime() + 60_000));

  const drafts = await prisma.timeEntry.findMany({ where: { blockId: block.id } });
  expect(drafts).toHaveLength(1);
});
