import { prisma } from "@/lib/prisma";

// Akcja "zaplanuj": przypisuje pozycję backlogu do okna czasowego.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { start, end } = await request.json();
  const item = await prisma.backlogItem.update({
    where: { id },
    data: { scheduledStart: start, scheduledEnd: end },
  });
  return Response.json(item);
}

// Odwołanie eventu: pozycja wraca do listy "Do zaplanowania".
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const item = await prisma.backlogItem.update({
    where: { id },
    data: { scheduledStart: null, scheduledEnd: null },
  });
  return Response.json(item);
}
