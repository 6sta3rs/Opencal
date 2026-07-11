import { test, expect } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function deleteBlock(name: string) {
  return execFileAsync("docker", [
    "exec",
    "kalendarz-db",
    "psql",
    "-U",
    "postgres",
    "-d",
    "kalendarz",
    "-c",
    `DELETE FROM "RecurringBlock" WHERE name = '${name}'`,
  ]);
}

// First e2e test in the project (ticket 19). Full path: open the "+ Dodaj"
// modal, fill it in, save, and confirm the new block renders in the planner
// grid. `deleteBlock` is a safety-net cleanup for THIS test file (shells out
// to `docker exec ... psql`, stdlib child_process, no new dependency) — the
// second test below exercises the real DELETE /api/blocks/[id] route via the
// UI itself and clears `uniqueName` on success so afterEach has nothing left
// to do; deleteBlock only fires if an assertion fails first.
let uniqueName: string;

test.afterEach(async () => {
  if (uniqueName) await deleteBlock(uniqueName);
});

test("dodawanie bloku przez modal pojawia się w Plannerze", async ({ page }) => {
  uniqueName = `E2E blok ${Date.now()}`;

  await page.goto("/");
  await page.getByRole("button", { name: "Dodaj" }).click();

  const dialog = page.getByRole("dialog", { name: "Dodaj blok" });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel("Nazwa").fill(uniqueName);
  await dialog.getByLabel("Początek").fill("09:00");
  await dialog.getByLabel("Koniec").fill("17:00");
  // Any day works: the grid always shows the full current week regardless of
  // which weekday is picked (see lib/planner-grid.ts getWeekDays).
  await dialog.getByRole("button", { name: "Pon" }).click();

  await dialog.getByRole("button", { name: "Zapisz" }).click();

  await expect(dialog).toBeHidden();
  // Scoped to <main> (the planner grid) — the block name also legitimately
  // appears in the sidebar's "Bloki cykliczne" list, which would make an
  // unscoped locator ambiguous.
  await expect(page.getByRole("main").getByText(uniqueName)).toBeVisible();
});

test("usuwanie bloku przez modal edycji znika z Plannera (bez przeładowania strony)", async ({ page }) => {
  uniqueName = `E2E do usunięcia ${Date.now()}`;

  await page.goto("/");
  await page.getByRole("button", { name: "Dodaj" }).click();
  const addDialog = page.getByRole("dialog", { name: "Dodaj blok" });
  await addDialog.getByLabel("Nazwa").fill(uniqueName);
  await addDialog.getByLabel("Początek").fill("09:00");
  await addDialog.getByLabel("Koniec").fill("17:00");
  await addDialog.getByRole("button", { name: "Pon" }).click();
  await addDialog.getByRole("button", { name: "Zapisz" }).click();
  await expect(addDialog).toBeHidden();

  const card = page.getByRole("main").getByText(uniqueName);
  await expect(card).toBeVisible();
  await card.click();

  const editDialog = page.getByRole("dialog", { name: "Edytuj blok" });
  await expect(editDialog).toBeVisible();
  await editDialog.getByRole("button", { name: "Usuń", exact: true }).click();
  await editDialog.getByRole("button", { name: "Tak, usuń" }).click();

  await expect(editDialog).toBeHidden();
  await expect(page.getByRole("main").getByText(uniqueName)).toBeHidden();
  uniqueName = ""; // już usunięte przez UI — afterEach nie musi sprzątać
});
