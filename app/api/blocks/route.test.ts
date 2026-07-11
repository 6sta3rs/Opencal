import { afterEach, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "./route";

// ponytail: testy dzielą bazę (fileParallelism: false) i nie mają własnych ID
// bloków w zasięgu — czyścimy po nazwie testowej, żeby GET nie rósł w nieskończoność
afterEach(async () => {
  await prisma.recurringBlock.deleteMany({ where: { name: "Praca" } });
});

it("użytkownik zapisuje blok 'Praca' 5:00–6:00 na poniedziałek i odczytuje go z powrotem", async () => {
  const created = await POST(
    new Request("http://localhost/api/blocks", {
      method: "POST",
      body: JSON.stringify({
        name: "Praca",
        type: "work",
        startTime: "05:00",
        endTime: "06:00",
        daysOfWeek: [1],
      }),
    }),
  );
  expect(created.status).toBe(201);

  const res = await GET();
  expect(res.status).toBe(200);
  const blocks = await res.json();
  expect(blocks).toContainEqual(
    expect.objectContaining({
      name: "Praca",
      type: "work",
      startTime: "05:00",
      endTime: "06:00",
      daysOfWeek: [1],
    }),
  );
});

it("odrzuca blok bez nazwy (400) i niczego nie zapisuje", async () => {
  const before = (await (await GET()).json()).length;

  const res = await POST(
    new Request("http://localhost/api/blocks", {
      method: "POST",
      body: JSON.stringify({
        type: "work",
        startTime: "05:00",
        endTime: "06:00",
        daysOfWeek: [1],
      }),
    }),
  );
  expect(res.status).toBe(400);

  const after = (await (await GET()).json()).length;
  expect(after).toBe(before);
});

it("odrzuca zły format godziny (400) i niczego nie zapisuje", async () => {
  const before = (await (await GET()).json()).length;

  const res = await POST(
    new Request("http://localhost/api/blocks", {
      method: "POST",
      body: JSON.stringify({
        name: "Praca",
        type: "work",
        startTime: "25:99",
        endTime: "06:00",
        daysOfWeek: [1],
      }),
    }),
  );
  expect(res.status).toBe(400);

  const after = (await (await GET()).json()).length;
  expect(after).toBe(before);
});
