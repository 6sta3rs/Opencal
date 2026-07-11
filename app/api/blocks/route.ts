import { prisma } from "@/lib/prisma";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function POST(request: Request) {
  const data = await request.json();
  if (typeof data.name !== "string" || data.name === "") {
    return Response.json({ error: "name jest wymagane" }, { status: 400 });
  }
  if (!HHMM.test(data.startTime) || !HHMM.test(data.endTime)) {
    return Response.json(
      { error: "startTime/endTime muszą mieć format HH:MM" },
      { status: 400 },
    );
  }
  // ponytail: body idzie wprost do create; whitelist pól gdy API wyjdzie poza własny frontend
  const block = await prisma.recurringBlock.create({ data });
  return Response.json(block, { status: 201 });
}

export async function GET() {
  return Response.json(await prisma.recurringBlock.findMany({ include: { exceptions: true } }));
}
