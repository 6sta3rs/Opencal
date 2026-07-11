import { afterEach, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { DEFAULT_AVAILABILITY } from "@/lib/availability";
import { GET, PUT } from "./route";

afterEach(async () => {
  await prisma.availability.deleteMany();
});

it("GET na pustej tabeli zwraca i zapisuje 7 domyślnych dni, Pon-first", async () => {
  const res = await GET();
  expect(res.status).toBe(200);
  const days = await res.json();
  expect(days).toHaveLength(7);
  expect(days.map((d: { dayOfWeek: number }) => d.dayOfWeek)).toEqual([1, 2, 3, 4, 5, 6, 0]);
  expect(days).toEqual(expect.arrayContaining(DEFAULT_AVAILABILITY));

  const persisted = await prisma.availability.count();
  expect(persisted).toBe(7);
});

it("PUT zapisuje zmieniony harmonogram i GET go potem zwraca", async () => {
  await GET(); // seeduje domyślne 7 wierszy

  const updated = DEFAULT_AVAILABILITY.map((d) =>
    d.dayOfWeek === 6 ? { ...d, enabled: true, startTime: "10:00", endTime: "14:00" } : d,
  );
  const putRes = await PUT(
    new Request("http://localhost/api/availability", {
      method: "PUT",
      body: JSON.stringify(updated),
    }),
  );
  expect(putRes.status).toBe(200);
  const saved = await putRes.json();
  expect(saved.find((d: { dayOfWeek: number }) => d.dayOfWeek === 6)).toEqual({
    dayOfWeek: 6,
    enabled: true,
    startTime: "10:00",
    endTime: "14:00",
  });

  const res = await GET();
  const days = await res.json();
  expect(days.find((d: { dayOfWeek: number }) => d.dayOfWeek === 6).startTime).toBe("10:00");
});

it("PUT odrzuca zły format godziny (400) i nie zapisuje", async () => {
  await GET();
  const bad = DEFAULT_AVAILABILITY.map((d) => (d.dayOfWeek === 1 ? { ...d, startTime: "9:00" } : d));

  const res = await PUT(
    new Request("http://localhost/api/availability", { method: "PUT", body: JSON.stringify(bad) }),
  );
  expect(res.status).toBe(400);
  const body = await res.json();
  expect(body.error).toMatch(/HH:MM/);

  const persisted = await prisma.availability.findUnique({ where: { dayOfWeek: 1 } });
  expect(persisted?.startTime).toBe("09:00");
});

it("PUT odrzuca listę o złej długości (400) i nie zapisuje", async () => {
  await GET();
  const res = await PUT(
    new Request("http://localhost/api/availability", {
      method: "PUT",
      body: JSON.stringify(DEFAULT_AVAILABILITY.slice(0, 6)),
    }),
  );
  expect(res.status).toBe(400);
});
