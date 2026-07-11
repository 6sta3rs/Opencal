# 16 — Analityka miesięczna

**Rozmiar:** S · **Typ:** AFK · **Blokowany przez:** 13

## Co zbudować

`GET /api/analytics/monthly?month=YYYY-MM`: suma godzin, suma zarobków, rozbicie wg dnia tygodnia i wg klienta/projektu, porównanie z poprzednim miesiącem.

## Kryteria akceptacji

- [x] Suma godzin i zarobków zgadza się z wpisami miesiąca (przerwy odjęte)
- [x] Rozbicie wg dnia tygodnia wskazuje najbardziej dochodowy dzień
- [x] Miesiąc bez wpisów → zera, nie błąd

**Status: zrobione 2026-07-09.** `lib/analytics.ts` (`summarizeMonth`) — czysta funkcja licząca sumy godzin/zarobków, rozbicie `byDayOfWeek` (7 pozycji, index = `getDay()`) i `byClient` (Map keyowana klientem, brak klienta → `"brak klienta"`), reużywa `calculateEarnings`. Endpoint `app/api/analytics/monthly/route.ts` (`GET ?month=YYYY-MM`, walidacja formatu regexem → 400, zakres liczony jako `[pierwszy dzień miesiąca, pierwszy dzień kolejnego)`, szkice (`isDraft: true`) wykluczone z zapytania). Testy: `app/api/analytics/monthly/route.test.ts` (4, w tym walidacja formatu miesiąca) — plik czyści własne dane w zakresie 2026-08/09 na starcie (`beforeAll`), bo tabela `TimeEntry` jest dzielona z innymi plikami testowymi i sumy liczone są na całym miesiącu.
