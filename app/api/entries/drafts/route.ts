import { ensureDrafts } from "@/lib/drafts";

// Tworzy szkice wpisów dla instancji zmian, które już się zaczęły.
export async function POST(request: Request) {
  const { now } = await request.json().catch(() => ({ now: undefined }));
  const created = await ensureDrafts(now ? new Date(now) : new Date());
  return Response.json(created, { status: 201 });
}
