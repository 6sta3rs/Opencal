# 09 — Google Calendar webhooks (Ngrok)

**Rozmiar:** M · **Typ:** AFK · **Blokowany przez:** 08

## Co zbudować

Push notifications (`events.watch`) zgodnie z ADR-002: endpoint webhook, tunel Ngrok w dev, incremental sync po powiadomieniu (`syncToken`), odnawianie kanału watch.

## Kryteria akceptacji

- [ ] Zmiana eventu w Google Calendar aktualizuje zajętość bez restartu aplikacji
- [ ] Utracony `syncToken` → pełna resynchronizacja (fallback)
- [ ] Wygasający kanał watch jest odnawiany automatycznie
