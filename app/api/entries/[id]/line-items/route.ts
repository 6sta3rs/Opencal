import { prisma } from "@/lib/prisma";
import { withEarnings } from "@/lib/earnings";

// Dodaje pozycję zarobku do wpisu, zwraca wpis z przeliczonym earnings.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { label, amount } = await request.json();
  await prisma.earningsLineItem.create({ data: { entryId: id, label, amount } });
  const entry = await prisma.timeEntry.findUniqueOrThrow({
    where: { id },
    include: { lineItems: true },
  });
  return Response.json(withEarnings(entry), { status: 201 });
}
