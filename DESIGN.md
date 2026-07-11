---
version: alpha
name: Szychta
description: Czysty, minimalistyczny kalendarz zmianowy w duchu Cal.com (dark mode) — kolor jako informacja, nie dekoracja.
colors:
  bg-primary: "#0A0A0A"
  bg-secondary: "#111111"
  surface: "#1C1C1C"
  border: "#2E2E2E"
  text-primary: "#F9FAFB"
  text-secondary: "#A1A1AA"
  primary: "#F9FAFB"
  on-primary: "#0A0A0A"
  work-block: "#3B82F6"
  course-block: "#F59E0B"
  personal-block: "#10B981"
  overnight-block: "#6366F1"
  danger: "#EF4444"
  # Pastelowe wypełnienia kart wydarzeń (Cal.com-style) — NIEPRZEZROCZYSTY
  # odcień koloru typu (10-18% barwy zmieszane z bg-primary; nocleg celowo
  # ciemniejszy — 10% — niż work/course/personal, żeby nie "krzyczał"), żeby
  # karta zasłaniała elementy pod nią; tekst to jaśniejszy odcień tej samej
  # barwy (nie sam bazowy kolor — za nisko kontrastowy).
  # Pasek boczny 2-3px zostaje w pełnym kolorze bazowym (work-block itd.).
  work-block-bg: "#132034"
  work-block-text: "#93C5FD"
  course-block-bg: "#30220A"
  course-block-text: "#FCD34D"
  personal-block-bg: "#0B261D"
  personal-block-text: "#6EE7B7"
  overnight-block-bg: "#131321"
  overnight-block-text: "#A5B4FC"
typography:
  h1:
    fontFamily: Inter
    fontSize: 2rem
    fontWeight: 700
  h2:
    fontFamily: Inter
    fontSize: 1.5rem
    fontWeight: 600
  h3:
    fontFamily: Inter
    fontSize: 1.25rem
    fontWeight: 600
  body-large:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: 400
  body:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: 400
  caption:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: 400
  numeric:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: 500
rounded:
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
components:
  event-block:
    backgroundColor: "{colors.bg-secondary}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
  event-accent-work:
    backgroundColor: "{colors.work-block}"
    width: 3px
  event-fill-work:
    backgroundColor: "{colors.work-block-bg}"
    textColor: "{colors.work-block-text}"
  event-accent-course:
    backgroundColor: "{colors.course-block}"
    width: 3px
  event-fill-course:
    backgroundColor: "{colors.course-block-bg}"
    textColor: "{colors.course-block-text}"
  event-accent-personal:
    backgroundColor: "{colors.personal-block}"
    width: 3px
  event-fill-personal:
    backgroundColor: "{colors.personal-block-bg}"
    textColor: "{colors.personal-block-text}"
  event-accent-overnight:
    backgroundColor: "{colors.overnight-block}"
    width: 3px
  event-fill-overnight:
    backgroundColor: "{colors.overnight-block-bg}"
    textColor: "{colors.overnight-block-text}"
  backlog-card:
    backgroundColor: "{colors.bg-secondary}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
  sidebar-section-label:
    textColor: "{colors.text-secondary}"
    typography: "{typography.caption}"
  validation-error:
    textColor: "{colors.danger}"
    typography: "{typography.caption}"
  agent-suggestion-card:
    backgroundColor: "{colors.bg-primary}"
    rounded: "{rounded.lg}"
  earnings-panel:
    backgroundColor: "{colors.surface}"
    typography: "{typography.numeric}"
    rounded: "{rounded.lg}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
---

## Overview

Aplikacja ma czuć się jak panel Cal.com w trybie ciemnym: niemal czarne tło, płaskie karty z delikatnym obramowaniem, zero ciężkich gradientów i cieni. Jeden, stały motyw ciemny — bez trybu jasnego, bez przełącznika. Jedna kolumna główna (Planner z siatką godzinową) plus wąski, zwijalny sidebar — nigdy odwrotnie. Ikony minimalistyczne, liniowe (Lucide/Heroicons), nie wypełnione.

## Colors

