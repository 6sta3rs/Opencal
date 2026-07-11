"use client";

import { useEffect, useRef, useState } from "react";
import { Globe, MoreHorizontal } from "lucide-react";
import { formatAvailabilitySummary, type AvailabilityDay } from "@/lib/availability";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

const DAY_LABELS: Record<number, string> = {
  1: "Poniedziałek",
  2: "Wtorek",
  3: "Środa",
  4: "Czwartek",
  5: "Piątek",
  6: "Sobota",
  0: "Niedziela",
};

// Karta "Godziny pracy" w stylu Cal.com: domyślnie zwinięte podsumowanie
// (nazwa, badge, zakres godzin, strefa czasowa), klik "Edytuj" rozwija
// istniejący edytor dnia po dniu poniżej. Client-side fetch zamiast server
// component, żeby ominąć znany caveat stale Prisma clienta na dev serwerze
// po świeżej migracji (patrz AGENTS/instrukcja integratora).
export function AvailabilityForm() {
  const [days, setDays] = useState<AvailabilityDay[] | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const revertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/availability")
      .then((res) => res.json())
      .then(setDays);
  }, []);

  useEffect(
    () => () => {
      if (revertTimerRef.current) clearTimeout(revertTimerRef.current);
    },
    [],
  );

  function updateDay(dayOfWeek: number, patch: Partial<AvailabilityDay>) {
    setDays((current) =>
      current?.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d)) ?? current,
    );
    setSaved(false);
  }

  async function handleSave() {
    if (!days) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(days),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error);
        return;
      }
      setDays(body);
      setSaved(true);
      if (revertTimerRef.current) clearTimeout(revertTimerRef.current);
      revertTimerRef.current = setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  if (!days) {
    return (
      <Card className="w-full max-w-xl rounded-lg border border-border bg-surface">
        <CardContent>
          <p className="text-body text-text-secondary">Ładowanie…</p>
        </CardContent>
      </Card>
    );
  }

  // Strefa czasowa przeglądarki: bezpieczne bez osobnej bramki montażu — ta
  // gałąź renderuje się dopiero po tym, jak powyższy fetch ustawi `days`
  // (efekt uruchamia się tylko po stronie klienta), więc SSR nigdy jej nie
  // wyrenderuje i nie ma rozjazdu hydratacji.
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <Card className="w-full max-w-xl rounded-lg border border-border bg-surface">
      <CardHeader className="gap-3">
        <CardTitle className="flex items-center gap-2 text-h3 font-h3 font-semibold text-text-primary">
          Godziny pracy
          <Badge className="border-transparent bg-personal-block/10 text-personal-block">Domyślny</Badge>
        </CardTitle>
        <CardAction>
          <Button type="button" variant="ghost" size="icon" aria-label="Więcej opcji" disabled>
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </Button>
        </CardAction>

        <p className="text-body text-text-secondary">{formatAvailabilitySummary(days)}</p>
        <p className="flex items-center gap-2 text-caption font-caption text-text-secondary">
          <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {timezone}
        </p>
      </CardHeader>

      {!expanded ? (
        <CardFooter className="border-t-0 bg-transparent pt-0">
          <Button type="button" variant="outline" onClick={() => setExpanded(true)} className="w-full">
            Edytuj
          </Button>
        </CardFooter>
      ) : (
        <>
          <CardContent className="flex flex-col gap-4 border-t border-border pt-4">
            {error && <p className="text-caption font-caption text-danger">{error}</p>}

            <ul className="flex flex-col gap-3">
              {days.map((day) => (
                <li key={day.dayOfWeek} className="flex items-center gap-4">
                  <div className="flex w-40 shrink-0 items-center gap-3">
                    <Switch
                      checked={day.enabled}
                      onCheckedChange={(enabled) => updateDay(day.dayOfWeek, { enabled })}
                      aria-label={`Włącz ${DAY_LABELS[day.dayOfWeek]}`}
                    />
                    <span className="text-body text-text-primary">{DAY_LABELS[day.dayOfWeek]}</span>
                  </div>

                  {day.enabled ? (
                    <div className="flex flex-1 items-center gap-2">
                      <Input
                        type="time"
                        value={day.startTime}
                        onChange={(e) => updateDay(day.dayOfWeek, { startTime: e.target.value })}
                        className="tabular-nums"
                        aria-label={`Godzina rozpoczęcia — ${DAY_LABELS[day.dayOfWeek]}`}
                      />
                      <span className="text-text-secondary">–</span>
                      <Input
                        type="time"
                        value={day.endTime}
                        onChange={(e) => updateDay(day.dayOfWeek, { endTime: e.target.value })}
                        className="tabular-nums"
                        aria-label={`Godzina zakończenia — ${DAY_LABELS[day.dayOfWeek]}`}
                      />
                    </div>
                  ) : (
                    <span className="flex-1 text-body text-text-secondary">Niedostępne</span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>

          <CardFooter className="gap-2 border-t-0 bg-transparent pt-0">
            <Button type="button" variant="outline" onClick={() => setExpanded(false)} className="flex-1">
              Wróć
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? "Zapisywanie…" : saved ? "Zapisano" : "Zapisz"}
            </Button>
          </CardFooter>
        </>
      )}
    </Card>
  );
}
