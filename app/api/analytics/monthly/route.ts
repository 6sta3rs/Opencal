import { prisma } from "@/lib/prisma";
import { summarizeMonth } from "@/lib/analytics";

const YYYY_MM = /^\d{4}-(0[1-9]|1[0-2])$/;

// ?month=YYYY-MM → suma godzin/zarobków miesiąca, rozbicie wg dnia tygodnia i klienta.
export async function GET(request: Request) {
  const month = new URL(request.url).searchParams.get("month") ?? "";
  if (!YYYY_MM.test(month)) {
    return Response.json({ error: "month musi mieć format YYYY-MM" }, { status: 400 });
  }
  const [year, m] = month.split("-").map(Number);
  const rangeStart = new Date(year, m - 1, 1);
  const rangeEnd = new Date(year, m, 1);

  const entries = await prisma.timeEntry.findMany({
    where: { isDraft: false, start: { gte: rangeStart, lt: rangeEnd } },
    include: { lineItems: true },
  });

  return Response.json(summarizeMonth(entries));
}