Kolor jest nośnikiem informacji, nie dekoracją. Tło aplikacji to niemal czerń `{colors.bg-primary}`; duże kontenery (box treści, sidebar, siatka plannera) siedzą na `{colors.bg-secondary}`; karty i overlaye UNIESIONE nad kontenerem (dialogi, popovery, karty w stylu Cal.com) dostają jeszcze jaśniejszą warstwę `{colors.surface}` — bez tego stopnia różnicy karta wtapia się w tło kontenera i znika. Wszystko oddzielone subtelnym obramowaniem `{colors.border}` — nigdy cieniem. Każdy typ bloku ma stały kolor w całej aplikacji: praca `{colors.work-block}` (niebieski), kurs/szkolenie `{colors.course-block}` (bursztynowy), prywatne `{colors.personal-block}` (zielony), nocleg w pracy `{colors.overnight-block}` (fiolet — musi być natychmiast odróżnialny, bo znaczy "niedostępny do wyjazdu", nie "zajęty"); wszystkie cztery zachowują pełne nasycenie i czytelność na ciemnym tle. "Nocleg" jest też własnym, wybieralnym typem bloku (osobno od checkboxa "Nocleg w pracy" na zmianie roboczej) — używa dokładnie tych samych tokenów `{colors.overnight-block}` / `overnight-block-bg` / `overnight-block-text`, bez nowej palety. Akcja główna (przycisk primary) jest w stylu Cal.com odwrócona: jasne tło `{colors.primary}` z ciemnym tekstem `{colors.on-primary}` — jedyne miejsce, gdzie tło jest jaśniejsze niż otoczenie. `{colors.danger}` dla konfliktów, błędów walidacji oraz wskaźnika bieżącego czasu na siatce (linia + kropka + etykieta godziny — konwencja znana z Google Calendar/Cal.com; czerwień oznacza tu "teraz", nie błąd). Sama linia jest przerywana (`border-dashed`) — kropka i etykieta godziny zostają pełne, żeby nie zlewać się z linią; wskaźnik ma przełącznik widoczności w toolbarze (domyślnie widoczny, stan zapamiętany w localStorage jak zoom).

## Typography

Inter wszędzie. Nagłówki 600–700, body 400–500. Dane liczbowe (godziny, zarobki) zawsze z `font-variant-numeric: tabular-nums` — kwoty w tabeli zarobków nie mogą "skakać" przy przeliczaniu. Skala: 12 px caption, 14 px body, 16 px body large, 20/24/32 px nagłówki.

## Layout

Topbar (logo, data, + Dodaj, szukaj, profil), pod nim dwie kolumny: sidebar (sticky, własny scroll) i Planner (siatka godzinowa, niezależny scroll). Sidebar to accordion: najbliższa zmiana (zawsze widoczna), bloki cykliczne, backlog "Do zaplanowania" z licznikiem, panel agenta AI, filtry. Panel boczny ma przełącznik pokaż/schowaj w prawym górnym rogu.

## Elevation & Depth

Płasko. Karty odróżnia obramowanie `{colors.border}` i tło `{colors.bg-secondary}`, nie cień — na ciemnym tle cień i tak jest prawie niewidoczny. Jeśli cień — tylko delikatny, na elementach uniesionych (modal, dropdown), nigdy jako główny sposób odróżniania powierzchni.

## Shapes

Język kształtu w duchu Cal.com ("Refined Approachability") — bez ich niebieskiego akcentu, nasza paleta mono zostaje bez zmian. Zasada: im bardziej interaktywny i "dotykalny" element, tym pełniejsze zaokrąglenie.

- Przyciski i CTA: `{rounded.sm}` (8 px) — miękkie, ale ciasne prostokąty (decyzja użytkownika 2026-07-10: bez pigułek; skorygowane z {rounded.md} na {rounded.sm} tego samego dnia — 12 px wyglądało zbyt "nabrzmiale" na małych przyciskach jak przełącznik Dzień/Tydzień), wszystkie przyciski, chipy dni tygodnia, segmenty przełącznika Dzień/Tydzień. `{rounded.full}` zostaje dla badge, kropek i uchwytu scrollbara.
- Pola formularzy (input, select, checkbox): `{rounded.sm}` (8 px) — zostają kompaktowe, NIE pigułki.
- Karty i kontenery (backlog, panel zarobków, karta sugestii agenta): `{rounded.lg}` (16 px).
- Modale, dialogi i overlaye (Dialog, panel czatu): `{rounded.xl}` (24 px).
- Wyjątek celowy: bloki siatki plannera i wydarzenia zostają na `{rounded.sm}` (8 px) — tak jak w Cal.com, gęste bloki kalendarza nie są mocno zaokrąglone, bo muszą ciasno wypełniać siatkę godzinową.

Blok wydarzenia ma kolorowy pasek 2–3 px przy lewej krawędzi kodujący typ, a całe tło karty dostaje delikatne, nieprzezroczyste wypełnienie w odcieniu tego samego koloru (`{colors.work-block-bg}` itd. — barwa zmieszana z tłem aplikacji, karta zasłania to, co pod nią) z tekstem w jaśniejszym odcieniu tej samej barwy (`{colors.work-block-text}` itd.) — styl Cal.com, kolor jako wypełnienie karty, nie tylko pasek.

