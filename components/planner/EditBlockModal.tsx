"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { validateBlockForm, validateOvernightRangeForm, type BlockFormErrors } from "@/lib/block-form-validation";
import type { PlannerBlock } from "@/lib/planner-grid";

const DAY_OPTIONS = [
  { value: 1, label: "Pon" },
  { value: 2, label: "Wt" },
  { value: 3, label: "Śr" },
  { value: 4, label: "Czw" },
  { value: 5, label: "Pt" },
  { value: 6, label: "Sob" },
  { value: 0, label: "Niedz" },
];

const TYPE_OPTIONS = [
  { value: "work", label: "Praca" },
  { value: "course", label: "Kurs" },
  { value: "personal", label: "Prywatne" },
  { value: "overnight", label: "Nocleg" },
];

type FormState = {
  name: string;
  type: string;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  bufferBefore: string;
  bufferAfter: string;
  staysOvernight: boolean;
  overnightStart: string;
  departureTime: string;
};

function toDatetimeLocal(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const EMPTY_FORM: FormState = {
  name: "",
  type: "work",
  startTime: "",
  endTime: "",
  daysOfWeek: [],
  bufferBefore: "0",
  bufferAfter: "0",
  staysOvernight: false,
  overnightStart: "",
  departureTime: "",
};

// Fix 2b: typ "overnight" (jednorazowy nocleg wielodniowy) używa pól
// overnightStart/departureTime jako "Start"/"Koniec" (DateTimePicker niżej)
// zamiast dni tygodnia + jedna para godzin — te dwa helpery
// rozkładają/składają "YYYY-MM-DDTHH:MM".
function dateOnlyIsoMidnight(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toISOString();
}

/** Dzień z `date` (ignorując jego własną godzinę — startDate jest zapisywany o północy) + osobno podana godzina HH:MM. */
function combineDateOnlyAndTime(date: Date | string | null | undefined, time: string): string {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${time}`;
}

function formStateFromBlock(block: PlannerBlock): FormState {
  return {
    name: block.name,
    type: block.type,
    startTime: block.startTime,
    endTime: block.endTime,
    daysOfWeek: block.daysOfWeek,
    bufferBefore: String(block.bufferBefore ?? 0),
    bufferAfter: String(block.bufferAfter ?? 0),
    staysOvernight: block.staysOvernight ?? false,
    overnightStart:
      block.type === "overnight" ? combineDateOnlyAndTime(block.startDate, block.startTime) : toDatetimeLocal(block.overnightStart),
    departureTime: toDatetimeLocal(block.departureTime),
  };
}

// Bliźniaczy formularz do AddBlockModal (inny agent nim nie zarządza — ten
// jest nowy, mój), ale PATCH zamiast POST i prefill z istniejącego bloku.
// Bez animacji shake — walidacja tu jest prosta i rzadko odpalana (pola już
// wypełnione), transitions-dev nieużyty żeby nie duplikować logiki na sztywno.
export function EditBlockModal({ block, onClose }: { block: PlannerBlock | null; onClose: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => (block ? formStateFromBlock(block) : EMPTY_FORM));
  const [errors, setErrors] = useState<BlockFormErrors>({});
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [openForBlockId, setOpenForBlockId] = useState<string | null>(null);
  if (block && block.id !== openForBlockId) {
    setOpenForBlockId(block.id);
    setForm(formStateFromBlock(block));
    setErrors({});
    setBannerError(null);
    setConfirmingDelete(false);
  } else if (!block && openForBlockId !== null) {
    setOpenForBlockId(null);
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (Object.keys(errors).length > 0 || bannerError) {
      setErrors({});
      setBannerError(null);
    }
  }

  function toggleDay(day: number) {
    updateField(
      "daysOfWeek",
      form.daysOfWeek.includes(day) ? form.daysOfWeek.filter((d) => d !== day) : [...form.daysOfWeek, day],
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!block) return;

    let body: Record<string, unknown>;

    if (form.type === "overnight") {
      // Fix 2b: jednorazowy, wielodniowy nocleg — Start/Koniec (data+godzina)
      // zamiast dni tygodnia + jedna para godzin, patrz AddBlockModal.
      const startDateObj = form.overnightStart ? new Date(form.overnightStart) : null;
      const endDateObj = form.departureTime ? new Date(form.departureTime) : null;
      const validationErrors = validateOvernightRangeForm({
        name: form.name,
        startDate: startDateObj,
        startTime: form.overnightStart.slice(11, 16),
        endDate: endDateObj,
        endTime: form.departureTime.slice(11, 16),
      });
      if (Object.keys(validationErrors).length > 0) {
        setErrors({ name: validationErrors.name });
        setBannerError([...new Set(Object.values(validationErrors))].join(" "));
        return;
      }

      const startDateKey = form.overnightStart.slice(0, 10);
      body = {
        name: form.name.trim(),
        type: "overnight",
        startDate: dateOnlyIsoMidnight(startDateKey),
        endDate: dateOnlyIsoMidnight(startDateKey),
        daysOfWeek: [startDateObj!.getDay()],
        startTime: form.overnightStart.slice(11, 16),
        endTime: form.departureTime.slice(11, 16),
        staysOvernight: true,
        departureTime: endDateObj!.toISOString(),
        overnightStart: null,
        bufferBefore: Number(form.bufferBefore) || 0,
        bufferAfter: Number(form.bufferAfter) || 0,
      };
    } else {
      const validationErrors = validateBlockForm({
        name: form.name,
        startTime: form.startTime,
        endTime: form.endTime,
        daysOfWeek: form.daysOfWeek,
      });
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        setBannerError([...new Set(Object.values(validationErrors))].join(" "));
        return;
      }

      body = {
        name: form.name.trim(),
        type: form.type,
        startTime: form.startTime,
        endTime: form.endTime,
        daysOfWeek: form.daysOfWeek,
        bufferBefore: Number(form.bufferBefore) || 0,
        bufferAfter: Number(form.bufferAfter) || 0,
        staysOvernight: form.staysOvernight,
        overnightStart:
          form.staysOvernight && form.overnightStart ? new Date(form.overnightStart).toISOString() : null,
        departureTime:
          form.staysOvernight && form.departureTime ? new Date(form.departureTime).toISOString() : null,
      };
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/blocks/${block.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setBannerError(data.error ?? "Nie udało się zapisać zmian.");
        setSubmitting(false);
        return;
      }
    } catch {
      setBannerError("Nie udało się zapisać zmian. Sprawdź połączenie.");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    onClose();
    router.refresh();
  }

  async function handleDelete() {
    if (!block) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/blocks/${block.id}`, { method: "DELETE" });
      if (!res.ok) {
        setBannerError("Nie udało się usunąć bloku.");
        setDeleting(false);
        return;
      }
    } catch {
      setBannerError("Nie udało się usunąć bloku. Sprawdź połączenie.");
      setDeleting(false);
      return;
    }
    setDeleting(false);
    onClose();
    router.refresh();
  }

  return (
    <Dialog
      open={!!block}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        // Fix 6: patrz komentarz w AddBlockModal — "sm:max-w-sm" z bazowego
        // DialogContent wygrywa nad samym "max-w-lg" od 640px w górę, stąd
        // jawny "sm:max-w-lg" obok.
        className={`${form.type === "overnight" ? "max-w-lg sm:max-w-lg" : "max-w-md"} motion-reduce:animation-duration-0`}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Edytuj blok</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-block-name">Nazwa</Label>
            <Input
              id="edit-block-name"
              autoFocus
              aria-invalid={!!errors.name}
              value={form.name}
              onChange={(e: ChangeEvent<HTMLInputElement>) => updateField("name", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-block-type">Typ</Label>
            <Select value={form.type} onValueChange={(value) => updateField("type", value as string)}>
              <SelectTrigger id="edit-block-type" className="w-full">
                {/* Jawna etykieta: bez children SelectValue pokazuje surową wartość ("work"). */}
                <SelectValue>{TYPE_OPTIONS.find((o) => o.value === form.type)?.label}</SelectValue>
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

          {form.type !== "overnight" && (
            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="edit-block-start">Początek</Label>
                <Input
                  id="edit-block-start"
                  type="time"
                  aria-invalid={!!errors.startTime}
                  value={form.startTime}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => updateField("startTime", e.target.value)}
                />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="edit-block-end">Koniec</Label>
                <Input
                  id="edit-block-end"
                  type="time"
                  aria-invalid={!!errors.endTime}
                  value={form.endTime}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => updateField("endTime", e.target.value)}
                />
              </div>
            </div>
          )}

          {form.type !== "overnight" && (
            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-sm font-medium text-text-primary">Dni tygodnia</legend>
              <div className="flex flex-wrap gap-2">
                {DAY_OPTIONS.map((day) => {
                  const selected = form.daysOfWeek.includes(day.value);
                  return (
                    <Button
                      key={day.value}
                      type="button"
                      size="sm"
                      variant={selected ? "default" : "outline"}
                      aria-pressed={selected}
                      className={!selected && errors.daysOfWeek ? "border-danger" : undefined}
                      onClick={() => toggleDay(day.value)}
                    >
                      {day.label}
                    </Button>
                  );
                })}
              </div>
            </fieldset>
          )}

          {form.type === "overnight" && (
            // Fix 6: patrz komentarz w AddBlockModal — stack pionowy pod sm,
            // rząd od sm w górę, żeby Popover-trigger + Input czasu nie
            // wychodziły poza modal na wąskich szerokościach.
            <div className="flex flex-col gap-3 sm:flex-row">
              <DateTimePicker
                label="Start"
                value={form.overnightStart}
                onChange={(next) => updateField("overnightStart", next)}
              />
              <DateTimePicker
                label="Koniec"
                value={form.departureTime}
                onChange={(next) => updateField("departureTime", next)}
              />
            </div>
          )}

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="edit-block-buffer-before">Bufor przed (min)</Label>
              <Input
                id="edit-block-buffer-before"
                type="number"
                min={0}
                value={form.bufferBefore}
                onChange={(e: ChangeEvent<HTMLInputElement>) => updateField("bufferBefore", e.target.value)}
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="edit-block-buffer-after">Bufor po (min)</Label>
              <Input
                id="edit-block-buffer-after"
                type="number"
                min={0}
                value={form.bufferAfter}
                onChange={(e: ChangeEvent<HTMLInputElement>) => updateField("bufferAfter", e.target.value)}
              />
            </div>
          </div>

          {form.type !== "overnight" && (
            <>
              <Label className="text-body text-text-primary">
                <Checkbox
                  checked={form.staysOvernight}
                  onCheckedChange={(checked) => updateField("staysOvernight", checked === true)}
                />
                Nocleg w pracy
              </Label>

              {form.staysOvernight && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="edit-block-overnight-start">Początek noclegu (opcjonalnie)</Label>
                    <Input
                      id="edit-block-overnight-start"
                      type="datetime-local"
                      value={form.overnightStart}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => updateField("overnightStart", e.target.value)}
                    />
                    <span className="text-caption font-caption text-text-secondary">
                      Domyślnie zaraz po zakończeniu zmiany — ustaw, jeśli między końcem zmiany a noclegiem jest przerwa.
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="edit-block-departure">Wyjazd (data i godzina)</Label>
                    <Input
                      id="edit-block-departure"
                      type="datetime-local"
                      value={form.departureTime}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => updateField("departureTime", e.target.value)}
                    />
                  </div>
                </>
              )}
            </>
          )}

          {bannerError && (
            <p className="text-caption font-caption text-danger" role="alert">
              {bannerError}
            </p>
          )}

          <DialogFooter className="sm:justify-between">
            {confirmingDelete ? (
              <div className="flex flex-1 items-center justify-between gap-2">
                <span className="text-caption font-caption text-danger">Usunąć ten blok na stałe?</span>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
                    Nie
                  </Button>
                  <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
                    {deleting ? "Usuwanie…" : "Tak, usuń"}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <Button type="button" variant="destructive" onClick={() => setConfirmingDelete(true)}>
                  Usuń
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={onClose}>
                    Anuluj
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Zapisywanie…" : "Zapisz"}
                  </Button>
                </div>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Fix 2b: bliźniaczy DateTimePicker do AddBlockModal — patrz komentarz tam.
function DateTimePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const datePart = value.slice(0, 10);
  const timePart = value.slice(11, 16) || "00:00";
  const selectedDate = datePart ? new Date(`${datePart}T00:00:00`) : undefined;

  function setDate(date: Date | undefined) {
    if (!date) return;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    onChange(`${y}-${m}-${d}T${timePart}`);
  }

  function setTime(time: string) {
    if (!datePart) return;
    onChange(`${datePart}T${time}`);
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Popover>
          <PopoverTrigger
            render={<Button type="button" variant="outline" className="min-w-0 flex-1 justify-start font-normal" />}
          >
            <span className="truncate">{selectedDate ? selectedDate.toLocaleDateString("pl-PL") : "Wybierz datę"}</span>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar mode="single" selected={selectedDate} onSelect={setDate} />
          </PopoverContent>
        </Popover>
        <Input type="time" className="w-28 shrink-0" value={timePart} onChange={(e: ChangeEvent<HTMLInputElement>) => setTime(e.target.value)} />
      </div>
    </div>
  );
}
