# 21 — Panel zarobków

**Rozmiar:** M · **Typ:** AFK · **Blokowany przez:** 14, 17

## Co zbudować

UI wpisu czasu wg wzorca ze zrzutu: godziny, przerwa, stawka, lista pozycji ("+ Dodaj pozycję"), pogrubiona suma. Przeliczanie live przy każdej zmianie pola — bez przycisku "oblicz". Cyfry tabularne (`typography.numeric`).

## Kryteria akceptacji

- [ ] Zmiana dowolnego pola natychmiast aktualizuje sumę (10h × 32 + 120 = 440 PLN)
- [ ] Dodanie/usunięcie pozycji koryguje sumę bez przeładowania
- [ ] Liczby nie "skaczą" (tabular-nums)
