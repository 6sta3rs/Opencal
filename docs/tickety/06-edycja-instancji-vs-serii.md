# 06 — Edycja instancji vs serii + pauza

**Rozmiar:** M · **Typ:** AFK · **Blokowany przez:** 02

## Co zbudować

Jak w Google Calendar: edycja pojedynczej instancji (wyjątek) albo całej serii. Dodatkowo wstrzymanie bloku (pauza) — instancje znikają, definicja zostaje.

## Kryteria akceptacji

- [x] Zmiana godziny jednej instancji nie zmienia pozostałych tygodni
- [x] Edycja serii zmienia przyszłe instancje, wyjątki zostają
- [x] Usunięcie jednej instancji (np. wolne w to święto) nie usuwa serii
- [x] Blok wstrzymany nie generuje instancji; wznowienie przywraca

**Status: zrobione 2026-07-09.** Nowy model `BlockInstanceException` (`blockId`+`date` unikalne, `startTime`/`endTime` nadpisane albo `cancelled`; migracja `block_instance_exception`) oraz `isPaused Boolean @default(false)` na `RecurringBlock` (migracja `is_paused`). `lib/recurrence.ts`: `getInstances` przyjmuje opcjonalny 4. parametr `exceptions` (nadpisanie godzin / pominięcie dnia) i zwraca `[]` dla `isPaused` — `lib/gap-finding.ts` bez zmian. API: `PATCH /api/blocks/:id` (edycja serii + pauza, body wprost do update jak w POST), `POST /api/blocks/:id/exceptions` (upsert po dniu), `GET /api/blocks` zwraca bloki z `exceptions`. Testy: 3 w `lib/recurrence.test.ts`, 2 w `app/api/blocks/[id]/route.test.ts`, 2 w `app/api/blocks/[id]/exceptions/route.test.ts`. Dopasowanie wyjątku do dnia po dacie kalendarzowej (`toDateString`) — wystarcza przy jednej strefie czasowej.
