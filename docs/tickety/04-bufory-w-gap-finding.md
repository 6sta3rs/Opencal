# 04 — Bufory w gap-finding

**Rozmiar:** S · **Typ:** AFK · **Blokowany przez:** 03

## Co zbudować

Bufor przed (dojazd) i po (powrót) jako część każdego bloku. Algorytm szuka `buffer_przed + duration + buffer_po`, respektując bufory bloków po obu stronach luki.

## Kryteria akceptacji

- [x] Praca 17:00–02:00 z buforem po 45 min → wolne zaczyna się 02:45
- [x] Zmiana poranna: bufor 25 min przed 5:00 i 25 min po końcu
- [x] Kurs 3h z buforami 15/15 wymaga łącznie 3h30min wolnego okna
- [x] Bufory per blok nadpisują domyślne

**Status: zrobione 2026-07-09.** `lib/gap-finding.ts` (bufory bloku rozszerzają zajętość, bufory żądania powiększają wymaganą długość luki), testy w `lib/gap-finding.test.ts` (4 dla tego ticketu). Schemat: `bufferBefore`/`bufferAfter Int @default(0)` na `RecurringBlock` (migracja `buffers`).
