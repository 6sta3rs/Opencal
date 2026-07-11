import { defineConfig, devices } from "@playwright/test";
import net from "node:net";

// Next.js 16 holds a single filesystem-wide dev-server lock per project
// directory (.next/lock — see node_modules/next/dist/build/lockfile.js),
// not one per port. This repo runs several agents' `next dev` processes
// concurrently in the *same* directory (no worktrees), so only the first one
// to start ever succeeds — a second `next dev -p 3003` here fails with
// "Another next dev server is already running" even though port 3003 itself
// is free. Probe for whichever port already has a live server (all agents
// share the same filesystem, so any of them reflects current source) and
// reuse it; only spawn our own — on this agent's assigned port, 3003 — when
// none is up yet (e.g. a clean/first run).
// Plain TCP connect rather than an HTTP request: a cold Next dev server can
// take several seconds to compile the very first page it serves, but the
// port itself opens for listening as soon as the process starts — so a TCP
// probe answers "is a server here" without paying (or misreading) that
// compile latency as "nothing's listening".
function portIsOpen(port: number, timeoutMs = 800): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (result: boolean) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, "127.0.0.1");
  });
}

async function detectRunningPort(candidates: number[]): Promise<number | null> {
  for (const port of candidates) {
    if (await portIsOpen(port)) return port;
  }
  return null;
}

const OWN_PORT = 3003;
const livePort = await detectRunningPort([3000, 3001, 3002, 3003, 3004]);
const port = livePort ?? OWN_PORT;

export default defineConfig({
  testDir: "./e2e",
  // .e2e.ts (not .spec.ts) so vitest's default include glob
  // (**/*.{test,spec}.*) doesn't also try to collect this file — Playwright
  // and vitest would otherwise fight over the same `test()` global.
  testMatch: /.*\.e2e\.ts/,
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Skip spawning entirely when a server is already reachable (see above) —
  // starting a second `next dev` in this directory always fails, so there is
  // nothing useful `reuseExistingServer` can reuse-detect via `url` here.
  webServer: livePort
    ? undefined
    : {
        command: `pnpm dev -p ${OWN_PORT}`,
        url: `http://localhost:${OWN_PORT}`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
