# ADR-001: Next.js API Routes zamiast osobnego backendu

**Status:** Accepted
**Data:** 2026-07-09
**Decydent:** Paweł (właściciel projektu), potwierdzone 2026-07-09

## Kontekst

Aplikacja potrzebuje warstwy API: CRUD bloków cyklicznych, silnik gap-finding, endpointy time-trackingu (`POST /api/entries` itd.), endpoint agenta AI, webhooki Google Calendar/Cal.com. Projekt jest solo, hostowany docelowo na Vercel + osobna baza. Pytanie: czy API ma żyć w Next.js (App Router route handlers), czy jako osobny serwis Node.js/Express?

## Decyzja

**Next.js API Routes (route handlers w App Router).** Cała aplikacja — frontend i API — w jednym repozytorium i jednym procesie.

## Rozważane opcje

### Opcja A: Next.js API Routes

| Wymiar | Ocena |
|---|---|
| Złożoność | Niska — zero dodatkowej infrastruktury |
| Koszt | Zerowy dodatkowy (jeden deploy) |
| Skalowalność | Wystarczająca dla 1 użytkownika; serverless na Vercel |
| Znajomość | Wysoka — zgodne z obecnym stackiem użytkownika |

**Plusy:** jeden projekt, jeden deploy, wspólne typy TS między frontem a API, Prisma działa bezpośrednio w handlerach.
**Minusy:** długotrwałe procesy (cron, cięższe joby) nie pasują do modelu serverless — ale te i tak deleguje się do n8n zgodnie ze specyfikacją.

### Opcja B: Osobny serwis Node.js/Express

| Wymiar | Ocena |
|---|---|
| Złożoność | Średnia — drugi projekt, CORS, osobny deploy |
| Koszt | Drugi hosting/proces do utrzymania |
| Skalowalność | Niezależne skalowanie — niepotrzebne przy 1 użytkowniku |
| Znajomość | Wysoka, ale podwaja pracę |

**Plusy:** niezależny cykl życia API, brak ograniczeń serverless.
**Minusy:** YAGNI w czystej postaci — duplikacja konfiguracji, typów, deployu bez żadnej realnej korzyści na tym etapie.

## Analiza trade-offów

Jedyny realny argument za osobnym serwisem to długotrwałe zadania w tle — a te specyfikacja świadomie oddaje n8n (cron, webhooki, powiadomienia). Pozostaje czysty koszt bez zysku. Zgodne z Ponytail: najmniejsza architektura, która działa.

## Konsekwencje

- Łatwiej: jeden deploy, wspólne typy, prostsze testy integracyjne.
- Trudniej: gdyby kiedyś powstał drugi klient (mobilny), API jest sprzęgnięte z Next.js — ale route handlers to zwykłe funkcje HTTP, migracja jest mechaniczna.
- Do rewizji: jeśli pojawią się joby, których n8n nie udźwignie (np. ciężkie przeliczenia), wrócić do tematu osobnego workera — nie całego backendu.
