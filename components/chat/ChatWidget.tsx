"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { slotToBlockBody, type Slot } from "@/lib/agent-panel";
import { ChatMessages, type ChatMessage } from "./ChatMessages";
import styles from "./ChatWidget.module.css";

type AgentModel = { id: string; label: string; provider: "claude" | "gemini" };
type HistoryEntry = { role: "user" | "assistant"; content: string };

const MESSAGES_KEY = "chatWidget.messages";
const MODEL_KEY = "chatWidget.model";

function uid(): string {
  return Math.random().toString(36).slice(2);
}

function loadMessages(): ChatMessage[] {
  try {
    const raw = window.localStorage.getItem(MESSAGES_KEY);
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    // ponytail: localStorage uszkodzony/niedostępny (tryb prywatny) → start
    // od pustej rozmowy, bez dodatkowego stanu błędu.
    return [];
  }
}

function toHistory(messages: ChatMessage[]): HistoryEntry[] {
  return messages
    .filter((m): m is Extract<ChatMessage, { role: "user" | "agent" }> => m.role !== "error")
    .map((m) => ({ role: m.role === "agent" ? ("assistant" as const) : ("user" as const), content: m.text }));
}

// Dymek czatu AI (Intercom/Cal.com-help-button): pływający przycisk widoczny
// globalnie (montowany w AppShell) + panel rozmowy nad nim. Widget zostaje
// zamontowany cały czas (panel tylko chowany animacją) i persystuje rozmowę
// w localStorage, więc zamknięcie dymka nie gubi kontekstu. Wcielenie i
// rozbudowa dawnego components/agent/AgentPanel.tsx (dymki, karty sugestii,
// "Dodaj do kalendarza") o multi-turn + wybór providera (Claude/Gemini).
export function ChatWidget() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [addedSlots, setAddedSlots] = useState<Set<string>>(new Set());
  const [models, setModels] = useState<AgentModel[]>([]);
  const [selectedModel, setSelectedModel] = useState("");

  // localStorage nie istnieje podczas SSR — wczytanie odkłada się do efektu
  // po montażu, `hydrated` blokuje zapis wstecz zanim odczyt się wykona.
  // Świadomie setState w efekcie: to jedyny bezpieczny moment (po montażu)
  // na odczyt danych przeglądarki bez ryzyka mismatchu SSR.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setMessages(loadMessages());
    setSelectedModel(window.localStorage.getItem(MODEL_KEY) ?? "");
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
  }, [messages, hydrated]);

  useEffect(() => {
    if (!hydrated || !selectedModel) return;
    window.localStorage.setItem(MODEL_KEY, selectedModel);
  }, [selectedModel, hydrated]);

  useEffect(() => {
    fetch("/api/agent/models")
      .then((res) => res.json())
      .then((data: AgentModel[]) => setModels(data))
      // ponytail: brak modeli aktywnych = pusta lista, sam UI już to obsługuje
      // komunikatem "Dodaj klucz API…" — błąd sieci traktujemy tak samo.
      .catch(() => {});
  }, []);

  // Model z localStorage może być nieaktywny (klucz usunięty) — wartość
  // efektywna spada na pierwszy aktywny model zamiast trzymać osobny stan
  // synchronizowany efektem (setSelectedModel woła tylko wybór użytkownika
  // i wczytanie z localStorage powyżej).
  const effectiveModel = useMemo(
    () => (models.some((m) => m.id === selectedModel) ? selectedModel : (models[0]?.id ?? "")),
    [models, selectedModel],
  );

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message || loading) return;

    const history = toHistory(messages);
    setMessages((m) => [...m, { id: uid(), role: "user", text: message }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history, model: effectiveModel || undefined }),
      });
      if (!res.ok) throw new Error(`agent request failed: ${res.status}`);
      const data: { answer?: string; slots?: Slot[] } = await res.json();
      setMessages((m) => [
        ...m,
        { id: uid(), role: "agent", text: data.answer ?? "", slots: data.slots ?? [] },
      ]);
    } catch {
      // ponytail: jeden ogólny komunikat błędu, tak jak w dawnym AgentPanel —
      // ticket wymaga tylko "gracious" obsługi, nie rozróżniania przyczyn.
      setMessages((m) => [
        ...m,
        {
          id: uid(),
          role: "error",
          text: "Nie udało się połączyć z agentem. Spróbuj ponownie za chwilę.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddToCalendar(key: string, slot: Slot) {
    try {
      const res = await fetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slotToBlockBody(slot)),
      });
      if (!res.ok) throw new Error(`create block failed: ${res.status}`);
      setAddedSlots((s) => new Set(s).add(key));
      router.refresh();
    } catch {
      // ponytail: brak osobnego stanu błędu per-karta — przycisk zostaje
      // klikalny, użytkownik może po prostu spróbować ponownie.
    }
  }

  function handleClear() {
    setMessages([]);
    setAddedSlots(new Set());
  }

  const noActiveModels = hydrated && models.length === 0;

  return (
    <>
      {/* Fix 4: dymek siedział na stałe w prawym-dolnym rogu VIEWPORTU — od
          przeniesienia sidebara plannera na prawą stronę zasłaniał go w
          strefie edycji. `${styles.floatingAnchor}` przesuwa oba elementy w
          lewo o szerokość TEGO konkretnego sidebara (custom property
          ustawiana przez PlannerSidebar, patrz tam) — na stronach bez tego
          sidebara zmienna jest nieustawiona, więc offset wraca do 0 (zwykły
          prawy dół viewportu, jak dawniej). Dymek zostaje zamontowany
          globalnie w AppShell (widoczny na każdej stronie) — przeniesienie go
          do drzewa plannera zdjęłoby go z pozostałych stron. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Zamknij czat asystenta" : "Otwórz czat asystenta"}
        aria-expanded={open}
        className={`${styles.floatingAnchor} fixed bottom-6 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-border bg-bg-secondary text-text-primary shadow-lg`}
      >
        <MessageCircle className="h-6 w-6" aria-hidden />
      </button>

      <div
        data-open={open}
        className={`${styles.panel} ${styles.floatingAnchor} fixed bottom-24 z-50 flex h-[560px] w-[380px] flex-col overflow-hidden rounded-xl border border-border bg-bg-secondary`}
      >
        <div className="flex flex-col gap-2 border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-body-large font-medium text-text-primary">Asystent</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Zamknij"
              className="text-text-secondary hover:text-text-primary"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div className="flex items-center justify-between gap-2">
            {models.length > 0 ? (
              <Select value={effectiveModel} onValueChange={(value) => setSelectedModel(value as string)}>
                <SelectTrigger size="sm" aria-label="Model" className="flex-1">
                  <SelectValue placeholder="Model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="text-caption font-caption text-text-secondary">Brak aktywnego modelu</span>
            )}
            <button
              type="button"
              onClick={handleClear}
              className="shrink-0 text-caption font-caption text-text-secondary hover:text-text-primary"
            >
              Wyczyść rozmowę
            </button>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-3" aria-live="polite">
          {noActiveModels && (
            <p className="text-body text-text-secondary">
              Dodaj klucz API w .env (ANTHROPIC_API_KEY lub GEMINI_API_KEY), żeby porozmawiać z agentem.
            </p>
          )}
          <ChatMessages
            messages={messages}
            loading={loading}
            addedSlots={addedSlots}
            onAddToCalendar={handleAddToCalendar}
          />
        </div>

        <form onSubmit={handleSend} className="flex gap-2 border-t border-border px-4 py-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Zapytaj agenta o wolny termin…"
            aria-label="Zapytaj agenta"
            disabled={loading || noActiveModels}
          />
          <Button type="submit" size="sm" disabled={loading || !input.trim() || noActiveModels}>
            Wyślij
          </Button>
        </form>
      </div>
    </>
  );
}
