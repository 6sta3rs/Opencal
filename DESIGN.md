---
version: alpha
name: OpenCal
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

Kolor jest nośnikiem informacji, nie dekoracją. Tło aplikacji to niemal czerń `{colors.bg-primary}`; duże kontenery (box treści, sidebar, siatka plannera) siedzą na `{colors.bg-secondary}`; karty i overlaye UNIESIONE nad kontenerem (dialogi, popovery, karty w stylu Cal.com) dostają jeszcze jaśniejszą warstwę `{colors.surface}` — bez tego stopnia różnicy karta wtapia się w tło kontenera i znika. Wszystko oddzielone subtelnym obramowaniem `{colors.border}` — nigdy cieniem. Każdy typ bloku ma stały kolor w całej aplikacji: praca `{colors.work-block}` (niebieski), kurs/szkolenie `{colors.course-block}` (bursztynowy), prywatne `{colors.personal-block}` (zielony), nocleg w pracy `{colors.overnight-block}` (fiolet — musi być natychmiast odróżnialny, bo znaczy "niedostępny do wyjazdu", nie "zajęty"); wszystkie cztery zachowują pełne nasycenie i czytelność na ciemnym tle. "Nocleg" jest też własnym, wybieralnym typem bloku (osobno od checkboxa "Nocleg w pracy" na zmianie roboczej) — używa dokładnie tych samych tokenów `{colors.overnight-block}` / `overnight-block-bg` / `overnight-block-text`, bez nowej palety. Akcja główna (przycisk primary) jest w stylu Cal.com odwrócona: jasne tło `{colors.primary}` z ciemnym tekstem `{colors.on-primary}` — jedyne miejsce, gdzie tło jest jaśniejsze niż otoczenie. `{colors.danger}` dla konfliktów, błędów walidacji oraz wskaźnika bieżącego czasu na siatce (linia + kropka + etykieta godziny — konwencja znana z Google Calendar/Cal.com; czerwień oznacza tu "teraz", nie błąd). Odcinek NA PRAWO od kropki (przez kolumnę dzisiejszego dnia) jest PEŁNY, nie przerywany; od kropki W LEWO, do rynny osi godzin (przez ewentualne wcześniejsze dni widocznego tygodnia), biegnie osobny, PRZERYWANY łącznik w kolorze `{colors.text-primary}` (nie czerwony) — wizualnie spina czerwoną etykietę godziny w osi z kropką "teraz". Wskaźnik ma przełącznik widoczności w Ustawieniach (`/ustawienia`, sekcja "Kalendarz" — patrz Layout niżej; domyślnie widoczny, stan zapamiętany w localStorage jak zoom).

## Typography

Inter wszędzie. Nagłówki 600–700, body 400–500. Dane liczbowe (godziny, zarobki) zawsze z `font-variant-numeric: tabular-nums` — kwoty w tabeli zarobków nie mogą "skakać" przy przeliczaniu. Skala: 12 px caption, 14 px body, 16 px body large, 20/24/32 px nagłówki.

## Layout

Topbar (logo, data, + Dodaj, szukaj, profil), pod nim dwie kolumny: Planner (siatka godzinowa, niezależny scroll) i sidebar PO PRAWEJ (sticky, własny scroll) — decyzja użytkownika 2026-07-11, wcześniej sidebar był po lewej. Sidebar od góry: statystyki tygodnia (zawsze widoczne, suma godzin wg typu bloku jako prosty stacked bar), najbliższa zmiana (zawsze widoczna), potem accordion: bloki cykliczne, backlog "Do zaplanowania" z licznikiem, panel agenta AI, filtry (typ bloku ORAZ cykliczne/jednorazowe). Panel boczny ma przełącznik pokaż/schowaj w swoim prawym górnym rogu — ten sam slot zamienia się w strzałkę powrotu, gdy sidebar pokazuje widok edycji (patrz akapit o kliknięciu na kartę niżej): obie funkcje są wzajemnie wykluczające się widoki, więc dzielą jeden róg zamiast dwóch podobnych ikon obok siebie.

