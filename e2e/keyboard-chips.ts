import type { Locator, Page } from "@playwright/test";

import { activate, allPartNames, chooseEntry } from "./keyboard-support";
import { libraryPanel, libraryRow, libraryToggle, libraryTree } from "./library-support";
import { addPins, closePins, nameField, nameRow, openPins, rowNames } from "./pins-support";
import type { Direction } from "./pins-support";
import { chipPath, chooseFolder } from "./save-support";
import { expect } from "./support";

/*
 * Keyboard-only helpers for chips: the library (folders, new chips, renames, placing), the Pins
 * panel and the header's Save. They use no pointer, as `keyboard-support` does.
 */

const FIRST = 1;
const SECOND = 2;

/** Opens the library with its toolbar button, if it is closed, and returns the folder tree. */
export const openLibraryByKeyboard = async (page: Page): Promise<Locator> => {
  const toggle = libraryToggle(page);
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await activate(toggle);
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  }
  const tree = libraryTree(page);
  await expect(tree).toBeVisible();
  return tree;
};

/** On a phone the library is a sheet over the page. Closes it, so the page takes keys again. */
export const closeLibrarySheet = async (page: Page): Promise<void> => {
  const sheet = page.getByRole("dialog", { name: "Chip library" });
  if ((await sheet.count()) > 0) {
    await activate(sheet.getByRole("button", { name: "Close", exact: true }));
    await expect(sheet).toHaveCount(0);
  }
};

/** Makes a folder from the library's "New folder", or from a folder's "New folder inside…". */
export const makeFolderByKeyboard = async (
  page: Page,
  { name, inside }: { readonly name: string; readonly inside?: string },
): Promise<void> => {
  const tree = await openLibraryByKeyboard(page);
  await (inside === undefined
    ? activate(libraryPanel(page).getByRole("button", { name: "New folder", exact: true }))
    : chooseEntry(
        page,
        tree.getByRole("button", { name: `Actions for ${inside}`, exact: true }),
        "New folder inside…",
      ));
  const dialog = page.getByRole("dialog", { name: "New folder" });
  await dialog.getByRole("textbox", { name: "Folder name" }).fill(name);
  await activate(dialog.getByRole("button", { name: "Save" }));
  await expect(dialog).toHaveCount(0);
};

/** Makes a new, empty chip from the library's "New chip" and waits until it is open. */
export const newChipByKeyboard = async (page: Page, name: string): Promise<void> => {
  await openLibraryByKeyboard(page);
  await activate(libraryPanel(page).getByRole("button", { name: "New chip", exact: true }));
  const dialog = page.getByRole("dialog", { name: "New chip" });
  await dialog.getByRole("textbox", { name: "Name" }).fill(name);
  await activate(dialog.getByRole("button", { name: "Save" }));
  await expect(dialog).toHaveCount(0);
  await expect(chipPath(page).locator('[aria-current="page"]')).toHaveText(name);
  await closeLibrarySheet(page);
};

/** Adds 1-bit pins of one direction in the Pins panel and names them in order. */
const addNamedPins = async (
  pins: Locator,
  direction: Direction,
  names: readonly string[],
): Promise<void> => {
  await addPins(pins, { direction, count: names.length }, activate);
  // The new rows take focus after the dialog closes. Name them after that.
  await expect(nameField(pins, direction, FIRST)).toBeFocused();
  for (const [index, name] of names.entries()) {
    await nameRow(nameField(pins, direction, index + FIRST), name);
  }
  await expect.poll(() => rowNames(pins, direction)).toEqual(names);
};

/** Adds and names the open chip's inputs and outputs in the Pins panel. */
export const addChipPins = async (
  page: Page,
  { inputs, outputs }: { readonly inputs: readonly string[]; readonly outputs: readonly string[] },
): Promise<void> => {
  const pins = await openPins(page, activate);
  await addNamedPins(pins, "input", inputs);
  await addNamedPins(pins, "output", outputs);
  await closePins(page, activate);
};

/**
 * Places `count` copies of a saved chip from the library. Enter on a chip row places one at the
 * centre of the view. `folders` are opened first, in order. Returns the new parts' names.
 */
export const placeFromLibrary = async (
  page: Page,
  {
    folders,
    chip,
    count,
  }: { readonly folders: readonly string[]; readonly chip: string; readonly count: number },
): Promise<readonly string[]> => {
  const before = await allPartNames(page);
  const tree = await openLibraryByKeyboard(page);
  for (const folder of folders) {
    const row = libraryRow(tree, folder);
    if ((await row.getAttribute("aria-expanded")) !== "true") {
      await activate(row);
      await expect(row).toHaveAttribute("aria-expanded", "true");
    }
  }
  const row = libraryRow(tree, chip);
  for (let placed = 1; placed <= count; placed += 1) {
    await activate(row);
    const countOf = async (): Promise<number> => {
      const names = await allPartNames(page);
      return names.length;
    };
    await expect.poll(countOf).toBe(before.length + placed);
  }
  await closeLibrarySheet(page);
  const after = await allPartNames(page);
  return after.filter((name) => !before.includes(name));
};

/** In the Pins panel: deletes OUT from its row menu, then adds SUM and CARRY and names them. */
export const replaceOutputs = async (page: Page): Promise<void> => {
  const pins = await openPins(page, activate);
  await chooseEntry(page, pins.getByRole("button", { name: "Actions for OUT" }), "Delete");
  await expect(pins.getByRole("grid", { name: "Outputs" })).toHaveCount(0);
  await addPins(pins, { direction: "output", count: SECOND }, activate);
  await expect(nameField(pins, "output", FIRST)).toBeFocused();
  await nameRow(nameField(pins, "output", FIRST), "SUM");
  await nameRow(nameField(pins, "output", SECOND), "CARRY");
  await expect(pins.getByRole("row", { name: "CARRY" })).toBeVisible();
  await closePins(page, activate);
};

/** Renames a chip from its row in the library. The keyboard opens the library and its menu. */
export const renameChipInLibrary = async (page: Page, from: string, to: string): Promise<void> => {
  const tree = await openLibraryByKeyboard(page);
  await chooseEntry(
    page,
    tree.getByRole("button", { name: `Actions for ${from}`, exact: true }),
    "Rename…",
  );
  const dialog = page
    .getByRole("dialog")
    .filter({ has: page.getByRole("textbox", { name: "Name" }) });
  await dialog.getByRole("textbox", { name: "Name" }).fill(to);
  await activate(dialog.getByRole("button", { name: "Save" }));
  await expect(dialog).toHaveCount(0);
  await closeLibrarySheet(page);
};

/**
 * Saves the open chip with the header's Save button. The first save asks for a folder: `folder`
 * picks one (for example "Arithmetic › Adders"), or the chip stays at the top level.
 */
export const saveOpenChip = async (page: Page, name: string, folder?: string): Promise<void> => {
  await activate(page.getByRole("button", { name: "Save", exact: true }));
  const dialog = page.getByRole("dialog", { name: `Save ${name}` });
  await expect(dialog).toBeVisible();
  if (folder !== undefined) {
    await chooseFolder(dialog, folder, activate);
  }
  await activate(dialog.getByRole("button", { name: "Save", exact: true }));
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: `Saved ${name}` })).toBeAttached();
};
