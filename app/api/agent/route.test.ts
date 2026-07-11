import { expect, it } from "vitest";
import { POST } from "./route";

// Ścieżka szczęśliwa (runAgent/runGeminiAgent + prawdziwe API providera) jest
// testowana jednostkowo w lib/agent.test.ts z zamockowanym klientem — tu tylko
// kontrakt walidacji (wspólny dla obu providerów, sprawdzany przed dispatchem).
it("odrzuca żądanie bez pytania (400)", async () => {
  const res = await POST(
    new Request("http://localhost/api/agent", { method: "POST", body: JSON.stringify({}) }),
  );
  expect(res.status).toBe(400);
  expect((await res.json()).error).toContain("message");
});
