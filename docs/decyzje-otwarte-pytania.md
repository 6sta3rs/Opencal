# Decyzje — odpowiedzi na otwarte pytania (2026-07-09)

Odpowiedzi użytkownika na pytania z `harmonogram-i-zarobki.md` (sekcja 3) i `kalendarz-app-specyfikacja.md` (sekcja 6). Te decyzje obowiązują w całym projekcie.

## Z harmonogram-i-zarobki.md

1. **Tworzenie `TimeEntry`: auto-szkic z bloku.** Gdy zaczyna się zaplanowana zmiana (`RecurringBlock`), automatycznie tworzy się szkic wpisu z godzinami z grafiku — użytkownik poprawia faktyczny koniec, przerwy i dodatki.
2. **Stawka godzinowa do testów/przykładów: 32,00 PLN** (wartość ze zrzutu wzorcowej apki, domyślna w testach i seedach).
3. **Pole "Hole": pomijamy.** Nie wchodzi do modelu danych (YAGNI/Ponytail). Można dodać później, gdy się wyjaśni.

## Z kalendarz-app-specyfikacja.md

4. **Backend: Next.js API Routes** (bez osobnego serwisu) — zgodnie z ADR z agent-setup-guide.md, potwierdzone.
5. **Sygnały agenta AI na start: minimalny zestaw** — pora dnia z prośby użytkownika (np. "najlepiej rano") + unikanie okien tuż po zmianie nocnej. Historia akceptacji/odrzuceń sugestii — późniejsza iteracja.
6. **Cal.com: druga iteracja**, po Google Calendar (zgodnie z kolejnością implementacji 4.3, punkt 7).

## Dodatkowe ustalenia

7. **Bufory kursu** (sekcja 1.3 harmonogramu): 15 min dojazd / 15 min powrót jako wartość domyślna, edytowalna per blok.
