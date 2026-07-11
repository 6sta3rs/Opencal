# 11 — Przypisanie pozycji backlogu do terminu

**Rozmiar:** S · **Typ:** AFK · **Blokowany przez:** 10, 02

## Co zbudować

Akcja "zaplanuj": pozycja backlogu + wybrane okno → jednorazowy event w kalendarzu, pozycja oznaczona jako zaplanowana.

## Kryteria akceptacji

- [x] Przypisana pozycja pojawia się w kalendarzu w wybranym terminie
- [x] Zaplanowana pozycja znika z listy "Do zaplanowania"
- [x] Odwołanie eventu przywraca pozycję do backlogu

**Status: zrobione 2026-07-09.** Bez osobnego modelu `ScheduledEvent` — pola `scheduledStart`/`scheduledEnd` (DateTime?) na `BacklogItem`; zaplanowanie = ustawione oba pola (sufit: osobny model, gdy jedna pozycja ma mieć wiele terminów albo eventy niezwiązane z backlogiem). Akcja "zaplanuj": `POST /api/backlog/:id/schedule` (`app/api/backlog/[id]/schedule/route.ts`), odwołanie: `DELETE` na tej samej ścieżce (czyści pola). `GET /api/backlog` domyślnie zwraca tylko listę "Do zaplanowania" (scheduledStart = null), `GET /api/backlog?status=scheduled` — pozycje z terminem (kalendarz). Testy: `app/api/backlog/[id]/schedule/route.test.ts` (3). Migracja `20260709212009_backlog_scheduling`.
