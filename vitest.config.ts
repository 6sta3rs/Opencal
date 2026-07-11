import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["dotenv/config"],
    // Testy route'ów współdzielą jedną bazę Postgres — równoległe pliki
    // ścigają się na licznikach wierszy. Sekwencyjnie = deterministycznie.
    fileParallelism: false,
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname) },
  },
});
