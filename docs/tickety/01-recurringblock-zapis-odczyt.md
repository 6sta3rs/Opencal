# 01 — RecurringBlock: zapis i odczyt

**Rozmiar:** S · **Typ:** AFK · **Blokowany przez:** brak

## Co zbudować

Najprostszy pełny przekrój: model `RecurringBlock` w bazie + endpointy `POST /api/blocks` i `GET /api/blocks`. Jeden blok, jeden dzień tygodnia, bez rekurencji, bez buforów.

## Kryteria akceptacji

- [x] Użytkownik zapisuje blok "Praca" 5:00–6:00 na poniedziałek (`POST /api/blocks`) i dostaje go z powrotem w `GET /api/blocks`
- [x] Niepoprawne dane (brak nazwy, zły format godziny) → 400, nic nie zapisane
- [x] Dane przeżywają restart (realny zapis w PostgreSQL — testy używają prawdziwej bazy, wpisy z poprzednich uruchomień są widoczne)

**Status: zrobione 2026-07-09.** Testy: `app/api/blocks/route.test.ts` (3), implementacja: `app/api/blocks/route.ts`, `lib/prisma.ts`, model w `prisma/schema.prisma`.
