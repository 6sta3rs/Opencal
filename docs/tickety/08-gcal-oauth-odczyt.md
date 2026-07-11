# 08 — Google Calendar na żywo: OAuth + odczyt

**Rozmiar:** M · **Typ:** AFK · **Blokowany przez:** 07

## Co zbudować

OAuth Google + realna implementacja `BusySource` czytająca eventy użytkownika (freebusy/events API). Tokeny odświeżane automatycznie.

## Kryteria akceptacji

- [ ] Użytkownik łączy konto Google i realne eventy trafiają do gap-findingu
- [ ] Wygasły access token odświeża się bez interakcji
- [ ] Brak połączenia z GCal nie wywala gap-findingu (działa na samych blokach)
