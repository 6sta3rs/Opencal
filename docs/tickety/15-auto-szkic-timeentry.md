# 15 — Auto-szkic TimeEntry ze zmiany

**Rozmiar:** M · **Typ:** AFK · **Blokowany przez:** 13, 02

## Co zbudować

Decyzja #1: start zaplanowanej zmiany tworzy szkic wpisu czasu (status draft) z godzinami z grafiku i domyślną stawką. Użytkownik poprawia faktyczny koniec, przerwy, dodatki i zatwierdza.

## Kryteria akceptacji

- [x] O godzinie startu instancji zmiany istnieje szkic wpisu z godzinami z grafiku
- [x] Szkic nie dubluje się przy wielokrotnym sprawdzeniu tej samej instancji
- [x] Zatwierdzenie szkicu zmienia status na finalny; szkice odróżnialne od finalnych w API

**Status: zrobione 2026-07-09.** Pole `isDraft Boolean @default(false)` na `TimeEntry` + `@@unique([blockId, start])` (dedup szkiców; blockId nullable więc ręczne wpisy bez bloku nie są tą unikalnością ograniczone). `lib/drafts.ts` (`ensureDrafts(now)`) bierze bloki `type: "work"`, `isPaused: false`, szuka instancji przez `getInstances` w oknie `[now-24h, now]` (ponytail: 24h wystarcza na najdłuższą zmianę nocną, wydłużyć gdyby powstały dłuższe bloki), tworzy szkic (stawka domyślna 32.00) gdy nie ma jeszcze wpisu dla danego blockId+start. Endpoint `app/api/entries/drafts/route.ts` (POST, opcjonalny `now` w body, domyślnie `new Date()`). Zatwierdzenie = istniejący `PATCH /api/entries/:id` z `{ isDraft: false }` (bez nowego endpointu — pole idzie przez to samo whitelisted-mniej body co reszta PATCH). Testy: `lib/drafts.test.ts` (2), `app/api/entries/drafts/route.test.ts` (1). Migracja `20260709235400_time_entry_draft` (utworzona ręcznie przez `prisma migrate diff` + `migrate deploy`, bo `migrate dev` odmawia działania nieinteraktywnie w tym środowisku).
