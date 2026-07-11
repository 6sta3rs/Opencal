import { afterEach, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "../../route";
import { DELETE as UNSCHEDULE, POST as SCHEDULE } from "./route";

// Patrz komentarz w ../../route.test.ts — testy piszą do prawdziwej bazy dev.
afterEach(async () => {
  await prisma.backlogItem.deleteMany({ where: { name: { in: ["kurs koparki", "kurs koparki + egzamin"] } } });
});

async function createItem() {
  const res = await POST(
    new Request("http://localhost/api/backlog", {
      method: "POST",
      body: JSON.stringify({ name: "kurs koparki", durationMinutes: 180, priority: "high" }),
    }),
  );
  return res.json();
}

it("zaplanowana pozycja pojawia się w kalendarzu w wybranym terminie", async () => {
  const item = await createItem();

  const res = await SCHEDULE(
    new Request(`http://localhost/api/backlog/${item.id}/schedule`, {
      method: "POST",
      body: JSON.stringify({
        start: "2026-07-13T09:00:00.000Z",
        end: "2026-07-13T12:00:00.000Z",
      }),
    }),
    { params: Promise.resolve({ id: item.id }) },
  );
  expect(res.status).toBe(200);

  const scheduled = await (
    await GET(new Request("http://localhost/api/backlog?status=scheduled"))
  ).json();
  expect(scheduled).toContainEqual(
    expect.objectContaining({
      id: item.id,
      name: "kurs koparki",
      scheduledStart: "2026-07-13T09:00:00.000Z",
      scheduledEnd: "2026-07-13T12:00:00.000Z",
    }),
  );
});

it("zaplanowana pozycja znika z domyślnej listy 'Do zaplanowania'", async () => {
  const item = await createItem();
  await SCHEDULE(
    new Request(`http://localhost/api/backlog/${item.id}/schedule`, {
      method: "POST",
      body: JSON.stringify({
        start: "2026-07-14T10:00:00.000Z",
        end: "2026-07-14T13:00:00.000Z",
      }),
    }),
    { params: Promise.resolve({ id: item.id }) },
  );

  const todo = await (await GET(new Request("http://localhost/api/backlog"))).json();
  expect(todo).not.toContainEqual(expect.objectContaining({ id: item.id }));
});

it("odwołanie eventu przywraca pozycję do listy 'Do zaplanowania' i usuwa ją z kalendarza", async () => {
  const item = await createItem();
  await SCHEDULE(
    new Request(`http://localhost/api/backlog/${item.id}/schedule`, {
      method: "POST",
      body: JSON.stringify({
        start: "2026-07-15T08:00:00.000Z",
        end: "2026-07-15T11:00:00.000Z",
      }),
    }),
    { params: Promise.resolve({ id: item.id }) },
  );

  const res = await UNSCHEDULE(
    new Request(`http://localhost/api/backlog/${item.id}/schedule`, { method: "DELETE" }),
    { params: Promise.resolve({ id: item.id }) },
  );
  expect(res.status).toBe(200);

  const todo = await (await GET(new Request("http://localhost/api/backlog"))).json();
  expect(todo).toContainEqual(
    expect.objectContaining({ id: item.id, scheduledStart: null, scheduledEnd: null }),
  );

  const scheduled = await (
    await GET(new Request("http://localhost/api/backlog?status=scheduled"))
  ).json();
  expect(scheduled).not.toContainEqual(expect.objectContaining({ id: item.id }));
});
