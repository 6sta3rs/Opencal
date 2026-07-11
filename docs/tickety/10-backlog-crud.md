# 10 — Backlog CRUD

**Rozmiar:** S · **Typ:** AFK · **Blokowany przez:** brak

## Co zbudować

Model `BacklogItem` (nazwa, czas trwania, opcjonalny deadline, priorytet) + endpointy CRUD. Lista rzeczy bez przypisanego terminu.

## Kryteria akceptacji

- [x] Pozycja "kurs koparki, 3h, priorytet wysoki" da się dodać, wylistować, edytować, usunąć
- [x] Walidacja: czas trwania > 0, priorytet z zamkniętej listy

**Status: zrobione 2026-07-09.** Model `BacklogItem` w `prisma/schema.prisma` (name, durationMinutes, opcjonalny deadline, priority jako String walidowany na zamkniętą listę low/medium/high — bez enuma w bazie, sufit: enum Prisma gdy lista priorytetów urośnie lub trafi do UI). Endpointy: `app/api/backlog/route.ts` (POST z walidacją durationMinutes > 0 i priority, GET), `app/api/backlog/[id]/route.ts` (PATCH z tą samą walidacją dla pól obecnych w body, DELETE). Testy: `app/api/backlog/route.test.ts` (3), `app/api/backlog/[id]/route.test.ts` (3). Migracja `20260709205600_backlog_item`.
