# 07 — Google Calendar jako źródło zajętości (mock)

**Rozmiar:** S · **Typ:** AFK · **Blokowany przez:** 04

## Co zbudować

Interfejs `BusySource` (lista zajętości dla zakresu dat) + implementacja mock. Gap-finding scala bloki własne i eventy zewnętrzne.

## Kryteria akceptacji

- [x] Event z mocka (np. "lekarz 10:00–11:00") wycina lukę tak samo jak własny blok
- [x] Eventy nakładające się na bloki nie dublują zajętości (merge przedziałów)

**Status: zrobione 2026-07-09.** `lib/gap-finding.ts` (typ `BusySource = (rangeStart, rangeEnd) => Promise<{start,end}[]>` — kontrakt async pod realny odczyt GCal w tickecie 08; `findGaps` przyjmuje opcjonalny parametr `externalBusy`, wrapper `findGapsWithBusySource` pobiera zajętość ze źródła i deleguje do `findGaps`; merge nachodzących przedziałów realizuje istniejący sweep kursorem po posortowanej zajętości). Testy w `lib/gap-finding.test.ts` (3 dla tego ticketu, mock BusySource wprost w teście). Bez zmian w Prisma.
