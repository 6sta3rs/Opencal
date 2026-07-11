<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Kalendarz — inteligentny kalendarz zmianowy

Aplikacja do zarządzania nieregularnym grafikiem pracy (zmiany, kursy) z agentem AI szukającym wolnych okien oraz modułem time tracking + earnings.

## Baza wiedzy (czytaj przed pracą)

- [docs/kalendarz-app-specyfikacja.md](docs/kalendarz-app-specyfikacja.md) — pełna funkcjonalność, tech stack, workflow TDD
- [docs/harmonogram-i-zarobki.md](docs/harmonogram-i-zarobki.md) — ograniczenia użytkownika: bufory dojazdu, nocleg w pracy (`staysOvernight`), model zarobków
- [docs/design-system.md](docs/design-system.md) — paleta, typografia, layout, onboarding (referencja: Cal.com)
- [docs/decyzje-otwarte-pytania.md](docs/decyzje-otwarte-pytania.md) — wiążące odpowiedzi na otwarte pytania
- [docs/adr/](docs/adr/) — decyzje architektoniczne (API Routes, webhooks GCal, Docker minimalnie)
- [docs/agent-setup-guide.md](docs/agent-setup-guide.md) — kolejność kroków projektu
- [docs/reclaim-funkcje.md](docs/reclaim-funkcje.md) — wzorce UX z Reclaim.ai

## Zasady pracy (obowiązkowe)

1. **TDD zawsze** — cykl red-green-refactor, jeden test na raz, nigdy paczka testów na start. Test opisuje zachowanie z zewnątrz (publiczne API), nie implementację. Skill: `tdd`.
2. **Ponytail zawsze** — najprostsze działające rozwiązanie: YAGNI → kod już w repo → stdlib → natywna platforma → zainstalowana zależność → dopiero własny kod. Zero kodu "na zapas". Skill: `ponytail`.
3. **Animacje UI** — tylko przez skill `transitions-dev`, nie pisz animacji ręcznie. Respektuj `prefers-reduced-motion`.
4. **Style** — źródłem prawdy tokenów jest [DESIGN.md](DESIGN.md) (format google-labs-code/design.md; linter: `npx -p @google/design.md designmd lint DESIGN.md`). Uzasadnienia i kontekst: `docs/design-system.md`. Eksport do Tailwind 4 na etapie UI: `designmd export --format css-tailwind DESIGN.md`. Nie dodawaj kolorów poza paletą — najpierw aktualizuj DESIGN.md.
5. **Po każdym większym etapie** — code review (`engineering:code-review` lub `ponytail-review`), potem aktualizacja README/dokumentacji.
6. **Decyzje architektoniczne** — nowe zapisuj jako ADR w `docs/adr/` (kolejny numer).

## Stack i komendy

- Next.js 16 (App Router) + TypeScript + Tailwind 4, pnpm
- Prisma 7 + PostgreSQL 16 w kontenerze: `docker start kalendarz-db` (port 5432, baza `kalendarz`, connection string w `.env`)
- Testy: `pnpm vitest` (unit), `pnpm exec playwright test` (e2e)
- Dev: `pnpm dev`
- Migracje: `npx prisma migrate dev`

## Domena — kluczowe pojęcia

- **RecurringBlock** — cykliczny blok (praca/kurs/prywatne), dni tygodnia, "do odwołania" lub z datą końca; ma bufor przed (dojazd) i po (powrót); pole `staysOvernight` + `departureTime` (nocleg w pracy = brak wolnych okien do wyjazdu).
- **Gap-finding** — czysty, deterministyczny algorytm (nie AI): szuka `buffer_przed + duration + buffer_po` między blokami i eventami z Google Calendar.
- **Agent AI** — Claude API z tool `find_free_slots`; sygnały na start: pora dnia z prośby + unikanie okien tuż po nocnej zmianie.
- **TimeEntry** — wpis czasu pracy, auto-szkic tworzony ze startu zmiany; `earnings = (godziny − przerwa) × stawka + suma EarningsLineItem`. Stawka testowa: 32,00 PLN.
- **Backlog** — pozycje bez terminu (nazwa, czas trwania, priorytet), które agent dopasowuje do wolnych okien.

## Czego NIE robić

- Nie modeluj pola "Hole" (decyzja: pomijamy).
- Cal.com, onboarding wizard, tryb proaktywny (n8n cron), historia akceptacji sugestii — Faza 2, nie zaczynaj bez decyzji użytkownika.
- Bez docker-compose i Redis w Fazie 1 (ADR-003).
