import { prisma } from "@/lib/prisma";
import { DEFAULT_AVAILABILITY, sortMonFirst, validateAvailabilityPayload } from "@/lib/availability";

export async function GET() {
  const existing = await prisma.availability.findMany();
  if (existing.length === 0) {
    await prisma.availability.createMany({ data: DEFAULT_AVAILABILITY });
    return Response.json(DEFAULT_AVAILABILITY);
  }
  return Response.json(sortMonFirst(existing));
}

export async function PUT(request: Request) {
  const data = await request.json();
  const error = validateAvailabilityPayload(data);
  if (error) {
    return Response.json({ error }, { status: 400 });
  }
  await prisma.$transaction(
    data.map((day: { dayOfWeek: number; enabled: boolean; startTime: string; endTime: string }) =>
      prisma.availability.upsert({
        where: { dayOfWeek: day.dayOfWeek },
        create: day,
        update: day,
      }),
    ),
  );
  const saved = await prisma.availability.findMany();
  return Response.json(sortMonFirst(saved));
}
