import { prisma } from "@/lib/prisma";

const PRIORITIES = ["low", "medium", "high"];

export async function POST(request: Request) {
  const data = await request.json();
  if (typeof data.durationMinutes !== "number" || data.durationMinutes <= 0) {
    return Response.json(
      { error: "durationMinutes musi być liczbą > 0" },
      { status: 400 },
    );
  }
  if (!PRIORITIES.includes(data.priority)) {
    return Response.json(
      { error: "priority musi być jednym z: low, medium, high" },
      { status: 400 },
    );
  }
  // ponytail: body idzie wprost do create; whitelist pól gdy API wyjdzie poza własny frontend
  const item = await prisma.backlogItem.create({ data });
  return Response.json(item, { status: 201 });
}

export async function GET(request: Request) {
  // Domyślnie lista "Do zaplanowania"; ?status=scheduled zwraca pozycje z terminem.
  const status = new URL(request.url).searchParams.get("status");
  const where =
    status === "scheduled"
      ? { scheduledStart: { not: null } }
      : { scheduledStart: null };
  return Response.json(await prisma.backlogItem.findMany({ where }));
}
