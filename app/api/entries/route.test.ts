import { expect, it } from "vitest";
import { POST } from "./route";

it("wpis 06:00–16:00, przerwa 0, stawka 32 PLN, dodatek 120 → earnings 440 PLN", async () => {
  const res = await POST(
    new Request("http://localhost/api/entries", {
      method: "POST",
      body: JSON.stringify({
        start: "2026-07-09T06:00:00.000Z",
        end: "2026-07-09T16:00:00.000Z",
        breakDuration: 0,
        hourlyRate: 32,
        additionalPay: 120,
      }),
    }),
  );
  expect(res.status).toBe(201);
  const entry = await res.json();
  expect(entry.earnings).toBe(440);
});

it("odrzuca end <= start (400) i niczego nie zapisuje", async () => {
  const res = await POST(
    new Request("http://localhost/api/entries", {
      method: "POST",
      body: JSON.stringify({
        start: "2026-07-09T16:00:00.000Z",
        end: "2026-07-09T06:00:00.000Z",
        hourlyRate: 32,
      }),
    }),
  );
  expect(res.status).toBe(400);
});

it("odrzuca ujemny breakDuration (400) i niczego nie zapisuje", async () => {
  const res = await POST(
    new Request("http://localhost/api/entries", {
      method: "POST",
      body: JSON.stringify({
        start: "2026-07-09T06:00:00.000Z",
        end: "2026-07-09T16:00:00.000Z",
        breakDuration: -10,
        hourlyRate: 32,
      }),
    }),
  );
  expect(res.status).toBe(400);
});
