import { describe, expect, it } from "vitest";
import {
  DEFAULT_AVAILABILITY,
  formatAvailabilitySummary,
  sortMonFirst,
  validateAvailabilityPayload,
} from "./availability";

describe("DEFAULT_AVAILABILITY", () => {
  it("ma 7 dni, Pon-Pt włączone 09:00-17:00, Sob/Nie wyłączone", () => {
    expect(DEFAULT_AVAILABILITY).toHaveLength(7);
    const weekdays = DEFAULT_AVAILABILITY.filter((d) => [1, 2, 3, 4, 5].includes(d.dayOfWeek));
    expect(weekdays.every((d) => d.enabled && d.startTime === "09:00" && d.endTime === "17:00")).toBe(true);
    const weekend = DEFAULT_AVAILABILITY.filter((d) => [0, 6].includes(d.dayOfWeek));
    expect(weekend.every((d) => !d.enabled)).toBe(true);
  });
});

describe("sortMonFirst", () => {
  it("sortuje dni tygodnia Pon..Nie (1,2,3,4,5,6,0)", () => {
    const input = [{ dayOfWeek: 0 }, { dayOfWeek: 3 }, { dayOfWeek: 1 }];
    expect(sortMonFirst(input).map((d) => d.dayOfWeek)).toEqual([1, 3, 0]);
  });
});

describe("validateAvailabilityPayload", () => {
  it("akceptuje kompletną listę 7 dni z poprawnymi godzinami", () => {
    expect(validateAvailabilityPayload(DEFAULT_AVAILABILITY)).toBeNull();
  });

  it("odrzuca listę o długości != 7", () => {
    expect(validateAvailabilityPayload(DEFAULT_AVAILABILITY.slice(0, 6))).toMatch(/7/);
  });

  it("odrzuca zduplikowany/brakujący dayOfWeek", () => {
    const bad = DEFAULT_AVAILABILITY.map((d, i) => (i === 0 ? { ...d, dayOfWeek: 2 } : d));
    expect(validateAvailabilityPayload(bad)).toMatch(/dayOfWeek/);
  });

  it("odrzuca zły format godziny", () => {
    const bad = DEFAULT_AVAILABILITY.map((d) => (d.dayOfWeek === 1 ? { ...d, startTime: "9:00" } : d));
    expect(validateAvailabilityPayload(bad)).toMatch(/HH:MM/);
  });
});

describe("formatAvailabilitySummary", () => {
  it("zwraca 'Brak dostępnych dni' gdy wszystkie dni wyłączone", () => {
    const allDisabled = DEFAULT_AVAILABILITY.map((d) => ({ ...d, enabled: false }));
    expect(formatAvailabilitySummary(allDisabled)).toBe("Brak dostępnych dni");
  });

  it("zwija sąsiadujące dni o identycznych godzinach w jeden zakres", () => {
    expect(formatAvailabilitySummary(DEFAULT_AVAILABILITY)).toBe("pon. – pt., 09:00 – 17:00");
  });

  it("pojedynczy włączony dzień bez zakresu", () => {
    const onlySaturday = DEFAULT_AVAILABILITY.map((d) =>
      d.dayOfWeek === 6 ? { ...d, enabled: true, startTime: "10:00", endTime: "14:00" } : { ...d, enabled: false },
    );
    expect(formatAvailabilitySummary(onlySaturday)).toBe("sob., 10:00 – 14:00");
  });

  it("łączy różniące się grupy przez '; '", () => {
    const mixed = DEFAULT_AVAILABILITY.map((d) => {
      if (d.dayOfWeek === 4 || d.dayOfWeek === 5) return { ...d, enabled: false };
      if (d.dayOfWeek === 6) return { ...d, enabled: true, startTime: "10:00", endTime: "14:00" };
      return d;
    });
    expect(formatAvailabilitySummary(mixed)).toBe("pon. – śr., 09:00 – 17:00; sob., 10:00 – 14:00");
  });
});
