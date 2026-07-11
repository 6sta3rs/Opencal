# 05 — Nocleg w pracy (staysOvernight)

**Rozmiar:** S · **Typ:** AFK · **Blokowany przez:** 04

## Co zbudować

Pola `staysOvernight: boolean` i `departureTime` na bloku pracy. Gdy nocleg: brak bufora powrotnego po zmianie, czas do `departureTime` zablokowany, bufor powrotny (~25 min) doliczany dopiero przy wyjeździe.

## Kryteria akceptacji

- [x] Zmiana z `staysOvernight=true` i wyjazdem w środę rano → zero wolnych okien między końcem zmiany a `departureTime`
- [x] Pierwsze wolne okno zaczyna się `departureTime + bufor powrotny`
- [x] `staysOvernight=false` → zachowanie standardowe (bufor po zmianie jak w tickecie 04)

**Status: zrobione 2026-07-09.** `lib/gap-finding.ts` (przy noclegu koniec zajętości przeciągnięty do `departureTime`, bufor powrotny liczony od wyjazdu), testy w `lib/gap-finding.test.ts` (3 dla tego ticketu). Schemat: `staysOvernight Boolean @default(false)` + `departureTime DateTime?` (migracja `stays_overnight`). Pojedyncze `departureTime` rozciąga każdą instancję kończącą się przed nim — przy cyklicznych noclegach do zamiany na regułę per instancja.
