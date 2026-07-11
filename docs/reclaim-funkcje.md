# Reclaim.ai — analiza funkcji (na podstawie zrzutów ekranu)

Analiza oparta o 3 zrzuty ekranu z aplikacji mobilnej (web app w przeglądarce mobilnej): menu boczne, widok Plannera oraz panel Priorities/Tasks.

---

## 1. Struktura głównej nawigacji (sidebar)

| Sekcja | Podpunkty | Opis |
|---|---|---|
| **Planner** | — | Główny widok kalendarza (dzień/tydzień) |
| **Priorities** | — | Panel z listą zadań/spotkań posortowanych wg priorytetu |
| **Stats** | — | Statystyki wykorzystania czasu |
| **Time blocking** | Focus, Habits, Buffers, Tasks | Grupa funkcji auto-blokowania czasu |
| **Meetings** | Smart Meetings, Scheduling Links | Zarządzanie spotkaniami i linkami do bookowania |
| **Calendar Sync** | — | Synchronizacja z kalendarzami zewnętrznymi |
| **Help** | — | Pomoc/dokumentacja (rozwijane) |
| **Invite teammates** | — | Zaproszenie współpracowników |
| **Settings** | — | Ustawienia konta |

**Na dole:** profil użytkownika (imię, e-mail) jako osobna, zwijana sekcja.

---

## 2. Time blocking — rozbicie funkcji

- **Focus** — automatyczne blokowanie czasu na pracę skupioną (deep work)
- **Habits** — nawyki/rutyny cykliczne (np. trening, przerwy), które elastycznie przesuwają się wokół innych wydarzeń
- **Buffers** — bufory czasowe między spotkaniami/blokami (np. przerwa na dojazd, odpoczynek)
- **Tasks** — zadania z określonym czasem trwania, automatycznie wpasowywane w wolne okna

---

## 3. Meetings — rozbicie funkcji

- **Smart Meetings** — inteligentne planowanie spotkań (dopasowanie do dostępności wszystkich uczestników)
- **Scheduling Links** — publiczne linki do bookowania (odpowiednik Calendly), z możliwością tworzenia wielu typów (widoczne w zrzucie 3: "High Priority Meeting", "Flexible Quick Meeting", "Quick Meeting")

---

## 4. Widok Plannera (zrzut 2)

- Górny pasek: nazwa widoku ("Planner"), przycisk **+** (dodaj wydarzenie), wyszukiwarka, przycisk Upgrade, menu hamburgerowe
- Pasek nawigacji dat: strzałki wstecz/dalej, aktualna data z rozwijanym pickerem, ikony: ustawienia (⚙), widok kalendarza, pomoc (?), przełącznik panelu bocznego
- Główna siatka: oś czasu godzinowa (widoczna strefa czasowa np. CEST) z liniami co godzinę — pusty grid gotowy na wydarzenia
- Panel można **schować/pokazać** ikoną w prawym górnym rogu (ikona "podziel ekran")

---

## 5. Panel Priorities/Tasks (zrzut 3)

- Dwie zakładki: **Priorities** i **Tasks** (przełączane u góry)
- Pole wyszukiwania + ikona filtra
- Lista pogrupowana wg priorytetu:
  - **Critical** (z licznikiem, sekcja zwijana przyciskiem "Collapse")
  - **High priority**
  - **Medium priority**
  - **Low priority**
  - **Disabled** (wyłączone/nieaktywne pozycje — też zwijane)
- Każda pozycja (np. "High Priority Meeting") ma:
  - kolorowy pasek boczny (oznaczenie kategorii/priorytetu)
  - nazwę
  - ikonę kopiowania (duplikuj)
  - ikonę wykresu (poziom priorytetu / statystyki)
  - menu kontekstowe (trzy kropki: edytuj/usuń/więcej opcji)
- Pozycje "Disabled" są wyszarzone, ale wciąż widoczne na liście (nie usunięte, tylko wyłączone)

---

## 6. Kluczowe wzorce UX do przeniesienia na Twój projekt

1. **Zwijane sekcje (accordion)** w sidebarze/panelu — grupowanie funkcji, żeby nie przytłaczać
2. **Grupowanie wg priorytetu/statusu**, nie tylko wg typu — ułatwia szybkie skanowanie wzrokiem
3. **Liczniki przy nagłówkach sekcji** (np. "Scheduling Links [1]") — natychmiastowa informacja o ilości
4. **Kolorowy pasek boczny przy każdej pozycji** — szybka identyfikacja kategorii bez czytania
5. **Osobny przełącznik widoczności panelu** (ikona split-screen) — użytkownik sam decyduje, czy panel zajmuje miejsce
6. **Rozdzielenie "Planner" (kalendarz) od "Priorities/Tasks" (backlog)** — dokładnie to, o czym mówiliśmy: miejsce na rzeczy jeszcze nieprzypisane do konkretnego czasu

---

## 7. Do zaimplementowania w Twojej wersji (checklist)

- [ ] Sidebar z sekcjami zwijanymi (Twoje: Zmiany pracy / Typy zajęć / Backlog / Ustawienia)
- [ ] Widok Planner z osią godzinową i strefą czasową
- [ ] Panel boczny z zakładkami: **Do zaplanowania** / **Zaplanowane**
- [ ] Grupowanie wg priorytetu (Critical/High/Medium/Low) lub wg kategorii (Praca/Szkolenia/Prywatne)
- [ ] Licznik pozycji przy każdej grupie
- [ ] Kolorowe oznaczenia kategorii (pasek boczny)
- [ ] Przełącznik pokaż/schowaj panel (ikona w prawym górnym rogu)
- [ ] Osobny sticky scroll dla sidebaru i main content (patrz wcześniejsza rozmowa o CSS)
