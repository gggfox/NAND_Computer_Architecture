import path from "node:path";

import type { FileChooser, Locator, Page } from "@playwright/test";

import { createProject, expect } from "./support";

/**
 * `fixtures/library.json`: folders Arithmetic › Adders and Logic; a saved "Half adder" in Adders;
 * a saved, starred, red "XOR" tagged `gate` in Logic; a draft-only "Scratch" at the top level;
 * and the open chip "Main".
 */
export const LIBRARY = path.join(import.meta.dirname, "fixtures", "library.json");

/** Opens a new project, then imports `file` through the toolbar and lands on the "Library" project. */
export const importLibrary = async (
  page: Page,
  file: Parameters<FileChooser["setFiles"]>[0] = LIBRARY,
): Promise<void> => {
  await createProject(page);
  const chooserEvent = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import" }).click();
  const chooser = await chooserEvent;
  await chooser.setFiles(file);
  await expect(page.getByRole("heading", { level: 1, name: "Library" })).toBeAttached();
};

/** The library's folder tree. */
export const libraryTree = (page: Page): Locator => page.getByRole("treegrid", { name: "Chips" });

/** Opens the library from the toolbar: a column on wide screens, a sheet on phones. */
export const openLibrary = async (page: Page): Promise<Locator> => {
  const toggle = page.getByRole("button", { name: "Library", exact: true });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const tree = libraryTree(page);
  await expect(tree).toBeVisible();
  return tree;
};

/** The tree row whose name is `name` (rows also hold badges and reasons). */
export const libraryRow = (tree: Locator, name: string): Locator =>
  tree.getByRole("row").filter({ has: tree.page().getByText(name, { exact: true }) });
