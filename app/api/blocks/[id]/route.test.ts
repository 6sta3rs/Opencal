import { afterEach, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "../route";
import { POST as POST_EXCEPTION } from "./exceptions/route";
import { DELETE, PATCH } from "./route";

// ponytail: patrz komentarz w ../route.test.ts
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

it("edycja serii zmienia definicję bloku, a wyjątek pojedynczej instancji zostaje", async () => {
  const block = await createBlock();
  await POST_EXCEPTION(
    new Request(`http://localhost/api/blocks/${block.id}/exceptions`, {
      method: "POST",
      body: JSON.stringify({ date: "2026-07-13", startTime: "08:00", endTime: "09:00" }),
    }),
    { params: Promise.resolve({ id: block.id }) },
  );

  const res = await PATCH(
    new Request(`http://localhost/api/blocks/${block.id}`, {
      method: "PATCH",
      body: JSON.stringify({ startTime: "06:00", endTime: "07:00" }),
    }),
    { params: Promise.resolve({ id: block.id }) },
  );
  expect(res.status).toBe(200);

  const blocks = await (await GET()).json();
  const saved = blocks.find((b: { id: string }) => b.id === block.id);
  expect(saved.startTime).toBe("06:00");
  expect(saved.endTime).toBe("07:00");
  expect(saved.exceptions).toContainEqual(
    expect.objectContaining({ startTime: "08:00", endTime: "09:00" }),
  );
});

it("usunięcie bloku znika z listy, a jego wyjątki instancji znikają razem z nim", async () => {
  const block = await createBlock();
  await POST_EXCEPTION(
    new Request(`http://localhost/api/blocks/${block.id}/exceptions`, {
      method: "POST",
      body: JSON.stringify({ date: "2026-07-13", startTime: "08:00", endTime: "09:00" }),
    }),
    { params: Promise.resolve({ id: block.id }) },
  );

  const res = await DELETE(
    new Request(`http://localhost/api/blocks/${block.id}`, { method: "DELETE" }),
    { params: Promise.resolve({ id: block.id }) },
  );
  expect(res.status).toBe(204);

  const blocks = await (await GET()).json();
  expect(blocks.find((b: { id: string }) => b.id === block.id)).toBeUndefined();
  const exceptions = await prisma.blockInstanceException.findMany({ where: { blockId: block.id } });
  expect(exceptions).toHaveLength(0);
});

it("użytkownik wstrzymuje blok, a potem go wznawia — flaga isPaused wraca przy odczycie", async () => {
  const block = await createBlock();

  const paused = await PATCH(
    new Request(`http://localhost/api/blocks/${block.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isPaused: true }),
    }),
    { params: Promise.resolve({ id: block.id }) },
  );
  expect(paused.status).toBe(200);
  expect((await paused.json()).isPaused).toBe(true);

  await PATCH(
    new Request(`http://localhost/api/blocks/${block.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isPaused: false }),
    }),
    { params: Promise.resolve({ id: block.id }) },
  );
  const blocks = await (await GET()).json();
  const saved = blocks.find((b: { id: string }) => b.id === block.id);
  expect(saved.isPaused).toBe(false);
});
