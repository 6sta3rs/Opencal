type BlockDefinition = {
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  endDate: Date | null;
  // ponytail: opcjonalna dolna granica — potrzebna tylko dla jednorazowych
  // bloków (patrz lib/agent-panel.ts). Nieustawiona (undefined) = brak zmiany
  // zachowania dla istniejących wywołań (cykle "do odwołania"/z datą końca).
  startDate?: Date | null;
  isPaused?: boolean;
};

type InstanceException = {
  date: Date;
  startTime?: string | null;
  endTime?: string | null;
  cancelled?: boolean;
};

type BlockInstance = { start: Date; end: Date };

function sameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

export function atTime(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return d;
}

export function getInstances(
  block: BlockDefinition,
  rangeStart: Date,
  rangeEnd: Date,
  exceptions: InstanceException[] = [],
): BlockInstance[] {
  const instances: BlockInstance[] = [];
  if (block.isPaused) return instances;
  const day = new Date(rangeStart);

  while (day <= rangeEnd) {
    if (
      block.daysOfWeek.includes(day.getDay()) &&
      (!block.endDate || day <= block.endDate) &&
      (!block.startDate || day >= block.startDate)
    ) {
      const exception = exceptions.find((e) => sameDay(e.date, day));
      if (!exception?.cancelled) {
        const start = atTime(day, exception?.startTime ?? block.startTime);
        let end = atTime(day, exception?.endTime ?? block.endTime);
        if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
        instances.push({ start, end });
      }
    }
    day.setDate(day.getDate() + 1);
  }

  return instances;
}
