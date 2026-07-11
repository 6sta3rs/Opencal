# Rzeczywiste ograniczenia harmonogramu + Time Tracking & Earnings

---

## 1. Rzeczywisty harmonogram pracy (constraints)

### 1.1 Zmiana poranna
- Start: 5:00
- Koniec: zmienny, zaraz po starcie (np. 6:00 lub dłużej)
- Buffer PRZED: 25 min (dojazd do pracy)
- Buffer PO: 25 min (powrót do domu)
- Nieregularna — nie każdego dnia

### 1.2 Zmiana popołudniowa/nocna
- Start: 17:00
- Koniec: 02:00 (następny dzień)
- Buffer PO: 45 min (powrót do domu + posiłek + odpoczynek)
- Nieregularna

### 1.2a Wariant: nocleg w miejscu pracy (bardzo ważne)

Czasem po zakończeniu zmiany **nie wracasz do domu** — zostajesz na miejscu (np. nocujesz w pracy) i wracasz dopiero np. w środę.

**Wpływ na model danych i algorytm:**
- Blok pracy zyskuje pole `staysOvernight: boolean`
- Gdy `staysOvernight = true`:
  - **Brak buffera powrotnego** po zakończeniu zmiany — jesteś "niedostępny/na miejscu", nie "wolny"
  - Czas między końcem zmiany a wyjazdem (`departureTime`, np. środa rano) jest **zablokowany**, nie liczy się jako wolne okno
  - Buffer powrotny (dojazd do domu, ~25 min) doliczany dopiero przy `departureTime`
- Gdy `staysOvernight = false` (dzień standardowy): normalny buffer po pracy jak w 1.1/1.2

**Model:**
```
RecurringBlock {
  ...
  staysOvernight: boolean
  departureTime?: DateTime   // kiedy faktycznie wracasz, jeśli staysOvernight = true
}
```

Silnik gap-finding musi to rozróżniać: dzień z noclegiem = brak wolnych okien wieczorem/nocą, wolne okna pojawiają się dopiero po `departureTime` + buffer.

### 1.3 Kurs (np. szkolenie na koparkę)
- Czas trwania: 3h
- Buffer PRZED (dojazd): do sprecyzowania (na razie placeholder ~15 min)
- Buffer PO (powrót): do sprecyzowania (~15 min)

### 1.4 Zasada dla silnika gap-finding
Algorytm nie szuka gołego bloku `duration_minutes` — szuka bloku:
```
buffer_przed + duration_minutes + buffer_po
```
i sprawdza, że buffer przed pracą i po pracy są respektowane jako część **każdego** bloku (pracy i aktywności), nie tylko kursu.

**Przykład z Twojego opisu:**
- Praca 17:00-02:00 + 45 min buffer po → realnie wolny dopiero 02:45
- Kurs potrzebuje: 15 min (dojazd) + 3h + 15 min (powrót) = 3h30min
- Agent sprawdza: czy jest 3h30min wolne miejsce zaczynające się od 02:45 do następnej pracy?

---

## 2. Time Tracking & Earnings (na podstawie zrzutu ekranu — wzorzec z istniejącej apki)

### 2.1 Model danych `TimeEntry`

```
TimeEntry {
  id
  blockId          // powiązanie z RecurringBlock (zmiana pracy)
  start            // Jun 26 06:00
  end              // Jun 26 16:00
  breakDuration    // 0h 00m — czas przerwy odjęty od płatnych godzin

  // Earnings
  hourlyRate       // 32.00 PLN — stawka bazowa
  additionalPay    // 120.00 PLN — dodatek (nadgodziny, premia, bonus za trudne warunki)
  earnings         // WYLICZANE: (godziny_pracy - break) × hourlyRate + additionalPay
  
  // Details (tagowanie — przydatne dla freelancera z wieloma klientami)
  client           // opcjonalne — dla której firmy/klienta
  project          // opcjonalny projekt
  task             // opcjonalne zadanie w ramach projektu
  note             // wolny tekst
}
```

### 2.2 Automatyczne przeliczanie (kluczowa funkcja)

Formuła licząca `earnings` w czasie rzeczywistym, gdy user edytuje pola:

```javascript
function calculateEarnings(entry) {
  const totalMinutes = differenceInMinutes(entry.end, entry.start) - entry.breakDuration;
  const hours = totalMinutes / 60;
  const base = hours * entry.hourlyRate;
  return base + entry.additionalPay;
}
```

Przelicza się **przy każdej zmianie** pola Start/End/Break/Hourly rate/Additional pay — dokładnie jak w apce ze zrzutu (10h × 32 PLN + 120 PLN = 440 PLN).

### 2.3 Rozszerzenie: dodawanie wielu elementów zarobku

Skoro chcesz "dodawać więcej elementów zarobku" — rozszerzamy `additionalPay` z pojedynczej liczby na **listę pozycji**:

```
EarningsLineItem {
  id
  entryId
  label       // np. "Nadgodziny", "Premia za trudne warunki", "Dodatek nocny"
  amount      // PLN
}
```

Wtedy:
```javascript
function calculateEarnings(entry, lineItems) {
  const base = hours * entry.hourlyRate;
  const extras = lineItems.reduce((sum, item) => sum + item.amount, 0);
  return base + extras;
}
```

UI: przycisk "+ Dodaj pozycję" pod sekcją Earnings, każda nowa pozycja natychmiast doliczana do sumy.

### 2.4 Analityka miesięczna

- Suma godzin przepracowanych w miesiącu
- Suma zarobków w miesiącu
- Rozbicie wg dnia tygodnia (który dzień najbardziej dochodowy)
- Rozbicie wg klienta/projektu (dla freelancera — ile zarobiłeś na kim)
- Porównanie miesiąc do miesiąca / dzień do dnia ("zarobiłem więcej niż wczoraj")

### 2.5 Endpointy pod tę funkcję

- `POST /api/entries` — nowy wpis czasu pracy
- `PATCH /api/entries/:id` — edycja (przelicza earnings automatycznie)
- `POST /api/entries/:id/line-items` — dodanie pozycji zarobku
- `GET /api/analytics/monthly?month=2026-07` — podsumowanie miesięczne

---

## 3. Otwarte pytania

- Czy `TimeEntry` jest tworzony automatycznie z `RecurringBlock` (np. codziennie o 5:00 tworzy się wpis do wypełnienia), czy user wpisuje ręcznie po zakończeniu zmiany?
- Jaka jest Twoja rzeczywista stawka godzinowa (do testów/przykładów)?
- Czy pole "Hole" ze zrzutu ekranu (wartość 30) to coś konkretnego (np. liczba dni urlopowych, numer działki/otworu w geodezji, literówka) — do wyjaśnienia zanim wejdzie do modelu danych
