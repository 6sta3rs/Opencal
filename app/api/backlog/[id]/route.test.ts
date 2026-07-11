import { afterEach, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "../route";
import { DELETE, PATCH } from "./route";

// Patrz komentarz w ../route.test.ts — testy piszą do prawdziwej bazy dev,
// więc sprzątamy po sobie (jeden test już usuwa swój wpis samodzielnie, ale
// zostaje po nim ewentualny "kurs koparki + egzamin" z PATCH-a w innym teście).
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

it("użytkownik edytuje pozycję backlogu — zmiana nazwy i czasu trwania jest widoczna na liście", async () => {
  const item = await createItem();

  const res = await PATCH(
    new Request(`http://localhost/api/backlog/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "kurs koparki + egzamin", durationMinutes: 240 }),
    }),
    { params: Promise.resolve({ id: item.id }) },
  );
  expect(res.status).toBe(200);

  const items = await (await GET(new Request("http://localhost/api/backlog"))).json();
  expect(items).toContainEqual(
    expect.objectContaining({
      id: item.id,
      name: "kurs koparki + egzamin",
      durationMinutes: 240,
    }),
  );
});

it("odrzuca edycję z czasem trwania <= 0 lub złym priorytetem (400), pozycja bez zmian", async () => {
  const item = await createItem();

  const badDuration = await PATCH(
    new Request(`http://localhost/api/backlog/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ durationMinutes: -5 }),
    }),
    { params: Promise.resolve({ id: item.id }) },
  );
  expect(badDuration.status).toBe(400);

  const badPriority = await PATCH(
    new Request(`http://localhost/api/backlog/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ priority: "urgent" }),
    }),
    { params: Promise.resolve({ id: item.id }) },
  );
  expect(badPriority.status).toBe(400);

  const items = await (await GET(new Request("http://localhost/api/backlog"))).json();
  expect(items).toContainEqual(
    expect.objectContaining({ id: item.id, durationMinutes: 180, priority: "high" }),
  );
});

it("użytkownik usuwa pozycję backlogu — znika z listy", async () => {
  const item = await createItem();

  const res = await DELETE(
    new Request(`http://localhost/api/backlog/${item.id}`, { method: "DELETE" }),
    { params: Promise.resolve({ id: item.id }) },
  );
  expect(res.status).toBe(200);

  const items = await (await GET(new Request("http://localhost/api/backlog"))).json();
  expect(items).not.toContainEqual(expect.objectContaining({ id: item.id }));
});
