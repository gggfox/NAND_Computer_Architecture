import type { Locator, Page } from "@playwright/test";

import { expect } from "./support";
import type { ExportedFile } from "./support";

/** Helpers for the Pins panel specs: open it, add pins, name rows, read rows and pin order. */

export type Direction = "input" | "output";

/** How a spec presses a control: a click on the desktop, a tap where the spec plays a phone. */
export type Press = (control: Locator) => Promise<void>;

export const click: Press = (control) => control.click();
export const tap: Press = (control) => control.tap();

const PANEL_BUTTON = /^Pins \d+$/u;

const panelButton = (page: Page): Locator => page.getByRole("button", { name: PANEL_BUTTON });

/** The phone sheet, when it is open. */
const sheet = (page: Page): Locator => page.getByRole("dialog", { name: PANEL_BUTTON });

/**
 * Opens the panel where it is closed (on phones the button opens a sheet; from 640 px it is inline
 * and open already) and returns what its controls are looked up in.
 */
export const openPins = async (page: Page, press: Press = click): Promise<Locator> => {
  const toggle = panelButton(page);
  if ((await toggle.getAttribute("aria-expanded")) === "false") {
    await press(toggle);
    await expect(sheet(page)).toBeVisible();
    return sheet(page);
  }
  return page.locator("section").filter({ has: toggle });
};

/** Closes the phone sheet, so the canvas and toolbar take presses again; inline, nothing. */
export const closePins = async (page: Page, press: Press = click): Promise<void> => {
  if ((await sheet(page).count()) > 0) {
    await press(sheet(page).getByRole("button", { name: "Close", exact: true }));
    await expect(sheet(page)).toHaveCount(0);
  }
};

const gridName = (direction: Direction): string => (direction === "input" ? "Inputs" : "Outputs");

export const pinGrid = (scope: Locator, direction: Direction): Locator =>
  scope.getByRole("grid", { name: gridName(direction) });

/** The rows' names, top to bottom, as the panel lists them. */
export const rowNames = (scope: Locator, direction: Direction): Promise<readonly string[]> =>
  pinGrid(scope, direction)
    .getByRole("row")
    .evaluateAll((rows) => rows.map((row) => row.getAttribute("aria-label") ?? ""));

/** The name field of the `ordinal`th (1-based) pin of a direction. */
export const nameField = (scope: Locator, direction: Direction, ordinal: number): Locator =>
  scope.getByRole("textbox", { name: `Name of ${direction} ${String(ordinal)}`, exact: true });

/** Adds `count` 1-bit pins through the Add dialog, as one edit. */
export const addPins = async (
  scope: Locator,
  { direction, count }: { readonly direction: Direction; readonly count: number },
  press: Press = click,
): Promise<void> => {
  const page = scope.page();
  await press(scope.getByRole("button", { name: `Add ${direction}s…` }));
  const dialog = page.getByRole("dialog", { name: `Add ${direction}s` });
  await expect(dialog).toBeVisible();
  for (let added = 1; added < count; added += 1) {
    await press(dialog.getByRole("button", { name: /^Increase/u }));
  }
  await expect(dialog.getByRole("textbox", { name: "How many" })).toHaveValue(String(count));
  await press(dialog.getByRole("button", { name: "Add", exact: true }));
  await expect(dialog).toHaveCount(0);
};

/** Types a name into a row's field and saves it with Enter, as the panel's list naming does. */
export const nameRow = async (field: Locator, name: string): Promise<void> => {
  await field.fill(name);
  await field.press("Enter");
};

/** The open chip's pins in an exported file, by name, in `circuit.pins` order. */
export const pinOrder = (file: ExportedFile, chip = 0): readonly string[] =>
  file.project.chips[chip]?.draft.pins.map((pin) => pin.name) ?? [];

/** A row's number badge, which follows the panel order. */
export const badgeOf = (row: Locator): Locator =>
  row.locator('span[aria-hidden="true"]').filter({ hasText: /^\d+$/u });

/** A chip's saved pins, by name, in order. */
export const savedPinOrder = (file: ExportedFile, chip: number): readonly string[] =>
  file.project.chips[chip]?.saved?.pins.map((pin) => pin.name) ?? [];

/** The world position of the pin piece named `name` in chip `chip` (the first by default). */
export const piecePosition = (file: ExportedFile, name: string, chip = 0) => {
  const draft = file.project.chips[chip]?.draft;
  const pinId = draft?.pins.find((pin) => pin.name === name)?.id;
  return pinId === undefined
    ? undefined
    : draft?.instances.find((item) => item.kind.pinId === pinId)?.position;
};
