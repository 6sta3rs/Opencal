# ADR-003: Docker — minimalnie teraz, pełna konteneryzacja później

**Status:** Accepted
**Data:** 2026-07-09
**Decydent:** Paweł (właściciel projektu), potwierdzone 2026-07-09

## Kontekst

Projekt potrzebuje PostgreSQL lokalnie. Pytanie o zakres konteneryzacji w Fazie 1: pełny docker-compose (app + baza + Redis), sama baza w kontenerze, czy natywna instalacja PostgreSQL?

## Decyzja

**Faza 1: aplikacja działa natywnie (`pnpm dev`), tylko PostgreSQL w pojedynczym kontenerze Docker (`kalendarz-db`, postgres:16, port 5432). Bez docker-compose, bez Redis, bez konteneryzacji aplikacji.** Docker Compose + Redis wchodzą jako Faza 2, dopiero gdy pojawi się realna potrzeba cache'owania (np. wyniki gap-finding dla dużych zakresów dat).

## Rozważane opcje

### Opcja A: Pojedynczy kontener na bazę (wybrana)

| Wymiar | Ocena |
|---|---|
| Złożoność | Minimalna — jedna komenda `docker run` |
| Koszt | Zerowy |
| Izolacja | Wystarczająca — baza projektu odseparowana od istniejącego `postgres-central` (n8n, port 5433) |
| DX | Hot-reload Next.js natywnie, bez warstwy kontenera |

**Plusy:** czysta baza per projekt, łatwy reset (`docker rm` + `docker run`), zero konfiguracji YAML.
**Minusy:** środowisko nie jest w 100% odtwarzalne jedną komendą — akceptowalne dla projektu solo.

### Opcja B: Pełny docker-compose (app + db + Redis)

**Plusy:** odtwarzalność, parytet dev/prod.
**Minusy:** YAGNI — nie ma jeszcze niczego do cache'owania, aplikacja i tak deployuje się na Vercel (nie jako kontener), a dockeryzacja Next.js dev spowalnia hot-reload na Windows.

### Opcja C: Natywna instalacja PostgreSQL

**Plusy:** brak zależności od Dockera.
**Minusy:** Docker już działa na tej maszynie (istniejące kontenery), natywna instalacja na Windows jest trudniejsza do wersjonowania i czyszczenia niż kontener.

## Analiza trade-offów

Docker na maszynie już jest i działa — pojedynczy kontener to najtańsza izolacja bazy. Wszystko powyżej (compose, Redis) to koszt bez odbiorcy: nie istnieje jeszcze żaden problem wydajnościowy, który cache miałby rozwiązać.

## Konsekwencje

- Łatwiej: start projektu jedną komendą docker + `pnpm dev`; brak plików compose do utrzymania.
- Trudniej: onboarding drugiej osoby wymaga README z komendą `docker run` (udokumentowane w README).
- Do rewizji (wyzwalacz Fazy 2): gdy profilowanie pokaże, że gap-finding lub sync GCal wymaga cache — wtedy docker-compose z Redis, nie wcześniej.
