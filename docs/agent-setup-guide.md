# Przewodnik startowy dla agenta — konfiguracja przed kodem

Ten plik opisuje **kolejność działań agenta** od zera do pierwszej linijki kodu produkcyjnego. Agent ma wykonać te kroki w podanej kolejności — żaden krok nie jest pomijany.

---

## Krok 0 — Wczytanie kontekstu projektu

Agent czyta w tej kolejności:
1. `kalendarz-app-specyfikacja.md` — pełna funkcjonalność, tech stack, workflow TDD
2. `harmonogram-i-zarobki.md` — rzeczywiste ograniczenia użytkownika (bufory, nocleg, model zarobków)
3. `design-system.md` — wygląd, layout, onboarding

Jeśli którykolwiek plik zawiera otwarte pytania (sekcja "Otwarte pytania") — agent pyta użytkownika o odpowiedź **przed** przejściem dalej, nie zgaduje.

---

## Krok 1 — Instalacja zależności środowiska

```bash
# Node.js (LTS) + package manager
node --version   # sprawdź czy jest zainstalowany, jeśli nie — zainstaluj LTS
npm install -g pnpm   # lub użyj npm/yarn zgodnie z preferencją

# Inicjalizacja projektu Next.js
npx create-next-app@latest kalendarz-app --typescript --tailwind --app

cd kalendarz-app

# Baza danych i ORM
pnpm add @prisma/client
pnpm add -D prisma
npx prisma init

# Testy
pnpm add -D vitest @vitejs/plugin-react
pnpm add -D @playwright/test
npx playwright install

# Claude API
pnpm add @anthropic-ai/sdk
```

PostgreSQL: lokalnie przez Docker (`docker run --name kalendarz-db -e POSTGRES_PASSWORD=... -p 5432:5432 -d postgres:16`) albo natywna instalacja — zgodnie z decyzją z sekcji architektonicznej w specyfikacji (lokalnie na start, bez pełnego docker-compose).

---

## Krok 2 — Instalacja skilli (PRZED pierwszą linijką kodu)

To krok krytyczny — bez tego agent pisze kod bez dyscypliny opisanej w specyfikacji.

**Skille wbudowane (już dostępne w repo skilli):**
- `tdd`
- `engineering:architecture`
- `engineering:testing-strategy`
- `engineering:code-review`
- `engineering:system-design`
- `engineering:documentation`
- `to-issues`
- `diagnose`
- `frontend-design`

**Skille zewnętrzne (do zainstalowania):**

```bash
# Ponytail — dyscyplina minimalnego kodu
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail

# Transitions.dev — biblioteka animacji UI
npx skills add https://github.com/Jakubantalik/transitions-dev --skill transitions-dev
```

Agent potwierdza instalację każdego skilla przed przejściem do Kroku 3 (np. uruchamiając `/ponytail-help` żeby sprawdzić że działa).

---

## Krok 3 — Architektura przed kodem

Uruchom `engineering:architecture`:
- Zapisz ADR: "Next.js API Routes vs osobny backend" → decyzja: **Next.js API Routes** (uzasadnienie: projekt solo, YAGNI, Ponytail-zgodne)
- Zapisz ADR: "Google Calendar sync: webhooks vs polling" → decyzja: **webhooks przez tunel Ngrok** (nie polling — patrz specyfikacja)
- Zapisz ADR: "Docker: teraz czy później" → decyzja: **bez Dockera w Fazie 1** (lokalny PostgreSQL wystarczy), Docker + Redis jako Faza 2 gdy pojawi się potrzeba cache'owania

ADR-y zapisz w `docs/adr/` jako osobne pliki markdown, ponumerowane (`001-nextjs-api-routes.md` itd.)

---

## Krok 4 — Rozbicie na tickety

Uruchom `to-issues`:
- Wejście: `kalendarz-app-specyfikacja.md` sekcja 4.3 (kolejność implementacji)
- Wyjście: lista ticketów w formacie tracer-bullet (pionowe wycinki, nie poziome warstwy)
- Każdy ticket ma: nazwę, opis zachowania do przetestowania, szacowany rozmiar

Przykładowy pierwszy ticket:
> **Ticket 1:** Model `RecurringBlock` — zapis i odczyt pojedynczego bloku z bazy (bez rekurencji jeszcze). Test: "użytkownik zapisuje blok 'Praca' 5:00-6:00 na poniedziałek, może go odczytać z powrotem."

---

## Krok 5 — TDD na każdym tickecie (dopiero teraz pisany jest kod)

Dla **każdego** ticketu z Kroku 4, agent stosuje cykl z `tdd` + `ponytail` jednocześnie:

```
RED:      napisz jeden test opisujący jedno zachowanie z ticketu → nie przechodzi
GREEN:    napisz NAJMNIEJSZY możliwy kod (zasada Ponytail: YAGNI → stdlib → własny kod) → test przechodzi
REFACTOR: uporządkuj, testy dalej przechodzą
```

Zasady obowiązujące przez cały Krok 5:
- Jeden test na raz — nigdy "napiszę wszystkie testy na start"
- Zero kodu "na zapas" — jeśli ticket tego nie wymaga, nie pisz tego
- Test opisuje zachowanie z zewnątrz (publiczne API), nie szczegóły implementacji
- Przy komponentach UI: użyj `transitions-dev` zamiast pisać animacje ręcznie
- Przy decyzjach stylistycznych: trzymaj się `design-system.md`

---

## Krok 6 — Code review po każdym większym etapie

Po zamknięciu grupy ticketów (np. cały "Etap 1: Model danych + gap-finding"):
- Uruchom `engineering:code-review`
- Sprawdź: walidację danych, obsługę błędów, przypadki brzegowe (np. blok przechodzący przez północ, strefy czasowe)

---

## Krok 7 — Dokumentacja

Po każdym kamieniu milowym: `engineering:documentation` aktualizuje `README.md` (jak uruchomić projekt lokalnie) i dokumentację API (endpointy z sekcji 2.5 specyfikacji zarobków + inne).

---

## Podsumowanie kolejności (skrót)

```
0. Wczytaj specyfikację + zadaj pytania jeśli coś niejasne
1. Zainstaluj zależności (Node, Next.js, Prisma, testy, Claude SDK)
2. Zainstaluj skille (wbudowane + Ponytail + Transitions.dev)
3. Architektura — zapisz ADR-y
4. Rozbij na tickety (to-issues)
5. TDD + Ponytail na każdym tickecie — DOPIERO TU POWSTAJE KOD
6. Code review po etapach
7. Dokumentacja po kamieniach milowych
```