Toolbar plannera (nad siatką) trzyma tylko "essentials": Poprzedni/Dziś/Następny, Dzień/Tydzień, zoom 1h/30min, oraz ikonę koła zębatego (Ustawienia). Rzadziej dotykane przełączniki — "Linia teraz" i tryb "Znaczniki granic" — mieszkają na osobnej stronie `/ustawienia` (sekcja "Kalendarz"), dostępnej z ikony w toolbarze oraz z pozycji "Ustawienia" przypiętej na dole głównej szyny nawigacji; oba przełączniki piszą i czytają te same klucze localStorage co dawniej, planner po prostu odczytuje je na nowo przy każdym montażu strony.

Pływający dymek czatu AI (globalny, montowany w AppShell na każdej stronie) siedzi w prawym dolnym rogu — na stronie Plannera jego pozioma pozycja jest przesunięta w lewo o szerokość prawego sidebara (custom property CSS aktualizowana przez sam sidebar), żeby nigdy nie zachodzić na strefę edycji, w obu jej stanach (zwinięty/rozwinięty); na stronach bez tego sidebara zostaje w zwykłym rogu viewportu.

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

Bufor dojazdu/powrotu (Change 3, restylowane) nie jest osobnym boksem — scala się z kartą samej zmiany (albo noclegu) w jedną wizualną całość: karta rozciąga się na pełny zakres bufor-przed..bufor-po, a same strefy buforu dostają skośne kreskowanie w kolorze WŁASNEGO typu bloku (`.buffer-stripes`, `color-mix(... 18%, transparent)` przez `--stripe-color`) w kolorze `*-block-text` — etykieta to znak kierunku + czas trwania + godzina graniczna zegarowa, np. `−20 min · 08:40` (strefa przed — 08:40 to godzina, o której trzeba wyjechać) albo `+25 min · 16:10` (strefa po — 16:10 to godzina, od której użytkownik jest faktycznie wolny); słowa "Dojazd"/"Odjazd" celowo pominięte na OBU poziomach szczegółowości — sam znak (−/+) niesie kierunek. Etykieta reaguje na realną wysokość strefy: poniżej 20 minut brak tekstu (same paski), 20–44 minuty wariant compact bez słowa "min" (`−20 · 08:40`), od 45 minut pełny wariant ze słowem "min" (`−20 min · 08:40`). Ten sam format (`formatBufferLabel` w `lib/planner-grid.ts`) używany w nagłówku widoku edycji w sidebarze, obok dokładnego zakresu w nawiasie. Nocleg z jawną luką między końcem zmiany a startem noclegu dostaje własną strefę "przed" (dojazd do miejsca noclegu, przycięty tak, by nigdy nie wchodzić na rdzeń zmiany); bez jawnej luki (nocleg zaczyna się od razu w miejscu pracy) tej strefy nie ma. Karta nakładająca się WYŁĄCZNIE z buforem innego bloku (nie z jego zmianą) renderuje się w pół szerokości, wyrównana do prawej, nad tą strefą kreskowaną. Fix 4: same strefy dostają WŁASNY uchwyt przeciągania na swojej zewnętrznej krawędzi (sama góra strefy przed / sam dół strefy po) — zmienia długość bufora (`bufferBefore`/`bufferAfter`), niezależnie od uchwytu na granicy zmiany (ten zmienia `startTime`/`endTime`, bufor podąża za nim zachowując swoją długość); uchwyt bufora renderuje się tylko, gdy strefa ma niezerową wysokość.

