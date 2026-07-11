"use client";

import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatSlotLabel, type Slot } from "@/lib/agent-panel";
import styles from "./ChatWidget.module.css";

export type ChatMessage =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "agent"; text: string; slots: Slot[] }
  | { id: string; role: "error"; text: string };

function slotKey(messageId: string, index: number): string {
  return `${messageId}:${index}`;
}

// Lista dymków rozmowy + karty sugestii terminów. Wydzielone z ChatWidget,
// żeby stan (persist do localStorage, model selector, fetch) i prezentacja
// nie siedziały w jednym pliku.
export function ChatMessages({
  messages,
  loading,
  addedSlots,
  onAddToCalendar,
}: {
  messages: ChatMessage[];
  loading: boolean;
  addedSlots: Set<string>;
  onAddToCalendar: (key: string, slot: Slot) => void;
}) {
  return (
    <>
      {messages.length === 0 && !loading && (
        <p className="text-body text-text-secondary">
          Zapytaj o wolny termin, np. „znajdź mi 2h na kurs w przyszłym tygodniu”.
        </p>
      )}

      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex flex-col gap-2 ${msg.role === "user" ? "items-end" : "items-start"}`}
        >
          <div
            className={`max-w-[90%] rounded-sm px-3 py-2 text-body ${
              msg.role === "error" ? "bg-bg-primary text-danger" : "bg-bg-primary text-text-primary"
            }`}
          >
            {msg.text}
          </div>

          {msg.role === "agent" &&
            msg.slots.map((slot, index) => {
              const key = slotKey(msg.id, index);
              const added = addedSlots.has(key);
              const style = { "--card-reveal-index": index } as CSSProperties;
              return (
                <div
                  key={key}
                  className={`${styles.suggestionCard} w-[90%] rounded-lg border border-border bg-bg-primary px-3 py-2`}
                  style={style}
                >
                  <div className="tabular-nums text-body text-text-primary">{formatSlotLabel(slot)}</div>
                  <Button
                    type="button"
                    size="sm"
                    variant={added ? "secondary" : "default"}
                    disabled={added}
                    onClick={() => onAddToCalendar(key, slot)}
                    className="mt-2"
                  >
                    {added ? "✓ Dodano" : "Dodaj do kalendarza"}
                  </Button>
                </div>
              );
            })}
        </div>
      ))}

      {loading && (
        <div className="flex items-start">
          <div
            className="flex items-center gap-1 rounded-sm bg-bg-primary px-3 py-2"
            role="status"
            aria-label="Agent odpowiada…"
          >
            <Skeleton className="h-2 w-2 rounded-full motion-reduce:animate-none" />
            <Skeleton className="h-2 w-2 rounded-full motion-reduce:animate-none [animation-delay:150ms]" />
            <Skeleton className="h-2 w-2 rounded-full motion-reduce:animate-none [animation-delay:300ms]" />
          </div>
        </div>
      )}
    </>
  );
}
