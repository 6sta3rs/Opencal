# 03 — Gap-finding: jeden dzień

**Rozmiar:** S · **Typ:** AFK · **Blokowany przez:** 02

## Co zbudować

Czysta, deterministyczna funkcja (bez AI, bez HTTP): dla danego dnia bierze instancje bloków, sortuje chronologicznie i zwraca luki `{start, end, dzień, zapas}` dłuższe niż żądane `duration_minutes`.

## Kryteria akceptacji

- [x] Dwa bloki w dniu → jedna luka między nimi
- [x] Luka krótsza niż `duration_minutes` jest odrzucana
- [x] Dzień bez bloków → cała doba (w granicach zakresu) jako jedno wolne okno
- [x] Opcjonalny `preferred_window` (np. "po 14:00") filtruje kandydatów

**Status: zrobione 2026-07-09.** `lib/gap-finding.ts` (`findGaps`), testy w `lib/gap-finding.test.ts` (4 dla tego ticketu). Reużywa `getInstances` z `lib/recurrence.ts` (wyeksportowano też `atTime`). `preferredWindow` na razie strukturalne `{ after: "HH:MM" }` — parsowanie języka naturalnego to rola agenta (ticket 12).
