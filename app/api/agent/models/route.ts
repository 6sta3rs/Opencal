import { CLAUDE_MODEL, DEFAULT_GEMINI_MODEL } from "@/lib/agent";

export type AgentModelInfo = { id: string; label: string; provider: "claude" | "gemini" };

// Aktywne modele = klucz API ustawiony w env. Czytane przy każdym żądaniu
// (nie w module scope), żeby test mógł podmieniać process.env.
export async function GET() {
  const models: AgentModelInfo[] = [];
  if (process.env.ANTHROPIC_API_KEY) {
    models.push({ id: CLAUDE_MODEL, label: "Claude Opus 4.8", provider: "claude" });
  }
  if (process.env.GEMINI_API_KEY) {
    models.push({
      id: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
      label: "Gemini Flash",
      provider: "gemini",
    });
  }
  return Response.json(models);
}
