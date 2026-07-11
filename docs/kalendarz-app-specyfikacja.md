# Specyfikacja aplikacji — Inteligentny Kalendarz Zmianowy

Osobista aplikacja do zarządzania czasem dla nieregularnego grafiku pracy (zmiany, kursy, szkolenia) z wbudowanym agentem AI wyszukującym wolne okna.

---

## 1. Cel aplikacji

Użytkownik pracuje w nieregularnych zmianach (np. dziś 5:00-6:00 do 14:00, jutro 14:00-15:00 do 22:00). Aplikacja ma:

1. Pozwolić zdefiniować powtarzalne bloki czasowe (praca, kursy) trwające **do odwołania**
2. Automatycznie wyszukiwać wolne okna między tymi blokami
3. Udostępnić agenta AI, który analizuje wolne okna względem próśb użytkownika i **proponuje konkretne terminy** zamiast tylko listować dane

---

## 2. Funkcjonalności (szczegółowo)

### 2.1 Zarządzanie blokami czasowymi (Recurring Blocks)

- Tworzenie bloku: nazwa, typ (praca/kurs/inne), godzina startu, godzina końca, dni tygodnia
- Rekurencja: "do odwołania" (bez daty końcowej) lub z datą końcową
- Edycja pojedynczej instancji vs całej serii (jak w Google Calendar)
- Wstrzymanie bloku (pauza) bez usuwania definicji
- Wizualne oznaczenie koloru per typ bloku

### 2.2 Silnik wolnych okien (Gap-Finding Engine)

- Wejście: data/zakres dat, `duration_minutes` (ile czasu potrzeba), opcjonalnie `preferred_window` (np. "po 14:00")
- Logika: pobiera wszystkie bloki + eventy zsynchronizowane z Google Calendar/Cal.com dla danego zakresu, sortuje chronologicznie, liczy luki między nimi, odrzuca luki krótsze niż żądany czas
- Wyjście: lista kandydatów `{start, end, dzień, ile_zapasu}`
- To jest **czysty algorytm**, nie AI — szybki, deterministyczny, tani

### 2.3 Agent AI (warstwa decyzyjna)

- Odbiera pytanie użytkownika w naturalnym języku ("chcę wcisnąć 3h kursu w tym tygodniu, najlepiej rano")
- Wywołuje silnik wolnych okien jako **tool** (function calling przez Claude API)
- Analizuje kandydatów względem kontekstu (priorytety użytkownika, historia, unikanie okien tuż po nocnej zmianie itp.)
- Zwraca rekomendację z uzasadnieniem + opcję "Dodaj do kalendarza"
- Tryb proaktywny: cron (np. przez n8n) codziennie rano sprawdza backlog "do zaplanowania" i wysyła sugestie push/powiadomienie

### 2.4 Backlog ("Do zaplanowania")

- Lista rzeczy bez przypisanego terminu: nazwa, czas trwania, deadline (opcjonalnie), priorytet
- Agent AI regularnie próbuje dopasować pozycje z backlogu do wolnych okien

### 2.5 Integracje zewnętrzne

- **Google Calendar** — dwukierunkowy sync (odczyt zajętości + zapis nowych eventów)
- **Cal.com** — sync przez API/webhooki (booking.created, booking.cancelled) jako źródło zajętości
- **n8n** — silnik automatyzacji: cron triggery, webhooki, powiadomienia

### 2.6 Interfejs użytkownika

- **Planner** — widok dnia/tygodnia z osią godzinową
- **Sidebar** — zwijane sekcje: Bloki cykliczne, Backlog, Filtry widoczności; własny sticky scroll niezależny od main content
- **Panel agenta** — mini-czat do zadawania pytań + karta z proaktywnymi sugestiami

---

## 3. Tech stack

