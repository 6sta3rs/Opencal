# Design System — referencja Cal.com

Cel: aplikacja ma **czuć się** jak Cal.com — czysty, minimalistyczny, profesjonalny kalendarz — przy zachowaniu własnej kolorystyki i dopasowaniu do Twojego use-case (zmiany, kursy, zarobki).

---

## 1. Filozofia wizualna (z Cal.com)

- **Dużo białej przestrzeni**, brak zbędnych dekoracji — kalendarz ma być czytelny na pierwszy rzut oka
- **Jedna kolumna główna** (widok dnia/tygodnia) + wąski, zwijalny sidebar — nigdy odwrotnie
- **Płaskie karty** z delikatnym cieniem/obramowaniem, zaokrąglone rogi (radius ~8-12px), brak ciężkich gradientów
- **Kolor jako informacja, nie dekoracja** — każdy typ bloku (praca/kurs/prywatne) ma swój kolor, konsekwentnie używany w całej appce
- **Ikony minimalistyczne, liniowe** (jak Lucide/Heroicons) — nie wypełnione, nie kolorowe same w sobie

---

## 2. Paleta kolorów (propozycja, do dostosowania)

| Token | Hex | Użycie |
|---|---|---|
| `--bg-primary` | `#FFFFFF` | Tło główne |
| `--bg-secondary` | `#F8F9FA` | Tło sidebaru, kart |
| `--border` | `#E5E7EB` | Linie siatki godzinowej, obramowania |
| `--text-primary` | `#111827` | Główny tekst |
| `--text-secondary` | `#6B7280` | Etykiety, mniej istotny tekst |
| `--accent-primary` | `#4F46E5` | Główny akcent (przyciski, aktywne stany) — indygo jak w Reclaim/Cal.com |
| `--work-block` | `#3B82F6` | Bloki pracy (niebieski) |
| `--course-block` | `#F59E0B` | Bloki kursów/szkoleń (bursztynowy) |
| `--personal-block` | `#10B981` | Bloki prywatne (zielony) |
| `--overnight-block` | `#6366F1` | Blok noclegu w pracy (fiolet — wyraźnie odróżniony) |
| `--danger` | `#EF4444` | Konflikty, błędy walidacji |

Tryb ciemny: odwrócone `bg`/`text`, akcenty pozostają te same nasycone kolory na ciemnym tle.

---

## 3. Typografia

- **Display/nagłówki:** Inter lub system-ui, waga 600-700
- **Body:** Inter, waga 400-500
- **Dane liczbowe (godziny, zarobki):** czcionka z tabularnymi cyframi (`font-variant-numeric: tabular-nums`) — żeby liczby w tabeli zarobków się nie "skakały"

Skala: 12px (caption) / 14px (body) / 16px (body large) / 20px (h3) / 24px (h2) / 32px (h1)

---

## 4. Layout — struktura ekranu głównego

```
┌─────────────────────────────────────────────┐
│ Topbar: logo | data | + Dodaj | Szukaj | Ja  │
├──────────┬────────────────────────────────────┤
│          │                                    │
│ Sidebar  │  Planner (siatka godzinowa)        │
│ (sticky, │  — własny scroll, niezależny        │
│ własny   │  od sidebaru                        │
│ scroll)  │                                    │
│          │                                    │
└──────────┴────────────────────────────────────┘
```

**Sidebar (zwijalne sekcje, accordion):**
1. Najbliższa zmiana (zawsze widoczna, bez zwijania)
2. Bloki cykliczne (praca, kursy) — z kolorowym paskiem jak w Reclaim
3. Backlog "Do zaplanowania" — z licznikiem przy nagłówku
4. Panel agenta AI (mini-czat + sugestie)
5. Filtry widoczności

---

## 5. Komponenty kluczowe

### 5.1 Blok wydarzenia w kalendarzu
- Kolorowy pasek boczny (2-3px) po lewej krawędzi karty — koduje typ
- Nazwa + godziny wewnątrz karty
- Blok noclegu (`staysOvernight`) wizualnie **inny wzór** (np. delikatny wzór ukośnych pasków w tle) — musi być natychmiast odróżnialny od zwykłej zmiany, bo oznacza "niedostępny do wyjazdu", nie "zwykła zajętość"

### 5.2 Karta w Backlogu
- Nazwa, czas trwania, opcjonalny priorytet (kolorowa kropka)
- Przycisk "Znajdź termin" wywołujący agenta

### 5.3 Panel agenta
- Wygląd czatu: dymki wiadomości, ale **rekomendacje terminów jako osobne, klikalne karty** (nie tylko tekst) — z przyciskiem "Dodaj do kalendarza"
- Użyj `transitions-dev` do animacji pojawiania się nowej sugestii (fade + slight slide-up)

### 5.4 Panel zarobków (na bazie zrzutu z Twojej apki wzorcowej)
- Sekcja "Earnings" jako karta z jasnym tłem (`--bg-secondary`)
- Pola: Hourly rate, lista Line Items (dynamicznie dodawane), suma na dole pogrubiona
- Suma przelicza się **live**, bez przycisku "oblicz" — natychmiastowy feedback

---

## 6. Onboarding (pierwsze uruchomienie)

Wieloetapowy wizard (nie jeden długi formularz — Cal.com robi to krok po kroku):

**Krok 1 — Podstawy**
- Imię
- E-mail (do powiadomień)
- Strefa czasowa (auto-detect + możliwość zmiany)

**Krok 2 — Wzorce pracy**
- Dodaj pierwszy typ zmiany (nazwa, godziny start/koniec, dni tygodnia)
- Możliwość dodania kolejnych typów zmian (przycisk "+ Dodaj kolejny wzorzec")
- Pole: czy ta zmiana czasem wiąże się z noclegiem w pracy (`staysOvernight`)

**Krok 3 — Bufory**
- Domyślny bufor dojazdu (przed pracą)
- Domyślny bufor powrotu (po pracy)
- Info: "Możesz nadpisać to dla pojedynczych bloków później"

**Krok 4 — Zarobki (opcjonalnie, można pominąć)**
- Domyślna stawka godzinowa
- Waluta (PLN domyślnie)

**Krok 5 — Integracje**
- Połącz Google Calendar (OAuth)
- Opcjonalnie: Cal.com (webhook URL do wpisania)

**Krok 6 — Gotowe**
- Podsumowanie ustawień + przycisk "Przejdź do kalendarza"
- Pierwsza sugestia od agenta jako "powitanie": np. "Zauważyłem że masz X wolnych godzin w tym tygodniu"

**Zasada UX z Cal.com:** każdy krok ma jasny postęp (dots/progress bar u góry), można wrócić, nic nie jest "utracone" przy powrocie.

---

## 7. Dostępność (obowiązkowe, nie opcjonalne)

- Wszystkie kolory bloków mają wystarczający kontrast z tłem (min. WCAG AA)
- Widoczny focus state na wszystkich interaktywnych elementach (klawiatura)
- `prefers-reduced-motion` respektowane wszędzie (transitions-dev już to zapewnia w swoich snippetach)
- Kolor nigdy nie jest jedynym nośnikiem informacji — typ bloku ma też ikonę/etykietę tekstową, nie tylko kolor (ważne dla daltonistów)
