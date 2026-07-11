import { afterEach, expect, it } from "vitest";
import { GET } from "./route";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

it("brak kluczy API → pusta lista modeli", async () => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GEMINI_API_KEY;

  const models = await (await GET()).json();

  expect(models).toEqual([]);
});

it("tylko ANTHROPIC_API_KEY ustawiony → jeden aktywny model Claude", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  delete process.env.GEMINI_API_KEY;

  const models = await (await GET()).json();

  expect(models).toEqual([{ id: "claude-opus-4-8", label: "Claude Opus 4.8", provider: "claude" }]);
});

it("tylko GEMINI_API_KEY ustawiony → jeden aktywny model Gemini z GEMINI_MODEL z env", async () => {
  delete process.env.ANTHROPIC_API_KEY;
  process.env.GEMINI_API_KEY = "test-key";
  process.env.GEMINI_MODEL = "gemini-2.5-flash";

  const models = await (await GET()).json();

  expect(models).toEqual([{ id: "gemini-2.5-flash", label: "Gemini Flash", provider: "gemini" }]);
});

it("GEMINI_API_KEY bez GEMINI_MODEL → pada na domyślny alias gemini-flash-latest", async () => {
  delete process.env.ANTHROPIC_API_KEY;
  process.env.GEMINI_API_KEY = "test-key";
  delete process.env.GEMINI_MODEL;

  const models = await (await GET()).json();

  expect(models).toEqual([{ id: "gemini-flash-latest", label: "Gemini Flash", provider: "gemini" }]);
});

it("oba klucze ustawione → dwa aktywne modele", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  process.env.GEMINI_API_KEY = "test-key";
  delete process.env.GEMINI_MODEL;

  const models = await (await GET()).json();

  expect(models).toHaveLength(2);
  expect(models.map((m: { provider: string }) => m.provider).sort()).toEqual(["claude", "gemini"]);
});
