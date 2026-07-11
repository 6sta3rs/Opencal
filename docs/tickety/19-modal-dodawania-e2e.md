# 19 — Modal dodawania bloku + e2e

**Rozmiar:** M · **Typ:** AFK · **Blokowany przez:** 17

## Co zbudować

Modal "+ Dodaj" (przejście modal z transitions-dev): nazwa, typ, godziny, dni tygodnia, bufory, staysOvernight. Pierwszy test e2e Playwright na pełnej ścieżce.

## Kryteria akceptacji

- [ ] e2e: otwórz modal → wypełnij → zapisz → blok widoczny w Plannerze
- [ ] Walidacja w formularzu (błąd → shake z transitions-dev + komunikat `validation-error`)
- [ ] Zamknięcie bez zapisu nie zostawia śmieci
