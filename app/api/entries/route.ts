import { prisma } from "@/lib/prisma";
import { withEarnings } from "@/lib/earnings";

export async function POST(request: Request) {
  const data = await request.json();
  const start = new Date(data.start);
  const end = new Date(data.end);
  const breakDuration = data.breakDuration ?? 0;
  if (end <= start) {
    return Response.json({ error: "end musi być po start" }, { status: 400 });
  }
  if (breakDuration < 0) {
    return Response.json({ error: "breakDuration musi być >= 0" }, { status: 400 });
  }
  // ponytail: body idzie wprost do create; whitelist pól gdy API wyjdzie poza własny frontend
  const entry = await prisma.timeEntry.create({
    data: { ...data, start, end, breakDuration },
    include: { lineItems: true },
  });
  return Response.json(withEarnings(entry), { status: 201 });
}
