import type Anthropic from "@anthropic-ai/sdk";
import type { GoogleGenAI } from "@google/genai";
import { findGaps } from "./gap-finding";

type Block = Parameters<typeof findGaps>[0][number];
type Slot = { start: string; end: string };

// Model aktualnie zalecany przez skill claude-api dla Opus-tier (2026-06-24).
export const CLAUDE_MODEL = "claude-opus-4-8";
// Alias Google — zawsze wskazuje na najnowszy model z rodziny Flash;
// przypnij dokładny model.id w .env (GEMINI_MODEL), jeśli chcesz stabilną wersję.
export const DEFAULT_GEMINI_MODEL = "gemini-flash-latest";

export type AgentMessage = { role: "user" | "assistant"; content: string };

export type AgentDeps = {
  anthropic: Anthropic;
  findBlocks: () => Promise<Block[]>;
};

export type GeminiAgentDeps = {
  gemini: GoogleGenAI;
  findBlocks: () => Promise<Block[]>;
  model?: string;
};

export const SYSTEM_PROMPT = `Jesteś asystentem kalendarza zmianowego. Pomagasz znaleźć wolne okna
na kursy, sprawy prywatne i pozycje z backlogu w nieregularnym grafiku pracy.

Zasady:
- Zawsze używaj toola find_free_slots do wyszukiwania wolnych okien — nigdy nie licz luk samodzielnie.
- Unikaj rekomendowania okien bezpośrednio po zmianie nocnej, jeśli istnieją alternatywy — użytkownik
  potrzebuje wtedy odpoczynku. Gdy alternatyw brak, zaproponuj okno z wyraźnym zastrzeżeniem.
- Uwzględniaj porę dnia z prośby użytkownika (np. "najlepiej rano" → preferredAfter wcześnie, okna poranne).
- Gdy brak pasujących okien, powiedz to uczciwie i zaproponuj najbliższą alternatywę
  (inny termin, krótszy czas trwania lub szerszy zakres dat).
- Odpowiadaj po polsku, krótko: konkretny termin + uzasadnienie.`;

// Schemat toola współdzielony między Claude (input_schema) a Gemini
// (parametersJsonSchema) — oba to zwykły JSON Schema.
const FIND_FREE_SLOTS_SCHEMA: Anthropic.Tool.InputSchema = {
  type: "object",
  properties: {
    rangeStart: { type: "string", description: "Początek przeszukiwanego zakresu (ISO 8601)" },
    rangeEnd: { type: "string", description: "Koniec przeszukiwanego zakresu (ISO 8601)" },
    durationMinutes: { type: "number", description: "Wymagany czas trwania w minutach" },
    bufferBefore: { type: "number", description: "Bufor przed (minuty), np. dojazd" },
    bufferAfter: { type: "number", description: "Bufor po (minuty), np. powrót" },
    preferredAfter: {
      type: "string",
      description: "HH:MM — uwzględniaj tylko część luki zaczynającą się po tej godzinie",
    },
  },
  required: ["rangeStart", "rangeEnd", "durationMinutes"],
};

const FIND_FREE_SLOTS_TOOL: Anthropic.Tool = {
  name: "find_free_slots",
  description:
    "Szuka wolnych okien w grafiku między cyklicznymi blokami (praca, kursy). " +
    "Zwraca listę luk {start, end} w formacie ISO 8601. Wywołuj zawsze, gdy trzeba znaleźć termin.",
  input_schema: FIND_FREE_SLOTS_SCHEMA,
};

const GEMINI_FIND_FREE_SLOTS_DECLARATION = {
  name: "find_free_slots",
  description: FIND_FREE_SLOTS_TOOL.description,
  parametersJsonSchema: FIND_FREE_SLOTS_SCHEMA,
};

type FindFreeSlotsInput = {
  rangeStart: string;
  rangeEnd: string;
  durationMinutes: number;
  bufferBefore?: number;
  bufferAfter?: number;
  preferredAfter?: string;
};

// Handler toola: czysta delegacja do silnika gap-finding (kryterium: agent nie liczy luk sam).
// Współdzielony przez oba providery (Claude i Gemini).
// ponytail: bez zewnętrznej zajętości z GCal — dołożyć busySource, gdy ticket 08 odblokuje OAuth.
function executeFindFreeSlots(input: FindFreeSlotsInput, blocks: Block[]): Slot[] {
  const gaps = findGaps(blocks, new Date(input.rangeStart), new Date(input.rangeEnd), {
    durationMinutes: input.durationMinutes,
    bufferBefore: input.bufferBefore,
    bufferAfter: input.bufferAfter,
    preferredWindow: input.preferredAfter ? { after: input.preferredAfter } : undefined,
  });
  return gaps.map((g) => ({ start: g.start.toISOString(), end: g.end.toISOString() }));
}

export async function runAgent(
  userMessage: string,
  deps: AgentDeps,
  history: AgentMessage[] = [],
): Promise<{ answer: string; slots: Slot[] }> {
  const blocks = await deps.findBlocks();
  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.content }) as Anthropic.MessageParam),
    { role: "user", content: userMessage },
  ];
  let slots: Slot[] = [];

  // ponytail: twardy limit 5 rund tool_use zamiast pętli bez końca — podnieść, gdy
  // agent zacznie realnie iterować po wielu zakresach dat.
  for (let i = 0; i < 5; i++) {
    const response = await deps.anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      tools: [FIND_FREE_SLOTS_TOOL],
      messages,
    });

    if (response.stop_reason !== "tool_use") {
      const answer = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");
      return { answer, slots };
    }

    messages.push({ role: "assistant", content: response.content });
    const toolResults: Anthropic.ToolResultBlockParam[] = response.content
      .filter((b) => b.type === "tool_use")
      .map((block) => {
        slots = executeFindFreeSlots(block.input as FindFreeSlotsInput, blocks);
        return { type: "tool_result", tool_use_id: block.id, content: JSON.stringify(slots) };
      });
    messages.push({ role: "user", content: toolResults });
  }

  throw new Error("Agent przekroczył limit rund tool_use");
}

type GeminiContent = { role: "user" | "model"; parts: Array<Record<string, unknown>> };

export async function runGeminiAgent(
  userMessage: string,
  deps: GeminiAgentDeps,
  history: AgentMessage[] = [],
): Promise<{ answer: string; slots: Slot[] }> {
  const blocks = await deps.findBlocks();
  const contents: GeminiContent[] = [
    ...history.map((m) => ({
      role: m.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: m.content }],
    })),
    { role: "user", parts: [{ text: userMessage }] },
  ];
  let slots: Slot[] = [];

  // ponytail: sam limit rund co u Claude — jeden agent, dwie pętle o tym samym kształcie.
  for (let i = 0; i < 5; i++) {
    const response = await deps.gemini.models.generateContent({
      model: deps.model ?? DEFAULT_GEMINI_MODEL,
      contents,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        tools: [{ functionDeclarations: [GEMINI_FIND_FREE_SLOTS_DECLARATION] }],
      },
    });

    const calls = response.functionCalls ?? [];
    if (calls.length === 0) {
      return { answer: response.text ?? "", slots };
    }

    contents.push({ role: "model", parts: calls.map((call) => ({ functionCall: call })) });
    const responseParts = calls.map((call) => {
      slots = executeFindFreeSlots(call.args as FindFreeSlotsInput, blocks);
      return { functionResponse: { name: call.name, response: { slots } } };
    });
    contents.push({ role: "user", parts: responseParts });
  }

  throw new Error("Agent przekroczył limit rund tool_use");
}