Klik na dowolnej karcie (zmiana, nocleg, scalony bufor) bez przeciągnięcia ustawia ją jako "wyfokusowaną": WSZYSTKIE karty należące do tego samego bloku (każda instancja tygodniowa, plus jej scalone strefy bufora) dostają widoczny pierścień (`box-shadow` 2 px, `ring-offset-0`) w kolorze WŁASNEGO typu bloku — ta sama konwencja koloru co linie prowadzące niżej — nie tylko kliknięta karta. Przerywane linie prowadzące (`border-dashed`, kolor WŁASNEGO typu bloku — `{colors.work-block}`/`{colors.course-block}`/`{colors.personal-block}`/`{colors.overnight-block}`, nie neutralny kolor tekstu) rozciągają się od osi godzin do prawej krawędzi KOLUMNY DNIA wyfokusowanej karty (nie całego tygodnia), po jednej na każdą granicę karty — 2 (początek/koniec samej zmiany) albo 4, gdy karta ma sklejony bufor dojazdu i/lub odjazdu (start bufora-przed, start zmiany, koniec zmiany, koniec bufora-po) — każda z czytelną godziną w rynnie osi czasu po lewej, w tym samym kolorze (etykieta hugginguje treść zamiast stałej szerokości, żeby sąsiednie godziny się nie nakładały). Ustawienie "Znaczniki granic" w Ustawieniach (`/ustawienia`) przełącza tryb "wszystkie" (4 linie + etykiety) vs "skrajne" (TYLKO pierwsza i ostatnia granica — obwiednia karty — dostają linię ORAZ etykietę; dwie środkowe znikają całkowicie, nie tylko ich etykiety). Edycja NIE dokleja się już do karty jako pływający panel (decyzja użytkownika 2026-07-11) — zamiast tego sidebar PO PRAWEJ przełącza się w widok edycji: jego zwykła zawartość (statystyki/najbliższa zmiana/accordion) ustępuje miejsca nagłówkowi wyfokusowanego bloku (nazwa, typ, godziny, a gdy karta ma sklejony bufor — etykieta w tej samej podpisanej konwencji co karta na siatce plus dokładny zakres zegarowy, np. "−20 min · 07:40 (07:40–08:00)") nad od razu edytowalnym formularzem (nazwa, typ, godziny/dni tygodnia albo daty noclegu, bufory, cykliczny/jednorazowy, Zapisz/Usuń). Drugi klik na już wyfokusowanej karcie nic nie robi (sidebar już pokazuje edycję); klik na INNEJ karcie podmienia widok edycji na nowy blok bez zamykania; klik gdzie indziej na siatce, Escape, albo strzałka powrotu w prawym górnym rogu sidebara czyszczą focus i wracają do zwykłej zawartości. Bardzo krótkie karty (rdzeń poniżej 45 minut) tracą trzecią linię tekstu (typ) i dostają ciaśniejszy padding pionowy zamiast pełnego kompletu — pełne info i tak dostępne przez focus.

Blok cykliczny (bez konkretnej daty — powtarza się co tydzień "do odwołania") dostaje mały, niewypełniony `Repeat` (Lucide) w prawym górnym rogu karty, w kolorze tekstu typu (`*-block-text`); blok jednorazowy (przypięty do jednej daty) tej ikony nie ma. Ukryta na kartach zbyt krótkich, by cokolwiek zmieścić — ten sam próg co trzecia linia tekstu (poniżej 45 minut rdzenia).

## Components

Blok wydarzenia: pasek boczny w kolorze typu, nazwa + godziny wewnątrz. Karta backlogu: nazwa, czas trwania, kropka priorytetu, przycisk "Znajdź termin". Panel agenta: dymki czatu, ale rekomendacje terminów jako osobne klikalne karty z przyciskiem "Dodaj do kalendarza" (animacja pojawienia: fade + slide-up z transitions-dev). Panel zarobków: stawka godzinowa, dynamiczna lista pozycji, pogrubiona suma przeliczana live — bez przycisku "oblicz".

## Do's and Don'ts

- TAK: typ bloku oznaczaj kolorem ORAZ ikoną/etykietą (daltoniści).
- TAK: widoczny focus state na każdym elemencie interaktywnym; respektuj `prefers-reduced-motion` (transitions-dev robi to od razu).
- TAK: kontrast min. WCAG AA dla wszystkich kolorów bloków na tle.
- NIE: gradienty, ciężkie cienie, wypełnione kolorowe ikony.
- NIE: nowe kolory poza paletą — jeśli czegoś brakuje, najpierw zaktualizuj ten plik.
- NIE: animacje pisane ręcznie — tylko snippety transitions-dev.
