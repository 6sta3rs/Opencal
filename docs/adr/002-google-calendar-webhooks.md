# ADR-002: Google Calendar sync — webhooks zamiast pollingu

**Status:** Accepted
**Data:** 2026-07-09
**Decydent:** Paweł (właściciel projektu), potwierdzone 2026-07-09

## Kontekst

Silnik gap-finding potrzebuje aktualnej zajętości z Google Calendar (sekcja 2.5 specyfikacji: dwukierunkowy sync). Zmiana w kalendarzu Google musi być widoczna w aplikacji szybko — nieaktualna zajętość oznacza błędne rekomendacje agenta ("wolne okno", które już jest zajęte). Aplikacja w fazie developmentu działa lokalnie (localhost), a Google push notifications wymagają publicznego HTTPS URL.

## Decyzja

**Webhooks (Google Calendar push notifications, `events.watch`) + tunel Ngrok w developmencie.** Nie polling.

## Rozważane opcje

### Opcja A: Webhooks przez tunel Ngrok

| Wymiar | Ocena |
|---|---|
| Złożoność | Średnia — kanał watch trzeba odnawiać (wygasa), Ngrok w dev |
| Koszt | Zerowy (Ngrok free tier wystarcza dla 1 dev) |
| Aktualność danych | Sekundy — natychmiastowy push przy zmianie |
| Limity API | Minimalne zużycie quoty — żądania tylko przy realnych zmianach |

**Plusy:** dane zawsze świeże, brak marnowania quoty, wzorzec identyczny jak dla webhooków Cal.com (jedna architektura odbioru zdarzeń).
**Minusy:** kanały watch wygasają (konieczne odnawianie), w dev wymagany tunel; URL Ngrok zmienia się przy restarcie (chyba że płatna stała domena).

### Opcja B: Polling (odpytywanie co N minut)

| Wymiar | Ocena |
|---|---|
| Złożoność | Niska — cron w n8n |
| Koszt | Zerowy |
| Aktualność danych | Opóźnienie do N minut — stale nieaktualne okno |
| Limity API | Ciągłe zużycie quoty niezależnie od zmian |

**Plusy:** prostsze, działa bez publicznego URL.
**Minusy:** rekomendacje agenta oparte o dane sprzed N minut; marnotrawstwo quoty; i tak trzeba obsłużyć sync tokeny.

## Analiza trade-offów

Polling jest prostszy, ale psuje kluczową wartość produktu: wiarygodność wolnych okien. Koszt webhooków (odnawianie kanału + Ngrok) jest jednorazowy i dobrze udokumentowany. Dodatkowo Cal.com i tak wymaga webhooków (booking.created/cancelled) — odbiornik zdarzeń powstaje raz, obsłuży oba źródła.

## Konsekwencje

- Łatwiej: świeża zajętość, wspólny wzorzec webhook dla GCal i Cal.com, niskie zużycie API.
- Trudniej: dev wymaga uruchomionego tunelu Ngrok; trzeba zaimplementować odnawianie kanału watch (np. cron w n8n) i incremental sync po powiadomieniu (`syncToken`).
- Do rewizji: na produkcji (Vercel) tunel znika — webhook dostaje stały publiczny URL; fallback pełnej resynchronizacji przy utraconym `syncToken` obowiązkowy.
