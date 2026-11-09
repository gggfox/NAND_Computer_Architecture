import path from "node:path";

import type { Locator, Page } from "@playwright/test";
import { z } from "zod";

import { libraryPanel, libraryToggle, libraryTree, tapOpenLibrary } from "./library-support";
import { click, tap } from "./pins-support";
import type { Press } from "./pins-support";
import { canvasHost, createProject, expect, exportedText, spoken } from "./support";
import { pressEditorTool } from "./toolbar-support";

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
  await pressEditorTool(page, "Import");
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

/** The header's dot text, there while the open chip has unsaved changes (not the library rows'). */
export const unsavedDot = (page: Page): Locator =>
  page.getByText("Unsaved changes", { exact: true }).and(page.locator(":not([role=treegrid] *)"));

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

/** Makes a folder from the panel's "New folder" (top level) or a row's "New folder inside…". */
export const makeFolder = async (
  page: Page,
  { name, inside }: { readonly name: string; readonly inside?: string },
  press: Press = click,
): Promise<void> => {
  if (inside === undefined) {
    await press(libraryPanel(page).getByRole("button", { name: "New folder", exact: true }));
  } else {
    await press(
      libraryTree(page).getByRole("button", { name: `Actions for ${inside}`, exact: true }),
    );
    await press(page.getByRole("menuitem", { name: "New folder inside…" }));
  }
  const dialog = page.getByRole("dialog", { name: "New folder" });
  await dialog.getByRole("textbox", { name: "Folder name" }).fill(name);
  await press(dialog.getByRole("button", { name: "Save" }));
  await expect(dialog).toHaveCount(0);
};

/** Picks `option` in the dialog's Folder select. */
export const chooseFolder = async (
  dialog: Locator,
  option: string,
  press: Press = click,
): Promise<void> => {
  await press(dialog.getByRole("button", { name: /Folder/u }));
  await press(dialog.page().getByRole("option", { name: option, exact: true }));
};

/** New chip from the library sheet, with taps: the sheet closes on the new, empty chip. */
export const tapNewChip = async (page: Page, name: string): Promise<void> => {
  await tapOpenLibrary(page);
  await tap(libraryPanel(page).getByRole("button", { name: "New chip", exact: true }));
  const dialog = page.getByRole("dialog", { name: "New chip" });
  await dialog.getByRole("textbox", { name: "Name" }).fill(name);
  await tap(dialog.getByRole("button", { name: "Save" }));
  await expect(dialog).toHaveCount(0);
  await expect(chipPath(page).locator('[aria-current="page"]')).toHaveText(name);
};