| Warstwa | Technologia | Uzasadnienie |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind CSS | Zgodne z Twoim obecnym stackiem, dobre SSR pod kalendarz |
| Stan/UI komponenty | React Server/Client Components, ewentualnie Zustand dla stanu klienta | Prostota, unikanie zbędnych zależności |
| Backend/API | Next.js API Routes lub osobny Node.js/Express serwis | Zależnie od skali — start z API Routes wystarczy |
| Baza danych | PostgreSQL | Relacyjna, dobrze radzi sobie z zapytaniami czasowymi (zakresy dat) |
| ORM | Prisma | Typowane zapytania, migracje, pasuje do TS |
| AI/Agent | Claude API (tool use / function calling) | Warstwa decyzyjna nad algorytmem gap-finding |
| Automatyzacja | n8n | Cron, webhooki, integracja z Google Calendar/Cal.com |
| Kalendarz zewnętrzny | Google Calendar API, Cal.com API | Źródła zajętości i zapis eventów |
| Testy | Vitest (unit) + Playwright (e2e) | Szybkie testy jednostkowe + realne testy przepływów użytkownika |
| Hosting | Vercel (frontend) + własny VPS lub Supabase (baza) | Zgodne z Twoim obecnym doświadczeniem |

---

## 4. Workflow pisania kodu — Test-Driven Development

### 4.1 Zasada nadrzędna

**Każdy fragment funkcjonalności powstaje w cyklu: test → implementacja → refaktor.** Nie piszemy najpierw całego kodu, a potem testów ("horizontal slicing") — to prowadzi do testów sprawdzających wyimaginowane zachowanie, a nie rzeczywiste.

### 4.2 Cykl Red-Green-Refactor (vertical slices)

```
RED:      Napisz JEDEN test opisujący JEDNO zachowanie → test nie przechodzi
GREEN:    Napisz minimalny kod, który sprawia że test przechodzi
REFACTOR: Uporządkuj kod (bez zmiany zachowania), testy muszą dalej przechodzić
→ powtórz dla następnego zachowania
```

**Zasady:**
- Jeden test na raz, nie cała paczka testów na start
- Kod ma być minimalny — tylko tyle, żeby przejść aktualny test
- Nie wyprzedzamy przyszłych testów (żadnych "na zapas" funkcji)
- Test ma opisywać **zachowanie widziane z zewnątrz** (publiczne API), nie szczegóły implementacji — dzięki temu przetrwa refaktor

**Dobry test** (przykład): "użytkownik może dodać blok cykliczny 'Praca' 5:00-6:00 do odwołania, i pojawia się on w każdym przyszłym tygodniu" — to specyfikacja zachowania.

**Zły test**: sprawdzanie czy wewnętrzna funkcja `calculateGapInternal()` zwróciła dokładnie taki obiekt — to test implementacji, złamie się przy każdym refaktorze mimo niezmienionego zachowania.

### 4.3 Kolejność implementacji (proponowana, każdy punkt = pełny cykl TDD)

1. Model danych `RecurringBlock` + zapis/odczyt z bazy (najprostszy przypadek: jeden blok, jeden dzień)
2. Rekurencja bloków (powtarzanie w wybrane dni tygodnia, bez daty końcowej)
3. Silnik gap-finding dla jednego dnia (dwa bloki → jedna luka)
4. Gap-finding z uwzględnieniem eventów z Google Calendar (mock API na start)
5. Backlog — dodanie pozycji, przypisanie do terminu
6. Endpoint agenta AI — pierwszy tool call (`find_free_slots`) i zwrócenie rekomendacji
7. Integracja Cal.com jako źródło zajętości
8. UI: Planner + Sidebar (testy e2e Playwright na kluczowych ścieżkach: dodaj blok → zobacz w kalendarzu)

### 4.4 Przed każdym etapem

- [ ] Potwierdź jakie zachowanie ma być przetestowane (priorytetyzacja — nie da się przetestować wszystkiego)
- [ ] Zaprojektuj interfejs pod testowalność (mały interfejs, ukryta złożoność wewnątrz)
- [ ] Dopiero potem pisz test i implementację

---

## 5. Zestaw skilli dla agenta piszącego kod

