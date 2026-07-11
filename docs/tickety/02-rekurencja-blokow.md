# 02 — Rekurencja bloków

**Rozmiar:** S · **Typ:** AFK · **Blokowany przez:** 01

## Co zbudować

Blok przypisany do wielu dni tygodnia, powtarzany "do odwołania" lub do daty końcowej. Funkcja rozwijająca definicje bloków na konkretne instancje w zadanym zakresie dat.

## Kryteria akceptacji

- [x] Blok pon+śr "do odwołania" zwraca instancje w każdym tygodniu zakresu zapytania
- [x] Blok z datą końcową nie generuje instancji po tej dacie
- [x] Zmiana nocna 17:00–02:00 daje instancję przechodzącą przez północ (koniec następnego dnia)

**Status: zrobione 2026-07-09.** `lib/recurrence.ts` (`getInstances`), testy w `lib/recurrence.test.ts` (3). Schemat wyewoluowany: `dayOfWeek: Int` → `daysOfWeek: Int[]` + `endDate: DateTime?` (migracja `days_of_week_array`, ticket 1 zaktualizowany do nowego interfejsu).
