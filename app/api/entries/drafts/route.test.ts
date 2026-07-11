import { afterEach, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { PATCH } from "../[id]/route";
import { POST } from "./route";

// ponytail: testy dzielą bazę (fileParallelism: false) — czyścimy blok testowy
// po nazwie, żeby nie zostawał wśród realnych RecurringBlock. TimeEntry.blockId
// to zwykły String (bez FK/cascade), więc szkice też trzeba skasować jawnie.
afterEach(async () => {
  const blocks = await prisma.recurringBlock.findMany({ where: { name: "Zmiana poranna" } });
  await prisma.timeEntry.deleteMany({ where: { blockId: { in: blocks.map((b) => b.id) } } });
  await prisma.recurringBlock.deleteMany({ where: { name: "Zmiana poranna" } });
});

it("endpoint tworzy szkice i zwraca je odróżnialne (isDraft) od finalnych wpisów", async () => {
  const now = new Date(2026, 6, 27, 5, 30); // 2026-07-27 05:30 lokalnie
  const block = await prisma.recurringBlock.create({
    data: {
      name: "Zmiana poranna",
      type: "work",
      startTime: "05:00",
      endTime: "06:00",
      daysOfWeek: [now.getDay()],
    },
  });

  const res = await POST(
    new Request("http://localhost/api/entries/drafts", {
      method: "POST",
      body: JSON.stringify({ now: now.toISOString() }),
    }),
  );
  expect(res.status).toBe(201);
  const created = await res.json();
  const draft = created.find((e: { blockId: string }) => e.blockId === block.id);
  expect(draft.isDraft).toBe(true);

  const approved = await PATCH(
    new Request(`http://localhost/api/entries/${draft.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isDraft: false }),
    }),
    { params: Promise.resolve({ id: draft.id }) },
  );
  const approvedEntry = await approved.json();
  expect(approvedEntry.isDraft).toBe(false);
});
