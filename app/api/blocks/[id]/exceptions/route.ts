import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const data = await request.json();
  const date = new Date(data.date);
  if (Number.isNaN(date.getTime())) {
    return Response.json({ error: "date jest wymagane (data instancji)" }, { status: 400 });
  }
  // ponytail: upsert po (blockId, date) — ponowna edycja tego samego dnia
  // nadpisuje wyjątek zamiast wybuchać na unikalnym indeksie
  const exception = await prisma.blockInstanceException.upsert({
    where: { blockId_date: { blockId: id, date } },
    create: {
      blockId: id,
      date,
      startTime: data.startTime ?? null,
      endTime: data.endTime ?? null,
      cancelled: data.cancelled ?? false,
    },
    update: {
      startTime: data.startTime ?? null,
      endTime: data.endTime ?? null,
      cancelled: data.cancelled ?? false,
    },
  });
  return Response.json(exception, { status: 201 });
}
