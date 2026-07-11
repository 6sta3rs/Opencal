# Tickety — kolejność implementacji

Zatwierdzone 2026-07-09. Każdy ticket = pionowy wycinek (tracer bullet), realizowany pełnym cyklem TDD (red-green-refactor) + Ponytail. Status aktualizowany w tym pliku.

| # | Ticket | Etap | Rozmiar | Blokowany przez | Status |
|---|---|---|---|---|---|
| 01 | RecurringBlock: zapis i odczyt | 1 | S | — | ✅ 2026-07-09 |
| 02 | Rekurencja bloków | 1 | S | 01 | ✅ 2026-07-09 |
| 03 | Gap-finding: jeden dzień | 1 | S | 02 | ✅ zrobione 2026-07-09 |
| 04 | Bufory w gap-finding | 1 | S | 03 | ✅ zrobione 2026-07-09 |
| 05 | Nocleg w pracy (staysOvernight) | 1 | S | 04 | ✅ zrobione 2026-07-09 |
| 06 | Edycja instancji vs serii + pauza | 1 | M | 02 | ✅ zrobione 2026-07-09 |
| 07 | GCal jako źródło zajętości (mock) | 2 | S | 04 | ✅ zrobione 2026-07-09 |
| 08 | GCal na żywo: OAuth + odczyt | 2 | M | 07 | 🔒 zablokowane — brak GOOGLE_CLIENT_ID/SECRET |
| 09 | GCal webhooks (Ngrok) | 2 | M | 08 | 🔒 zablokowane — zależy od 08 + token Ngrok |
| 10 | Backlog CRUD | 3 | S | — | ✅ zrobione 2026-07-09 |
| 11 | Przypisanie pozycji do terminu | 3 | S | 10, 02 | ✅ zrobione 2026-07-09 |
| 12 | Endpoint agenta (tool call) | 3 | M | 05, 10 | ✅ zrobione 2026-07-09 (testy jednostkowe z zamockowanym klientem Anthropic; weryfikacja live wymaga `ANTHROPIC_API_KEY`) |
| 13 | TimeEntry + wyliczanie earnings | 4 | S | 01 | ✅ zrobione 2026-07-09 |
| 14 | EarningsLineItem | 4 | S | 13 | ✅ zrobione 2026-07-09 |
| 15 | Auto-szkic TimeEntry ze zmiany | 4 | M | 13, 02 | ✅ zrobione 2026-07-09 |
| 16 | Analityka miesięczna | 4 | S | 13 | ✅ zrobione 2026-07-09 |
| 17 | Planner: siatka godzinowa | 5 | L | 02 | ✅ zrobione 2026-07-10 (+ interaktywność: drag-to-create, klik = edycja, przeciąganie między dniami) |
| 18 | Sidebar | 5 | M | 10, 17 | ✅ zrobione 2026-07-10 |
| 19 | Modal dodawania bloku + e2e | 5 | M | 17 | ✅ zrobione 2026-07-10 (pierwszy test e2e Playwright) |
| 20 | Panel agenta | 5 | M | 12, 17 | ✅ zrobione 2026-07-10 (jako pływający czat, nie sekcja sidebara; multi-provider Claude/Gemini; weryfikacja live wymaga kluczy API) |
| 21 | Panel zarobków | 5 | M | 14, 17 | ✅ zrobione 2026-07-10 |

Po każdym etapie: code review (`engineering:code-review`), aktualizacja dokumentacji.

Poza ticketami (2026-07-10, decyzje użytkownika): przebudowa UI na ciemny motyw à la Cal.com + shadcn/ui (struktura `components/{layout,planner,sidebar,blocks,chat,earnings}/`), czat AI jako pływający dymek z historią w localStorage i wyborem modelu (Claude/Gemini — aktywne wg kluczy w .env), migracja `startDate` na RecurringBlock (bloki jednorazowe z siatki).

## Faza 2 (świadomie odłożone — nie zaczynać bez decyzji użytkownika)

- Cal.com webhooks jako źródło zajętości (booking.created/cancelled)
- Onboarding wizard (6 kroków wg docs/design-system.md sekcja 6)
- Tryb proaktywny agenta (n8n cron, codzienne sugestie push)
- Historia akceptacji/odrzuceń sugestii jako sygnał agenta
- Docker Compose + Redis (wyzwalacz: ADR-003)
