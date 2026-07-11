import { prisma } from "@/lib/prisma";
import { PlannerPage } from "@/components/planner/PlannerPage";
import { DEFAULT_AVAILABILITY, sortMonFirst } from "@/lib/availability";

export default async function Home() {
  // Server Component: pobieramy bezpośrednio przez Prisma (ORM), zamiast
  // odpytywać własne /api/blocks przez fetch — prostsze, bez budowania
  // absolutnego URL-a do samego siebie.
  const [blocks, availabilityRows] = await Promise.all([
    prisma.recurringBlock.findMany({ include: { exceptions: true } }),
    prisma.availability.findMany(),
  ]);
  // Pusta tabela = użytkownik jeszcze nic nie zapisał na /dostepnosc —
  // te same domyślne Pn–Pt 9–17, którymi GET /api/availability seeduje bazę.
  const availability =
    availabilityRows.length === 7 ? sortMonFirst(availabilityRows) : DEFAULT_AVAILABILITY;

  return <PlannerPage blocks={blocks} availability={availability} />;
}
