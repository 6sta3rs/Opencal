import { expect, it } from "vitest";
import { calculateFormEarnings } from "./earnings-panel";

it("10h x 32 PLN + pozycja 120 PLN = 440 PLN (przykład akceptacyjny z ticketu 21)", () => {
  const total = calculateFormEarnings({
    start: "2026-07-10T06:00",
    end: "2026-07-10T16:00",
    breakDuration: 0,
    hourlyRate: 32,
    lineItems: [{ label: "Dodatek", amount: 120 }],
  });

  expect(total).toBe(440);
});

it("zwraca 0 gdy formularz nie ma jeszcze wypełnionych godzin", () => {
  const total = calculateFormEarnings({
    start: "",
    end: "",
    breakDuration: 0,
    hourlyRate: 32,
    lineItems: [],
  });

  expect(total).toBe(0);
});
