"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
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
// overnightStart/departureTime (istniejące pola formularza, ten sam kształt
// "YYYY-MM-DDTHH:MM") jako "Start"/"Koniec" zamiast dni tygodnia + jedna para
// godzin — te dwa poniższe helpery rozkładają/składają tę reprezentację.
function dateOnlyIsoMidnight(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toISOString();
}

// Modal shell is now shadcn <Dialog> (@base-ui/react/dialog): base-ui handles
// mount/unmount timing itself (waits for any running CSS transition/animation
// via element.getAnimations() before removing the popup from the DOM), plus
// Escape and outside-press dismissal and focus trapping out of the box — none
// of that needs hand-rolled JS anymore (deleted vs. the previous pass: the
// modalRef/is-open/is-closing effect, the manual keydown listener, and the
// manual backdrop onMouseDown handler).
//
// The error-shake part is unchanged: still wired with the already-installed
// transitions-dev "error state shake" CSS (.t-input / .t-input-wrap / .is-error
// / .is-shaking / .t-error-msg in app/globals.css) via wrapRef/shakeRef.
//
// ponytail: shadcn's default Dialog open/close animation (tw-animate-css
// fade+zoom, driven by data-open/data-closed) does not itself respect
// prefers-reduced-motion (verified: no @media query in tw-animate-css). Rather
// than re-authoring the transitions-dev modal CSS (which would mean editing
// components/ui/dialog.tsx or app/globals.css — both out of file-ownership
// scope for this ticket), `motion-reduce:animation-duration-0` below pins
// --tw-animation-duration to 0 under reduced motion, which the animate-in/out
// utilities already read from — same tunable-token mechanism transitions-dev
// itself uses, just one Tailwind utility instead of a duplicate custom
// stylesheet. The backdrop's own fade (pure opacity, no transform) is left as
// shadcn's default since DialogOverlay's className isn't exposed by
// components/ui/dialog.tsx for override from here.
export function AddBlockModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const shakeRef = useRef<HTMLFormElement>(null);
  const revertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<BlockFormErrors>({});
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function clearShakeVisual() {
    if (revertTimerRef.current) {
      clearTimeout(revertTimerRef.current);
      revertTimerRef.current = null;
    }
    wrapRef.current?.classList.remove("is-error");
    shakeRef.current?.classList.remove("is-shaking");
  }

  function triggerShake() {
    const wrap = wrapRef.current;
    const shakeEl = shakeRef.current;
    if (!wrap || !shakeEl) return;

    wrap.classList.add("is-error");
    shakeEl.classList.remove("is-shaking");
    void shakeEl.offsetWidth; // reflow so the animation replays
    shakeEl.classList.add("is-shaking");

    const cs = getComputedStyle(document.documentElement);
    const ms = (name: string, fallback: number) => {
      const v = parseFloat(cs.getPropertyValue(name));
      return Number.isFinite(v) ? v : fallback;
    };
    const shakeMs = ms("--shake-dur-a", 80) * 2 + ms("--shake-dur-b", 60) * 2;
    setTimeout(() => shakeEl.classList.remove("is-shaking"), shakeMs + 20);

    if (revertTimerRef.current) clearTimeout(revertTimerRef.current);
    const hold = ms("--revert-hold", 3000);
    revertTimerRef.current = setTimeout(() => {
      revertTimerRef.current = null;
      wrap.classList.remove("is-error");
    }, shakeMs + hold);
  }

  // Resetowanie stanu formularza przy otwarciu — dostosowanie stanu podczas
  // renderu (wzorzec z react.dev "You Might Not Need an Effect"), nie w
  // useEffect, żeby uniknąć synchronicznego setState w efekcie
  // (react-hooks/set-state-in-effect) i dodatkowej kaskady renderów.
  const [wasOpenForForm, setWasOpenForForm] = useState(false);
  if (open && !wasOpenForForm) {
    setWasOpenForForm(true);
    setForm(EMPTY_FORM);
    setErrors({});
    setBannerError(null);
  } else if (!open && wasOpenForForm) {
    setWasOpenForForm(false);
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (Object.keys(errors).length > 0 || bannerError) {
      setErrors({});
      setBannerError(null);
      clearShakeVisual();
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

    let body: Record<string, unknown>;

    if (form.type === "overnight") {
      // Fix 2b: jednorazowy, wielodniowy nocleg — Start/Koniec (data+godzina,
      // patrz DateTimePicker niżej) zamiast dni tygodnia + jedna para godzin.
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
        triggerShake();
        return;
      }

      const startDateKey = form.overnightStart.slice(0, 10);
      body = {
        name: form.name.trim(),
        type: "overnight",
        // startDate/endDate = tylko dzień startu (północ) — realny czas
        // startu/końca noclegu niesie startTime/endTime + departureTime,
        // dokładnie jak przy zwykłych blokach (patrz computeGridSegments).
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
        triggerShake();
        return;
      }

      body = {
        name: form.name.trim(),
        type: form.type,
        startTime: form.startTime,
        endTime: form.endTime,
        daysOfWeek: form.daysOfWeek,
        endDate: null,
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
      const res = await fetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setBannerError(data.error ?? "Nie udało się zapisać bloku.");
        triggerShake();
        setSubmitting(false);
        return;
      }
    } catch {
      setBannerError("Nie udało się zapisać bloku. Sprawdź połączenie.");
      triggerShake();
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    onClose();
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        // Fix 6: DialogContent's base classes (components/ui/dialog.tsx) już
        // niosą "sm:max-w-sm" — sam "max-w-lg" (bez wariantu) tego NIE
        // nadpisuje na szerokościach >=640px (tailwind-merge dedupe'uje tylko
        // w obrębie TEGO SAMEGO wariantu, "sm:max-w-sm" i "max-w-lg" to różne
        // grupy, więc oba zostają, a "sm:max-w-sm" wygrywa w kaskadzie od
        // 640px w górę) — stąd jawny "sm:max-w-lg" obok, żeby faktycznie
        // wygrać na każdej szerokości, nie tylko <640px.
        className={`${form.type === "overnight" ? "max-w-lg sm:max-w-lg" : "max-w-md"} motion-reduce:animation-duration-0`}
      >
        <div ref={wrapRef} className="t-input-wrap">
          <form ref={shakeRef} onSubmit={handleSubmit} className="t-input flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Dodaj blok</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="block-name">Nazwa</Label>
              <Input
                id="block-name"
                autoFocus
                aria-invalid={!!errors.name}
                value={form.name}
                onChange={(e: ChangeEvent<HTMLInputElement>) => updateField("name", e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="block-type">Typ</Label>
              <Select value={form.type} onValueChange={(value) => updateField("type", value as string)}>
                <SelectTrigger id="block-type" className="w-full">
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
                  <Label htmlFor="block-start">Początek</Label>
                  <Input
                    id="block-start"
                    type="time"
                    aria-invalid={!!errors.startTime}
                    value={form.startTime}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => updateField("startTime", e.target.value)}
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="block-end">Koniec</Label>
                  <Input
                    id="block-end"
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
              // Fix 6: pod max-w-md (448px) para Start/Koniec obok siebie
              // ściskała Popover-trigger + Input czasu do nieczytelnej
              // szerokości i wychodziła poza modal — stack pionowy poniżej
              // sm (640px), rząd dopiero od sm w górę.
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
                <Label htmlFor="block-buffer-before">Bufor przed (min)</Label>
                <Input
                  id="block-buffer-before"
                  type="number"
                  min={0}
                  value={form.bufferBefore}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => updateField("bufferBefore", e.target.value)}
                />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="block-buffer-after">Bufor po (min)</Label>
                <Input
                  id="block-buffer-after"
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
                      <Label htmlFor="block-overnight-start">Początek noclegu (opcjonalnie)</Label>
                      <Input
                        id="block-overnight-start"
                        type="datetime-local"
                        value={form.overnightStart}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => updateField("overnightStart", e.target.value)}
                      />
                      <span className="text-caption font-caption text-text-secondary">
                        Domyślnie zaraz po zakończeniu zmiany — ustaw, jeśli między końcem zmiany a noclegiem jest przerwa.
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="block-departure">Wyjazd (data i godzina)</Label>
                      <Input
                        id="block-departure"
                        type="datetime-local"
                        value={form.departureTime}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => updateField("departureTime", e.target.value)}
                      />
                    </div>
                  </>
                )}
              </>
            )}

            <p className="t-error-msg text-caption font-caption text-danger" role="alert">
              {bannerError}
            </p>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Anuluj
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Zapisywanie…" : "Zapisz"}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Fix 2b: Popover (shadcn/base-ui) + Calendar (react-day-picker, mode="single")
// dla daty, Input type="time" obok dla godziny — razem trzymane jako JEDEN
// string "YYYY-MM-DDTHH:MM" (ten sam kształt co natywny <input type="datetime-local">
// gdzie indziej w tym formularzu, więc submit-logic czyta go identycznie).
// ponytail: godzina wymaga wybranej daty (kolejność data->godzina) — bez tego
// trzeba by trzymać dwa niezależne "pending" pola zamiast jednego stringa.
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
