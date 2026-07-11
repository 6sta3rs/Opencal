import { beforeEach, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import type { GoogleGenAI } from "@google/genai";
import { findGaps } from "./gap-finding";
import { runAgent, runGeminiAgent, SYSTEM_PROMPT } from "./agent";

// Spy zachowuje prawdziwą implementację findGaps — sprawdzamy delegację, nie duplikację.
vi.mock("./gap-finding", { spy: true });

beforeEach(() => {
  vi.clearAllMocks();
});

// Praca pn–pt 08:00–16:00, bez końca serii.
const blocks = [
  { startTime: "08:00", endTime: "16:00", daysOfWeek: [1, 2, 3, 4, 5], endDate: null },
];

function mockAnthropic(responses: object[]) {
  const create = vi.fn();
  for (const r of responses) create.mockResolvedValueOnce(r);
  return { client: { messages: { create } } as unknown as Anthropic, create };
}

const toolUseResponse = (input: object) => ({
  stop_reason: "tool_use",
  content: [{ type: "tool_use", id: "toolu_1", name: "find_free_slots", input }],
});

const textResponse = (text: string) => ({
  stop_reason: "end_turn",
  content: [{ type: "text", text }],
});

it("model żąda find_free_slots → agent wywołuje findGaps z parametrami toola i zwraca rekomendację z terminami", async () => {
  const input = {
    rangeStart: "2026-07-13T00:00:00",
    rangeEnd: "2026-07-17T23:59:00",
    durationMinutes: 180,
  };
  const { client, create } = mockAnthropic([
    toolUseResponse(input),
    textResponse("Proponuję poniedziałek 13.07 po 16:00 — masz wtedy wolne okno po pracy."),
  ]);

  const result = await runAgent("Chcę wcisnąć 3h kursu w tym tygodniu, najlepiej rano", {
    anthropic: client,
    findBlocks: async () => blocks,
  });

  // Oczekiwane luki liczone tym samym silnikiem — endpoint musi zwrócić dokładnie to.
  const expected = findGaps(
    blocks,
    new Date(input.rangeStart),
    new Date(input.rangeEnd),
    { durationMinutes: 180 },
  ).map((g) => ({ start: g.start.toISOString(), end: g.end.toISOString() }));

  expect(create).toHaveBeenCalledTimes(2);
  expect(result.answer).toContain("Proponuję poniedziałek");
  expect(result.slots).toEqual(expected);
  expect(result.slots.length).toBeGreaterThan(0);

  // Wynik toola wraca do modelu jako tool_result z tymi lukami.
  const secondCall = create.mock.calls[1][0];
  const toolResultMsg = secondCall.messages.at(-1);
  expect(toolResultMsg.role).toBe("user");
  expect(toolResultMsg.content[0]).toMatchObject({ type: "tool_result", tool_use_id: "toolu_1" });
  expect(JSON.parse(toolResultMsg.content[0].content)).toEqual(expected);
});

it("handler find_free_slots deleguje do findGaps z parametrami toola (nie liczy luk sam)", async () => {
  const { client } = mockAnthropic([
    toolUseResponse({
      rangeStart: "2026-07-13T00:00:00",
      rangeEnd: "2026-07-14T00:00:00",
      durationMinutes: 60,
      bufferBefore: 15,
      bufferAfter: 15,
      preferredAfter: "17:00",
    }),
    textResponse("Termin znaleziony."),
  ]);

  await runAgent("Godzina na trening po 17", { anthropic: client, findBlocks: async () => blocks });

  expect(findGaps).toHaveBeenCalledExactlyOnceWith(
    blocks,
    new Date("2026-07-13T00:00:00"),
    new Date("2026-07-14T00:00:00"),
    { durationMinutes: 60, bufferBefore: 15, bufferAfter: 15, preferredWindow: { after: "17:00" } },
  );
});

it("system prompt każe unikać okien po zmianie nocnej i używać toola; wszystkie kandydackie luki trafiają do modelu", async () => {
  // Sygnały z decyzji #5 muszą siedzieć w prompcie systemowym.
  expect(SYSTEM_PROMPT).toMatch(/zmian\w* nocn/i);
  expect(SYSTEM_PROMPT).toContain("find_free_slots");
  expect(SYSTEM_PROMPT).toMatch(/nie licz luk samodzielnie/i);

  const input = {
    rangeStart: "2026-07-13T00:00:00",
    rangeEnd: "2026-07-17T23:59:00",
    durationMinutes: 60,
  };
  const { client, create } = mockAnthropic([toolUseResponse(input), textResponse("OK")]);

  await runAgent("Godzina kursu w tym tygodniu", {
    anthropic: client,
    findBlocks: async () => blocks,
  });

  // Prompt systemowy faktycznie wysyłany do API.
  expect(create.mock.calls[0][0].system).toBe(SYSTEM_PROMPT);

  // Pn–pt 08–16 w 5-dniowym zakresie → wiele luk; model dostaje wszystkie (bez ucinania do jednej).
  const candidates = findGaps(blocks, new Date(input.rangeStart), new Date(input.rangeEnd), {
    durationMinutes: 60,
  });
  expect(candidates.length).toBeGreaterThan(1);
  const toolResult = create.mock.calls[1][0].messages.at(-1).content[0];
  expect(JSON.parse(toolResult.content)).toHaveLength(candidates.length);
});

it("brak pasujących okien → agent nie wywala się, model dostaje pustą listę i formułuje uczciwą odpowiedź", async () => {
  // 10h ciągiem nie zmieści się w jednym dniu z pracą 08–16 → zero luk.
  const input = {
    rangeStart: "2026-07-13T00:00:00",
    rangeEnd: "2026-07-14T00:00:00",
    durationMinutes: 600,
  };
  const { client, create } = mockAnthropic([
    toolUseResponse(input),
    textResponse("Nie znalazłem 10h w poniedziałek — najbliższa alternatywa to sobota."),
  ]);

  const result = await runAgent("10 godzin kursu w poniedziałek", {
    anthropic: client,
    findBlocks: async () => blocks,
  });

  const toolResult = create.mock.calls[1][0].messages.at(-1).content[0];
  expect(JSON.parse(toolResult.content)).toEqual([]);
  expect(result.slots).toEqual([]);
  expect(result.answer).toContain("najbliższa alternatywa");
});

it("historia rozmowy trafia do wiadomości wysyłanych do Claude przed nowym pytaniem", async () => {
  const { client, create } = mockAnthropic([textResponse("Kontynuuję wątek.")]);

  await runAgent(
    "A co z wtorkiem?",
    { anthropic: client, findBlocks: async () => blocks },
    [
      { role: "user", content: "Szukam 2h na kurs w poniedziałek" },
      { role: "assistant", content: "Proponuję poniedziałek 16:00." },
    ],
  );

  const sentMessages = create.mock.calls[0][0].messages;
  expect(sentMessages).toEqual([
    { role: "user", content: "Szukam 2h na kurs w poniedziałek" },
    { role: "assistant", content: "Proponuję poniedziałek 16:00." },
    { role: "user", content: "A co z wtorkiem?" },
  ]);
});

function mockGemini(responses: object[]) {
  const generateContent = vi.fn();
  for (const r of responses) generateContent.mockResolvedValueOnce(r);
  return { client: { models: { generateContent } } as unknown as GoogleGenAI, generateContent };
}

const geminiFunctionCallResponse = (args: object) => ({
  functionCalls: [{ name: "find_free_slots", args }],
  text: "",
});

const geminiTextResponse = (text: string) => ({
  functionCalls: [],
  text,
});

it("model Gemini żąda find_free_slots → agent wywołuje findGaps i zwraca rekomendację z terminami", async () => {
  const input = {
    rangeStart: "2026-07-13T00:00:00",
    rangeEnd: "2026-07-17T23:59:00",
    durationMinutes: 180,
  };
  const { client, generateContent } = mockGemini([
    geminiFunctionCallResponse(input),
    geminiTextResponse("Proponuję poniedziałek 13.07 po 16:00 — masz wtedy wolne okno po pracy."),
  ]);

  const result = await runGeminiAgent("Chcę wcisnąć 3h kursu w tym tygodniu", {
    gemini: client,
    findBlocks: async () => blocks,
  });

  const expected = findGaps(
    blocks,
    new Date(input.rangeStart),
    new Date(input.rangeEnd),
    { durationMinutes: 180 },
  ).map((g) => ({ start: g.start.toISOString(), end: g.end.toISOString() }));

  expect(generateContent).toHaveBeenCalledTimes(2);
  expect(result.answer).toContain("Proponuję poniedziałek");
  expect(result.slots).toEqual(expected);
  expect(result.slots.length).toBeGreaterThan(0);
});

it("historia rozmowy trafia do contents wysyłanych do Gemini (role model dla odpowiedzi agenta)", async () => {
  const { client, generateContent } = mockGemini([geminiTextResponse("Kontynuuję wątek.")]);

  await runGeminiAgent(
    "A co z wtorkiem?",
    { gemini: client, findBlocks: async () => blocks },
    [
      { role: "user", content: "Szukam 2h na kurs w poniedziałek" },
      { role: "assistant", content: "Proponuję poniedziałek 16:00." },
    ],
  );

  const sentContents = generateContent.mock.calls[0][0].contents;
  expect(sentContents).toEqual([
    { role: "user", parts: [{ text: "Szukam 2h na kurs w poniedziałek" }] },
    { role: "model", parts: [{ text: "Proponuję poniedziałek 16:00." }] },
    { role: "user", parts: [{ text: "A co z wtorkiem?" }] },
  ]);
});
