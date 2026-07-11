import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { prisma } from "@/lib/prisma";
import { runAgent, runGeminiAgent, DEFAULT_GEMINI_MODEL, type AgentMessage } from "@/lib/agent";

export async function POST(request: Request) {
  const data = await request.json();
  if (typeof data.message !== "string" || data.message === "") {
    return Response.json({ error: "message jest wymagane" }, { status: 400 });
  }
  const history: AgentMessage[] = Array.isArray(data.history) ? data.history : [];
  const model = typeof data.model === "string" ? data.model : undefined;
  const geminiModel = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;

  // Klienty tworzone dopiero po walidacji — SDK czyta klucze API z env;
  // testy nigdy tu nie trafiają (oba providery testowane jednostkowo w
  // lib/agent.test.ts z wstrzykniętymi mockami).
  if (model === geminiModel) {
    const result = await runGeminiAgent(
      data.message,
      {
        gemini: new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }),
        findBlocks: () => prisma.recurringBlock.findMany(),
        model: geminiModel,
      },
      history,
    );
    return Response.json(result);
  }

  const result = await runAgent(
    data.message,
    { anthropic: new Anthropic(), findBlocks: () => prisma.recurringBlock.findMany() },
    history,
  );
  return Response.json(result);
}
