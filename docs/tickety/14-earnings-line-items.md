# 14 — EarningsLineItem

**Rozmiar:** S · **Typ:** AFK · **Blokowany przez:** 13

## Co zbudować

Rozszerzenie pojedynczego `additionalPay` na listę pozycji `EarningsLineItem {label, amount}` + `POST /api/entries/:id/line-items`. Suma pozycji wchodzi do earnings.

## Kryteria akceptacji

- [x] Dodanie pozycji "Nadgodziny 80 PLN" i "Dodatek nocny 40 PLN" → earnings = baza + 120
- [x] Usunięcie pozycji natychmiast koryguje sumę
- [x] Istniejące wpisy z `additionalPay` dalej liczą się poprawnie (migracja bez utraty danych)

**Status: zrobione 2026-07-09.** Model `EarningsLineItem` (entryId, label, amount, onDelete: Cascade) w `prisma/schema.prisma`. `calculateEarnings` w `lib/earnings.ts` rozszerzony o sumę pozycji (baza + additionalPay + Σ line items) — tabela dodatkowa, `additionalPay` nietknięty, więc istniejące wpisy liczą się bez zmian (brak dedykowanego testu migracyjnego — potwierdza to już test z ticketu 13 na samym additionalPay). Endpointy: `app/api/entries/[id]/line-items/route.ts` (POST, zwraca wpis z przeliczonym earnings), `app/api/entries/[id]/line-items/[itemId]/route.ts` (DELETE). Testy: `app/api/entries/[id]/line-items/route.test.ts` (2). Migracja `20260709215032_earnings_line_item`.
