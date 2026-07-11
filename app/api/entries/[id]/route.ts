import { prisma } from "@/lib/prisma";
import { withEarnings } from "@/lib/earnings";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const data = await request.json();
  if (data.start !== undefined) data.start = new Date(data.start);
  if (data.end !== undefined) data.end = new Date(data.end);

  if (data.start !== undefined || data.end !== undefined) {
    const current = await prisma.timeEntry.findUniqueOrThrow({ where: { id } });
    const start = data.start ?? current.start;
    const end = data.end ?? current.end;
    if (end <= start) {
      return Response.json({ error: "end musi być po start" }, { status: 400 });
    }
  }
  if (data.breakDuration !== undefined && data.breakDuration < 0) {
    return Response.json({ error: "breakDuration musi być >= 0" }, { status: 400 });
  }

  // ponytail: body idzie wprost do update; whitelist pól gdy API wyjdzie poza własny frontend
  const entry = await prisma.timeEntry.update({
    where: { id },
    data,
    include: { lineItems: true },
  });
  return Response.json(withEarnings(entry));
}
