import { afterEach, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "./route";

// Testy współdzielą prawdziwą bazę Postgres z dev serwerem (patrz
// vitest.config.ts) — bez tego sprzątania "kurs koparki" zostawałby w bazie
// (i widoczny w UI) po każdym `pnpm vitest run`, tak jak w blocks/route.test.ts.
afterEach(async () => {
  await prisma.backlogItem.deleteMany({ where: { name: { in: ["kurs koparki", "kurs koparki + egzamin"] } } });
});

it("użytkownik dodaje 'kurs koparki' (180 min, priorytet wysoki) i widzi go na liście", async () => {
  const created = await POST(
    new Request("http://localhost/api/backlog", {
      method: "POST",
      body: JSON.stringify({
        name: "kurs koparki",
        durationMinutes: 180,
        priority: "high",
      }),
    }),
  );
  expect(created.status).toBe(201);

  const res = await GET(new Request("http://localhost/api/backlog"));
  expect(res.status).toBe(200);
  const items = await res.json();
  expect(items).toContainEqual(
    expect.objectContaining({
      name: "kurs koparki",
      durationMinutes: 180,
      priority: "high",
    }),
  );
});

it("odrzuca czas trwania <= 0 (400) i niczego nie zapisuje", async () => {
  const before = (await (await GET(new Request("http://localhost/api/backlog"))).json()).length;

  const res = await POST(
    new Request("http://localhost/api/backlog", {
      method: "POST",
      body: JSON.stringify({ name: "kurs koparki", durationMinutes: 0, priority: "high" }),
    }),
  );
  expect(res.status).toBe(400);

  const after = (await (await GET(new Request("http://localhost/api/backlog"))).json()).length;
  expect(after).toBe(before);
});

it("odrzuca priorytet spoza listy low/medium/high (400) i niczego nie zapisuje", async () => {
  const before = (await (await GET(new Request("http://localhost/api/backlog"))).json()).length;

  const res = await POST(
    new Request("http://localhost/api/backlog", {
      method: "POST",
      body: JSON.stringify({ name: "kurs koparki", durationMinutes: 180, priority: "urgent" }),
    }),
  );
  expect(res.status).toBe(400);

  const after = (await (await GET(new Request("http://localhost/api/backlog"))).json()).length;
  expect(after).toBe(before);
});
