# 13 — TimeEntry + wyliczanie earnings

**Rozmiar:** S · **Typ:** AFK · **Blokowany przez:** 01

## Co zbudować

Model `TimeEntry` (start, end, breakDuration, hourlyRate, additionalPay, opcjonalne client/project/task/note, powiązanie z blokiem) + `POST /api/entries`, `PATCH /api/entries/:id`. Earnings wyliczane, nie wpisywane: `(minuty − przerwa)/60 × stawka + dodatek`.

## Kryteria akceptacji

- [x] Wpis 06:00–16:00, przerwa 0, stawka 32 PLN, dodatek 120 → earnings 440 PLN (przykład ze specyfikacji)
- [x] `PATCH` dowolnego pola (start/end/break/stawka/dodatek) przelicza earnings
- [x] Pole "Hole" nie istnieje w modelu (decyzja #3)

**Status: zrobione 2026-07-09.** Model `TimeEntry` w `prisma/schema.prisma` (blockId opcjonalne, start/end, breakDuration Int default 0, hourlyRate/additionalPay Float, client/project/task/note opcjonalne). Earnings NIE jest kolumną — liczy `lib/earnings.ts` (`calculateEarnings`, `withEarnings`): `(minuty(end-start) - breakDuration)/60 × hourlyRate + additionalPay`, wynik zaokrąglony do groszy (ponytail: float zamiast Decimal — sufit przy audycie kwot, patrz komentarz w pliku). Endpointy: `app/api/entries/route.ts` (POST, walidacja end>start i breakDuration>=0 → 400), `app/api/entries/[id]/route.ts` (PATCH z tą samą walidacją względem efektywnych start/end). Testy: `app/api/entries/route.test.ts` (3), `app/api/entries/[id]/route.test.ts` (3). Migracja `20260709214757_time_entry`.
