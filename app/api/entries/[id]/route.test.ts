import { expect, it } from "vitest";
import { POST } from "../route";
import { PATCH } from "./route";

async function createEntry() {
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
  return res.json();
}

it("PATCH stawki przelicza earnings", async () => {
  const entry = await createEntry();

  const res = await PATCH(
    new Request(`http://localhost/api/entries/${entry.id}`, {
      method: "PATCH",
      body: JSON.stringify({ hourlyRate: 40 }),
    }),
    { params: Promise.resolve({ id: entry.id }) },
  );
  expect(res.status).toBe(200);
  const updated = await res.json();
  expect(updated.earnings).toBe(520); // 10h × 40 + 120
});

it("PATCH odrzuca end <= start (400), wpis bez zmian", async () => {
  const entry = await createEntry();

  const res = await PATCH(
    new Request(`http://localhost/api/entries/${entry.id}`, {
      method: "PATCH",
      body: JSON.stringify({ end: "2026-07-09T01:00:00.000Z" }),
    }),
    { params: Promise.resolve({ id: entry.id }) },
  );
  expect(res.status).toBe(400);
});
