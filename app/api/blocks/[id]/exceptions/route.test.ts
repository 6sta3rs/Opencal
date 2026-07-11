import { afterEach, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "../../route";
import { POST as POST_EXCEPTION } from "./route";

// ponytail: patrz komentarz w ../../route.test.ts
afterEach(async () => {
  await prisma.recurringBlock.deleteMany({ where: { name: "Praca" } });
});

async function createBlock() {
  const res = await POST(
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
  return res.json();
}

it("użytkownik przesuwa jedną instancję — wyjątek zapisuje się i wraca przy odczycie bloków", async () => {
  const block = await createBlock();

  const res = await POST_EXCEPTION(
    new Request(`http://localhost/api/blocks/${block.id}/exceptions`, {
      method: "POST",
      body: JSON.stringify({ date: "2026-07-13", startTime: "08:00", endTime: "09:00" }),
    }),
    { params: Promise.resolve({ id: block.id }) },
  );
  expect(res.status).toBe(201);

  const blocks = await (await GET()).json();
  const saved = blocks.find((b: { id: string }) => b.id === block.id);
  expect(saved.exceptions).toContainEqual(
    expect.objectContaining({
      date: expect.stringContaining("2026-07-13"),
      startTime: "08:00",
      endTime: "09:00",
    }),
  );
});

it("odwołanie jednej instancji (wolne w święto) nie usuwa serii", async () => {
  const block = await createBlock();

  const res = await POST_EXCEPTION(
    new Request(`http://localhost/api/blocks/${block.id}/exceptions`, {
      method: "POST",
      body: JSON.stringify({ date: "2026-07-13", cancelled: true }),
    }),
    { params: Promise.resolve({ id: block.id }) },
  );
  expect(res.status).toBe(201);

  const blocks = await (await GET()).json();
  const saved = blocks.find((b: { id: string }) => b.id === block.id);
  expect(saved).toBeDefined();
  expect(saved.exceptions).toContainEqual(expect.objectContaining({ cancelled: true }));
});