Okres noclegu w swoim RDZENIU nie pokazuje etykiety "Nocleg" ani podpisu "(poza domem)" — tekst to nazwa/miejsce noclegu (`block.name`, np. "Nocleg - Katowice") nad jedną zwięzłą linią "od → do" (np. "Czw 21:00 → Pt 07:00", skróty dni tygodnia), oba na PIERWSZYM segmencie ciągu noclegowego (użytkownik cofnął wcześniejszą decyzję "bez tekstu" z 2026-07-10); kontynuacje ciągu na kolejnych dniach zostają bez tekstu. Poza tym dostaje miękką wewnętrzną poświatę (`.overnight-glow`, box-shadow inset), cienki pasek akcentu przy lewej krawędzi, neutralne obramowanie karty, ORAZ (żeby zaznaczone dni były widocznie zabarwione, sam glow był za mało widoczny) blade PRZEZROCZYSTE wypełnienie tła — `color-mix(in srgb, var(<kolor typu>) 8%, transparent)` inline, celowo NIE opaque `*-block-bg`, żeby linie siatki godzinowej przebijały przez kartę. Kolorowanie per-typ jest podstawowe: poświata, pasek akcentu i tint tła przyjmują kolor WŁASNEGO typu bloku (praca = niebieski, kurs = bursztynowy, prywatne = zielony), nie stały dedykowany fiolet. Tokeny `{colors.overnight-block}` / `overnight-block-bg` / `overnight-block-text` zostają w palecie wyłącznie jako fallback dla typu bloku spoza tej trójki.

Bufor dojazdu/powrotu (Change 3, restylowane) nie jest osobnym boksem — scala się z kartą samej zmiany (albo noclegu) w jedną wizualną całość: karta rozciąga się na pełny zakres bufor-przed..bufor-po, a same strefy buforu dostają skośne kreskowanie w kolorze WŁASNEGO typu bloku (`.buffer-stripes`, `color-mix(... 18%, transparent)` przez `--stripe-color`) z etykietą "Dojazd"/`{minuty}min` (strefa przed) albo "Odjazd"/`{minuty}min` (strefa po) w kolorze `*-block-text` — etykieta reaguje na realną wysokość strefy: poniżej 20 minut brak tekstu (same paski), 20–44 minuty tylko zwięzłe `{minuty}min` (jedna linia, bez słowa), od 45 minut pełna dwuwierszowa etykieta "Dojazd"/`{minuty}min`. Nocleg z jawną luką między końcem zmiany a startem noclegu dostaje własną strefę "Dojazd" (dojazd do miejsca noclegu, przycięty tak, by nigdy nie wchodzić na rdzeń zmiany); bez jawnej luki (nocleg zaczyna się od razu w miejscu pracy) tej strefy nie ma. Karta nakładająca się WYŁĄCZNIE z buforem innego bloku (nie z jego zmianą) renderuje się w pół szerokości, wyrównana do prawej, nad tą strefą kreskowaną.

Klik na dowolnej karcie (zmiana, nocleg, scalony bufor) bez przeciągnięcia ustawia ją jako "wyfokusowaną" zamiast od razu otwierać edycję: dwie przerywane linie prowadzące (`border-dashed`, kolor `{colors.text-primary}`) zaznaczają jej prawdziwy początek/koniec na całą szerokość kolumny dnia, a mały overlay (`{colors.surface}` tło, obramowanie `{colors.border}`, `{rounded.md}`, cień) pokazuje pełną informację — nazwę, typ, godziny, strefy dojazdu/odjazdu — niezależnie od tego, ile miejsca ma sama karta. Drugi klik na już wyfokusowanej karcie dopiero otwiera modal edycji; klik gdzie indziej albo Escape czyści focus. Bardzo krótkie karty (rdzeń poniżej 45 minut) tracą trzecią linię tekstu (typ) i dostają ciaśniejszy padding pionowy zamiast pełnego kompletu — pełne info i tak dostępne przez focus.

## Components

Blok wydarzenia: pasek boczny w kolorze typu, nazwa + godziny wewnątrz. Karta backlogu: nazwa, czas trwania, kropka priorytetu, przycisk "Znajdź termin". Panel agenta: dymki czatu, ale rekomendacje terminów jako osobne klikalne karty z przyciskiem "Dodaj do kalendarza" (animacja pojawienia: fade + slide-up z transitions-dev). Panel zarobków: stawka godzinowa, dynamiczna lista pozycji, pogrubiona suma przeliczana live — bez przycisku "oblicz".

## Do's and Don'ts

- TAK: typ bloku oznaczaj kolorem ORAZ ikoną/etykietą (daltoniści).
- TAK: widoczny focus state na każdym elemencie interaktywnym; respektuj `prefers-reduced-motion` (transitions-dev robi to od razu).
- TAK: kontrast min. WCAG AA dla wszystkich kolorów bloków na tle.
- NIE: gradienty, ciężkie cienie, wypełnione kolorowe ikony.
- NIE: nowe kolory poza paletą — jeśli czegoś brakuje, najpierw zaktualizuj ten plik.
- NIE: animacje pisane ręcznie — tylko snippety transitions-dev.
