# 12 — Endpoint agenta AI (tool call)

**Rozmiar:** M · **Typ:** AFK · **Blokowany przez:** 05, 10

## Co zbudować

`POST /api/agent`: pytanie w naturalnym języku → Claude API z toolem `find_free_slots` (silnik gap-finding) → rekomendacja z uzasadnieniem + dane do akcji "Dodaj do kalendarza". Sygnały (decyzja #5): pora dnia z prośby + unikanie okien tuż po zmianie nocnej.

## Kryteria akceptacji

- [x] "Chcę wcisnąć 3h kursu w tym tygodniu, najlepiej rano" → konkretny termin z uzasadnieniem
- [x] Agent wywołuje `find_free_slots` jako tool (nie liczy luk sam)
- [x] Rekomendacja unika okna bezpośrednio po zmianie nocnej, jeśli są alternatywy
- [x] Brak pasujących okien → uczciwa odpowiedź z najbliższą alternatywą

**Status: zrobione 2026-07-09.**

Pliki:

- `lib/agent.ts` — `runAgent(userMessage, deps)` z wstrzykiwanym klientem Anthropic (DI), stała `SYSTEM_PROMPT` (rola agenta, unikanie okien po zmianie nocnej gdy są alternatywy, nakaz używania toola `find_free_slots`), pętla tool_use → `tool_result` → finalna odpowiedź; handler toola deleguje wprost do `findGaps`
- `lib/agent.test.ts` — 4 testy z zamockowanym klientem Anthropic (odpowiedzi `stop_reason: "tool_use"` + finalny tekst); spy na `findGaps` weryfikuje delegację; wszystkie kandydackie luki idą do modelu bez ucinania; pusta lista luk → sensowna struktura `{answer, slots: []}`
- `app/api/agent/route.ts` — `POST /api/agent`: walidacja `message` (400), potem `runAgent` z prawdziwym `new Anthropic()` i blokami z Prismy; zwraca `{answer, slots}` (sloty = dane do akcji "Dodaj do kalendarza")
- `app/api/agent/route.test.ts` — kontrakt walidacji (400 bez `message`)
- `vitest.config.ts` — `fileParallelism: false`: testy route'ów współdzielą jedną bazę Postgres, równoległe pliki ścigały się na licznikach wierszy

Uwaga: **manualna weryfikacja z prawdziwym Claude API wymaga ustawienia `ANTHROPIC_API_KEY` w `.env` (klucza obecnie nie ma)** — testy jednostkowe tej ścieżki nie dotykają dzięki wstrzykniętemu mockowi. Kryterium unikania okien po zmianie nocnej realizuje prompt systemowy (sygnał dla modelu); endpoint przekazuje modelowi wszystkich kandydatów do wyboru.
