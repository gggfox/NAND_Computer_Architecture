import type { Page } from "@playwright/test";

import { createProject, expect, test } from "./support";

const STORAGE_NOTICE = /Browser storage is unavailable/u;
/** The demo's NAND plus the one the test adds. */
const NANDS_AFTER_ADD = 2;

/** How many NAND gates the stored project records hold, read straight from IndexedDB. */
const storedNandCount = (page: Page): Promise<number> =>
  page.evaluate(
    () =>
      // oxlint-disable-next-line promise/avoid-new -- the page has no IndexedDB promise wrapper; adapt request events
      new Promise<number>((resolve, reject) => {
        const request = indexedDB.open("nand");
        request.addEventListener("error", () => {
          reject(new Error("could not open the nand database"));
        });
        request.addEventListener("success", () => {
          const db = request.result;
          const getAll = db.transaction("projects").objectStore("projects").getAll();
          getAll.addEventListener("success", () => {
            db.close();
            const texts = getAll.result.filter((text): text is string => typeof text === "string");
            resolve(texts.join("").split('"builtin":"nand"').length - 1);
          });
        });
      }),
  );

const addNand = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: "Add NAND" }).click();
  await expect(page.getByText("NAND gate 2")).toBeVisible();
};

test("an added NAND survives a reload", async ({ page }) => {
  await createProject(page);
  await addNand(page);
  // Autosave is debounced; reload once it has landed, as a person pausing after an edit would.
  await expect.poll(() => storedNandCount(page)).toBe(NANDS_AFTER_ADD);

  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "NAND demo" })).toBeAttached();
  await expect(page.getByText("NAND gate 2")).toBeVisible();
});

test("an added NAND survives leaving and reopening the project", async ({ page }) => {
  await createProject(page);
  await addNand(page);

  await page.getByRole("link", { name: "All projects" }).click();
  await page.getByRole("link", { name: "NAND demo" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "NAND demo" })).toBeAttached();
  await expect(page.getByText("NAND gate 2")).toBeVisible();
  // The edit is undoable no more (session-only undo, ADR 22), so this is the reloaded project.
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
});

test("losing IndexedDB mid-session shows the storage notice", async ({ page }) => {
  await createProject(page);
  await expect(page.getByText(STORAGE_NOTICE)).toHaveCount(0);

  // What iOS Safari does after backgrounding: every new connection fails.
  await page.evaluate(() => {
    IDBFactory.prototype.open = () => {
      throw new DOMException("Connection to Indexed Database server lost", "UnknownError");
    };
  });
  await addNand(page);
  await expect(page.getByText(STORAGE_NOTICE)).toBeVisible();
});

test("without IndexedDB the app works in memory and says so", async ({ page }) => {
  await page.addInitScript(() => {
    IDBFactory.prototype.open = () => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    };
  });
  await createProject(page);
  await expect(page.getByText(STORAGE_NOTICE)).toBeVisible();
  await addNand(page);
});

test("switching language right after an edit keeps the edit", async ({ page }) => {
  await createProject(page);
  await addNand(page);

  // No wait for the autosave: the switch reloads the page and must write the edit first.
  await page.getByRole("button", { name: /Language$/u }).click();
  await page.getByRole("option", { name: "Español" }).click();
  await expect(page.getByRole("button", { name: "Deshacer" })).toBeVisible();
  await expect(page.getByText("Puerta NAND 2")).toBeVisible();
});
