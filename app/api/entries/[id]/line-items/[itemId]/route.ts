import { prisma } from "@/lib/prisma";
import { withEarnings } from "@/lib/earnings";

// Usuwa pozycję zarobku, zwraca wpis z przeliczonym earnings.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { id, itemId } = await params;
  await prisma.earningsLineItem.delete({ where: { id: itemId } });
  const entry = await prisma.timeEntry.findUniqueOrThrow({
    where: { id },
    include: { lineItems: true },
  });
  return Response.json(withEarnings(entry));
}
