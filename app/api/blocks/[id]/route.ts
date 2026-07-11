import { prisma } from "@/lib/prisma";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const data = await request.json();
  if (
    (data.startTime !== undefined && !HHMM.test(data.startTime)) ||
    (data.endTime !== undefined && !HHMM.test(data.endTime))
  ) {
    return Response.json(
      { error: "startTime/endTime muszą mieć format HH:MM" },
      { status: 400 },
    );
  }
  // ponytail: body idzie wprost do update; whitelist pól gdy API wyjdzie poza własny frontend
  const block = await prisma.recurringBlock.update({ where: { id }, data });
  return Response.json(block);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // BlockInstanceException ma onDelete: Cascade w schema.prisma — wyjątki
  // instancji znikają razem z blokiem, bez osobnego czyszczenia tutaj.
  await prisma.recurringBlock.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