Żeby agent (Claude Code / Claude w tym projekcie) pisał kod jakościowo i konsekwentnie, potrzebuje odpowiednich skilli aktywnych w repo:

| Skill | Rola w projekcie |
|---|---|
| `tdd` | Wymusza cykl red-green-refactor opisany w sekcji 4, pilnuje vertical slices zamiast horizontal |
| `engineering:testing-strategy` | Pomaga zaprojektować całościową strategię testów (unit vs integration vs e2e) na starcie projektu |
| `engineering:architecture` | Do decyzji technicznych wymagających uzasadnienia (np. Next.js API Routes vs osobny serwis) — zapisuje ADR |
| `engineering:code-review` | Przegląd kodu pod kątem bezpieczeństwa, wydajności, poprawności przed mergem |
| `engineering:system-design` | Projektowanie granic serwisów (np. jak agent AI komunikuje się z gap-finding engine) |
| `improve-codebase-architecture` | Gdy projekt urośnie — znajdowanie okazji do refaktoru, konsolidacji modułów |
| `frontend-design` | Wytyczne stylistyczne dla UI (Planner, Sidebar) — spójność wizualna |
| `engineering:documentation` | Pisanie README, runbooków, dokumentacji API po zakończeniu etapów |
| `to-issues` | Rozbicie tej specyfikacji na konkretne, wykonalne zadania (tickets) |
| `diagnose` | Dyscyplinowany proces debugowania trudnych błędów (np. źle liczone luki czasowe na granicy stref czasowych) |
| `ponytail` ([DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail)) | Wymusza minimalizm kodu — agent przed napisaniem czegokolwiek sprawdza: czy to w ogóle potrzebne (YAGNI) → czy robi to standardowa biblioteka → dopiero potem pisze własny kod, zawsze najkrótsza bezpieczna wersja. Redukuje koszt tokenów (benchmarki: ~50-90% mniej kodu) bez ucinania walidacji/error handlingu. Uzupełnia `tdd` — TDD pilnuje minimalnego kodu na test, Ponytail pilnuje że ten kod jest też najprostszym rozwiązaniem |
| `transitions-dev` ([transitions.dev](https://transitions.dev/)) | Gotowa biblioteka przejść CSS/React (modale, dropdowny, panele, page-transitions, shake na błąd) z wbudowanym `prefers-reduced-motion`. Agent rozpoznaje kontekst UI (np. "to dropdown") i dobiera pasujące przejście zamiast pisać animacje od zera — przydatne pod sidebar accordion, modal dodawania eventu, pojawianie się sugestii agenta AI |

**Rekomendowana kolejność uruchamiania skilli w projekcie:**
1. `engineering:architecture` — ustalenie kluczowych decyzji technicznych (ADR) zanim padnie pierwsza linijka kodu
2. `to-issues` — rozbicie tej specyfikacji na tickety zgodnie z kolejnością z sekcji 4.3
3. `tdd` + `ponytail` — używane razem przy każdym pojedynczym tickecie: TDD dyktuje kolejność (test→kod), Ponytail dyktuje rozmiar (najprostszy możliwy kod)
4. `transitions-dev` — przy etapie UI (Planner, Sidebar, panel agenta) zamiast pisania animacji od zera
5. `engineering:code-review` — po każdym większym etapie
6. `engineering:documentation` — na koniec każdego kamienia milowego

**Instalacja skilli zewnętrznych (Claude Code):**
```bash
# Ponytail
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail

# Transitions.dev
npx skills add https://github.com/Jakubantalik/transitions-dev --skill transitions-dev
```

---

## 6. Otwarte pytania do doprecyzowania

- Czy backend ma być osobnym serwisem, czy Next.js API Routes wystarczą na start? (wpływa na decyzję z `engineering:architecture`)
- Jakie dokładnie sygnały ma brać pod uwagę agent przy rekomendacji (historia akceptacji/odrzuceń sugestii, pora dnia, długość przerwy po zmianie nocnej)?
- Czy Cal.com integracja jest priorytetem na start, czy można ją dodać w drugiej iteracji (po Google Calendar)?
