"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildQuickCreateBody, type DragRangeDraft } from "@/lib/planner-grid";

const TYPE_OPTIONS = [
  { value: "work", label: "Praca" },
  { value: "course", label: "Kurs" },
  { value: "personal", label: "Prywatne" },
  { value: "overnight", label: "Nocleg" },
];

// Mały, samodzielny popover (nie AddBlockModal — ten należy do innego agenta).
// Pozycjonowany absolutnie w miejscu, gdzie użytkownik puścił przeciąganie;
// zamyka się na Escape i kliknięcie poza sobą, jak modal, ale bez pełnego
// Dialog — to tylko szybki formularz "nazwa + typ + powtarzanie".
export function QuickCreatePopover({
  draft,
  position,
  onClose,
}: {
  draft: DragRangeDraft;
  position: { top: number; left: number };
  onClose: () => void;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("work");
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Element;
      // Lista rozwijana Selecta renderuje się w portalu na document.body —
      // klik w opcję jest technicznie "poza" popoverem, ale nie może go zamykać.
      if (target.closest?.('[data-slot="select-content"]')) return;
      if (ref.current && !ref.current.contains(target)) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Nazwa jest wymagana.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildQuickCreateBody({
            name: name.trim(),
            type,
            repeatWeekly,
            date: draft.date,
            dayOfWeek: draft.dayOfWeek,
            startTime: draft.startTime,
            endTime: draft.endTime,
          }),
        ),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Nie udało się zapisać bloku.");
        setSubmitting(false);
        return;
      }
    } catch {
      setError("Nie udało się zapisać bloku. Sprawdź połączenie.");
      setSubmitting(false);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div
      ref={ref}
      // Fix 2 (z-index): z-40 (było z-20) — musi renderować się NAD kartami
      // (z-10/z-20) i nad łącznikiem "teraz"/liniami focusa (z-10, patrz
      // PlannerGrid), ale pod sticky nagłówkami dnia/osi (z-50), które mają
      // maskować wszystko, co przewinie się pod nie.
      className="absolute z-40"
      style={{ top: position.top, left: position.left }}
      // Kolumna dnia nasłuchuje pointerdown/up do rysowania nowych bloków —
      // bez stopPropagation kliknięcie w pole formularza startowałoby nowe
      // przeciąganie i podmieniało ten popover w trakcie wypełniania.
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <Card className="w-64">
        {/* Card daje gap/padding swoim BEZPOŚREDNIM dzieciom (flex-col) — form
            jako jedyne dziecko przerywa ten układ, więc odtwarzamy go tutaj. */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <CardHeader>
            <CardTitle>
              Nowy blok · {draft.startTime}–{draft.endTime}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quick-create-name">Nazwa</Label>
              <Input
                id="quick-create-name"
                autoFocus
                value={name}
                aria-invalid={!!error}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quick-create-type">Typ</Label>
              <Select value={type} onValueChange={(value) => setType(value as string)}>
                <SelectTrigger id="quick-create-type" className="w-full">
                  {/* Jawna etykieta: bez children SelectValue pokazuje surową
                      wartość ("work"), nie polską etykietę. */}
                  <SelectValue>{TYPE_OPTIONS.find((o) => o.value === type)?.label}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Label className="text-body text-text-primary">
              <Checkbox checked={repeatWeekly} onCheckedChange={(checked) => setRepeatWeekly(checked === true)} />
              Powtarzaj co tydzień
            </Label>
            {error && (
              <p className="text-caption font-caption text-danger" role="alert">
                {error}
              </p>
            )}
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Anuluj
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "Zapisywanie…" : "Zapisz"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
