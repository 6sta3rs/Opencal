import { prisma } from "./prisma";
import { getInstances } from "./recurrence";

const DEFAULT_HOURLY_RATE = 32.0;
const LOOKBACK_MS = 24 * 60 * 60 * 1000;

// Dla każdej instancji bloku typu "praca" rozpoczętej przed `now` (patrzymy
// 24h wstecz — wystarcza na najdłuższą zmianę nocną) tworzy szkic wpisu
// czasu z godzinami z grafiku, jeśli szkic dla tej instancji (blockId+start)
// jeszcze nie istnieje.
export async function ensureDrafts(now: Date) {
  const blocks = await prisma.recurringBlock.findMany({
    where: { type: "work", isPaused: false },
    include: { exceptions: true },
  });
  const rangeStart = new Date(now.getTime() - LOOKBACK_MS);
  const created = [];

  for (const block of blocks) {
    const instances = getInstances(block, rangeStart, now, block.exceptions);
    for (const instance of instances) {
      if (instance.start > now) continue;
      const exists = await prisma.timeEntry.findUnique({
        where: { blockId_start: { blockId: block.id, start: instance.start } },
      });
      if (exists) continue;
      created.push(
        await prisma.timeEntry.create({
          data: {
            blockId: block.id,
            start: instance.start,
            end: instance.end,
            hourlyRate: DEFAULT_HOURLY_RATE,
            isDraft: true,
          },
        }),
      );
    }
  }

  return created;
}
