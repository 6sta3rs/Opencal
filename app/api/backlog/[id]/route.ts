import { prisma } from "@/lib/prisma";

const PRIORITIES = ["low", "medium", "high"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const data = await request.json();
  if (
    data.durationMinutes !== undefined &&
    (typeof data.durationMinutes !== "number" || data.durationMinutes <= 0)
  ) {
    return Response.json(
      { error: "durationMinutes musi być liczbą > 0" },
      { status: 400 },
    );
  }
  if (data.priority !== undefined && !PRIORITIES.includes(data.priority)) {
    return Response.json(
      { error: "priority musi być jednym z: low, medium, high" },
      { status: 400 },
    );
  }
  // ponytail: body idzie wprost do update; whitelist pól gdy API wyjdzie poza własny frontend
  const item = await prisma.backlogItem.update({ where: { id }, data });
  return Response.json(item);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const item = await prisma.backlogItem.delete({ where: { id } });
  return Response.json(item);
}
