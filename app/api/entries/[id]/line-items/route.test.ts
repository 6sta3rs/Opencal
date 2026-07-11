import { expect, it } from "vitest";
import { POST as CREATE_ENTRY } from "../../route";
import { POST } from "./route";
import { DELETE } from "./[itemId]/route";

async function createEntry() {
  const res = await CREATE_ENTRY(
    new Request("http://localhost/api/entries", {
      method: "POST",
      body: JSON.stringify({
        start: "2026-07-09T06:00:00.000Z",
        end: "2026-07-09T16:00:00.000Z",
        breakDuration: 0,
        hourlyRate: 32,
        additionalPay: 0,
      }),
    }),
  );
  return res.json();
}

it("dodanie pozycji 'Nadgodziny' (80) i 'Dodatek nocny' (40) → earnings = baza + 120", async () => {
  const entry = await createEntry();
  expect(entry.earnings).toBe(320); // 10h × 32

  await POST(
    new Request(`http://localhost/api/entries/${entry.id}/line-items`, {
      method: "POST",
      body: JSON.stringify({ label: "Nadgodziny", amount: 80 }),
    }),
    { params: Promise.resolve({ id: entry.id }) },
  );
  const res = await POST(
    new Request(`http://localhost/api/entries/${entry.id}/line-items`, {
      method: "POST",
      body: JSON.stringify({ label: "Dodatek nocny", amount: 40 }),
    }),
    { params: Promise.resolve({ id: entry.id }) },
  );
  expect(res.status).toBe(201);
  const updated = await res.json();
  expect(updated.earnings).toBe(440); // 320 + 120
});

it("usunięcie pozycji koryguje sumę earnings", async () => {
  const entry = await createEntry();
  const overtime = await (
    await POST(
      new Request(`http://localhost/api/entries/${entry.id}/line-items`, {
        method: "POST",
        body: JSON.stringify({ label: "Nadgodziny", amount: 80 }),
      }),
      { params: Promise.resolve({ id: entry.id }) },
    )
  ).json();
  const itemId = overtime.lineItems.find((i: { label: string }) => i.label === "Nadgodziny").id;

  const res = await DELETE(
    new Request(`http://localhost/api/entries/${entry.id}/line-items/${itemId}`, {
      method: "DELETE",
    }),
    { params: Promise.resolve({ id: entry.id, itemId }) },
  );
  expect(res.status).toBe(200);
  const updated = await res.json();
  expect(updated.earnings).toBe(320); // z powrotem baza bez pozycji
});
