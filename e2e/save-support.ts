import path from "node:path";

import type { Locator, Page } from "@playwright/test";
import { z } from "zod";

import { libraryToggle, libraryTree } from "./library-support";
import { canvasHost, createProject, expect, exportedText, spoken } from "./support";

/**
 * `fixtures/save-flow.json`: the open, saved "Half adder" (inputs A and B into a NAND, output S);
 * a saved "Full adder" that places it and wires its inputs X and Y to A and B; and a draft-only
 * "Scratch". All three sit at the library's top level.
 */
export const SAVE_FLOW = path.join(import.meta.dirname, "fixtures", "save-flow.json");

/** Opens a new project, then imports `save-flow.json` through the toolbar, landing on Half adder. */
export const importSaveFlow = async (page: Page): Promise<void> => {
  await createProject(page);
  const chooserEvent = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import" }).click();
  const chooser = await chooserEvent;
  await chooser.setFiles(SAVE_FLOW);
  await expect(page.getByRole("heading", { level: 1, name: "Save flow" })).toBeAttached();
  await expect(chipPath(page).getByText("Half adder", { exact: true })).toBeVisible();
};

/** The header's breadcrumbs. */
export const chipPath = (page: Page): Locator =>
  page.getByRole("navigation", { name: "Chip path" });

/** The header's Save button. */
export const saveButton = (page: Page): Locator =>
  page.getByRole("button", { name: "Save", exact: true });

/** The dot's visually hidden text, there while the open chip has unsaved changes. */
export const unsavedDot = (page: Page): Locator =>
  page.getByText("Unsaved changes", { exact: true });

/** The header's ⋯ menu button, there only while it has an entry. */
export const moreButton = (page: Page): Locator =>
  page.getByRole("button", { name: "More chip actions" });

/** The header's polite status, which speaks "Saved …" and "Changes to … discarded". */
export const outcome = (page: Page, text: string): Locator =>
  page.getByRole("status").filter({ hasText: text });

/** Opens `name` from its library row menu; a phone's sheet closes itself, a column stays open. */
export const openChip = async (page: Page, name: string): Promise<void> => {
  const toggle = libraryToggle(page);
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click();
  }
  const tree = libraryTree(page);
  await tree.getByRole("button", { name: `Actions for ${name}`, exact: true }).click();
  await page.getByRole("menuitem", { name: "Open", exact: true }).click();
  await expect(chipPath(page).locator('[aria-current="page"]')).toHaveText(name);
};

const MAX_STEPS = 12;

/** Focuses the canvas and steps the selection with `]` until the spoken text matches `selected`. */
export const selectOnCanvas = async (page: Page, selected: RegExp): Promise<void> => {
  await canvasHost(page).focus();
  for (let step = 0; step < MAX_STEPS; step += 1) {
    await page.keyboard.press("]");
    if (selected.test((await spoken(page).textContent()) ?? "")) {
      return;
    }
  }
  await expect(spoken(page)).toHaveText(selected);
};

/** Moves the open chip's NAND one grid step right, as one edit. */
export const moveNand = async (page: Page): Promise<void> => {
  await selectOnCanvas(page, /NAND gate 1 selected/u);
  await page.keyboard.press("ArrowRight");
  await expect(spoken(page)).toHaveText(/Chips moved: 1/u);
};

const DraftSchema = z.object({ wires: z.array(z.unknown()) });
const ChipSchema = z.object({ name: z.string(), draft: DraftSchema });
const DraftsSchema = z.object({ project: z.object({ chips: z.array(ChipSchema) }) });

/** How many wires the draft of the chip named `name` has, read from an exported project. */
export const draftWireCount = async (page: Page, name: string): Promise<number | undefined> => {
  const file = DraftsSchema.parse(JSON.parse(await exportedText(page)));
  return file.project.chips.find((chip) => chip.name === name)?.draft.wires.length;
};
