"use client";

import { useEffect, useRef, useState } from "react";
import { calculateFormEarnings, type LineItemInput } from "@/lib/earnings-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type LineItemRow = LineItemInput & { id: string };

// ponytail: crypto.randomUUID() jest wbudowane w przeglądarce — bez uuid z npm.
function newLineItem(): LineItemRow {
  return { id: crypto.randomUUID(), label: "", amount: 0 };
}

// Panel wpisu czasu pracy + zarobków (ticket 21). Suma przelicza się live przy
// każdej zmianie pola — bez przycisku "oblicz" — bo liczymy ją wprost z
// aktualnego stanu formularza na każdym renderze, nie w useEffect.
export function EarningsPanel() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [breakDuration, setBreakDuration] = useState(0);
  const [hourlyRate, setHourlyRate] = useState(32);
  const [lineItems, setLineItems] = useState<LineItemRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const revertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ponytail: brief "Zapisano" state na przycisku (3s), potem powrót do
  // "Zapisz" — zwykły setTimeout + cleanup, bez animacji (transitions-dev
  // niepotrzebny, bo nic się tu nie porusza, tylko podmiana tekstu/disabled).
  useEffect(() => () => {
    if (revertTimerRef.current) clearTimeout(revertTimerRef.current);
  }, []);

  const total = calculateFormEarnings({ start, end, breakDuration, hourlyRate, lineItems });

  function updateLineItem(id: string, patch: Partial<LineItemInput>) {
    setLineItems((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    setSaved(false);
  }

  function removeLineItem(id: string) {
    setLineItems((items) => items.filter((item) => item.id !== id));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start, end, breakDuration, hourlyRate }),
      });
      const entry = await res.json();
      await Promise.all(
        lineItems
          .filter((item) => item.label.trim() !== "")
          .map((item) =>
            fetch(`/api/entries/${entry.id}/line-items`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ label: item.label, amount: item.amount }),
            }),
          ),
      );
      setSaved(true);
      if (revertTimerRef.current) clearTimeout(revertTimerRef.current);
      revertTimerRef.current = setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="w-full max-w-xl rounded-lg border border-border bg-surface">
      <CardHeader>
        <CardTitle className="text-h3 font-h3 font-semibold text-text-primary">
          Wpis czasu pracy
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="entry-start" className="text-body text-text-secondary">
              Start
            </Label>
            <Input
              id="entry-start"
              type="datetime-local"
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                setSaved(false);
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="entry-end" className="text-body text-text-secondary">
              Koniec
            </Label>
            <Input
              id="entry-end"
              type="datetime-local"
              value={end}
              onChange={(e) => {
                setEnd(e.target.value);
                setSaved(false);
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="entry-break" className="text-body text-text-secondary">
              Przerwa (min)
            </Label>
            <Input
              id="entry-break"
              type="number"
              min={0}
              value={breakDuration}
              onChange={(e) => {
                setBreakDuration(Number(e.target.value));
                setSaved(false);
              }}
              className="tabular-nums"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="entry-rate" className="text-body text-text-secondary">
              Stawka (PLN/h)
            </Label>
            <Input
              id="entry-rate"
              type="number"
              min={0}
              step="0.01"
              value={hourlyRate}
              onChange={(e) => {
                setHourlyRate(Number(e.target.value));
                setSaved(false);
              }}
              className="tabular-nums"
            />
          </div>
        </div>

        <div>
          <h3 className="text-body font-medium text-text-secondary">Pozycje</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {lineItems.map((item) => (
              <li key={item.id} className="flex items-center gap-2">
                <Input
                  type="text"
                  placeholder="Nazwa (np. Nadgodziny)"
                  value={item.label}
                  onChange={(e) => updateLineItem(item.id, { label: e.target.value })}
                  className="flex-1"
                />
                <Input
                  type="number"
                  step="0.01"
                  value={item.amount}
                  onChange={(e) => updateLineItem(item.id, { amount: Number(e.target.value) })}
                  className="w-28 tabular-nums"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeLineItem(item.id)}
                  aria-label={`Usuń pozycję ${item.label || ""}`.trim()}
                  className="text-danger"
                >
                  Usuń
                </Button>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLineItems((items) => [...items, newLineItem()])}
            className="mt-2"
          >
            + Dodaj pozycję
          </Button>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <span className="text-body-large font-semibold text-text-primary">Suma</span>
          <span className="tabular-nums text-numeric font-numeric font-medium text-h3 text-text-primary">
            {total.toFixed(2)} PLN
          </span>
        </div>
      </CardContent>

      <CardFooter className="border-t-0 bg-transparent pt-0">
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving || !start || !end}
          className="w-full"
        >
          {saving ? "Zapisywanie…" : saved ? "Zapisano" : "Zapisz"}
        </Button>
      </CardFooter>
    </Card>
  );
}
