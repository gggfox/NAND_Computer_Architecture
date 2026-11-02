/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import path from "node:path";

import type { FileChooser, Page } from "@playwright/test";

import {
  addPins,
  badgeOf,
  closePins,
  nameField,
  nameRow,
  openPins,
  pinGrid,
  pinOrder,
  piecePosition,
  rowNames,
  savedPinOrder,
} from "./pins-support";
import {
  canvasHost,
  chipCenter,
  createProject,
  DEMO_PART,
  expect,
  exportedProject,
  exportedText,
  inputSwitch,
  pinPoint,
  spoken,
  test,
  worldToPage,
} from "./support";
import { pointerFor, usesTouch } from "./wiring-support";

const SAVED_CHIP = path.join(import.meta.dirname, "fixtures", "saved-chip.json");
const TWO = 2;
const THIRD = 3;
const FOURTH = 4;
/** Input B's piece, where the demo puts it, and the two new inputs stacked under it. */
const B_AT = { x: 0, y: 80 };
const C_AT = { x: 0, y: 160 };
const D_AT = { x: 0, y: 240 };
/** Somewhere clear of the demo's parts, to drag B to. */
const AWAY = { x: 100, y: 200 };
/** Input A's name, drawn just left of its body (world units). */
const LABEL_A = { x: -12, y: 20 };
const NAND_A = 0;
const REFUSED = "That input already has a wire.";
const EMPTY_NAME = "A name can't be empty.";

test("adding two inputs lists C and D under B, focuses C's name, and one Undo removes both", async ({
  page,
}) => {
  await createProject(page);
  const pins = await openPins(page);
  await addPins(pins, { direction: "input", count: TWO });
  await expect.poll(() => rowNames(pins, "input")).toEqual(["A", "B", "C", "D"]);
  await expect(nameField(pins, "input", THIRD)).toBeFocused();
  await closePins(page);

  const file = await exportedProject(page);
  expect(piecePosition(file, "B")).toEqual(B_AT);
  expect(piecePosition(file, "C")).toEqual(C_AT);
  expect(piecePosition(file, "D")).toEqual(D_AT);

  await page.getByRole("button", { name: "Undo" }).click();
  expect(pinOrder(await exportedProject(page))).toEqual(["A", "B", "OUT"]);
  await expect.poll(async () => rowNames(await openPins(page), "input")).toEqual(["A", "B"]);
});

test("Enter names a row and moves on to the next; Delete focuses a neighbour's name", async ({
  page,
}) => {
  await createProject(page);
  const pins = await openPins(page);
  await addPins(pins, { direction: "input", count: TWO });
  // Focus lands on the first new name a moment after the dialog closes; type once it has.
  await expect(nameField(pins, "input", THIRD)).toBeFocused();
  await nameRow(nameField(pins, "input", THIRD), "Cin");
  await expect(nameField(pins, "input", FOURTH)).toBeFocused();
  await nameRow(nameField(pins, "input", FOURTH), "Dee");
  await expect.poll(() => rowNames(pins, "input")).toEqual(["A", "B", "Cin", "Dee"]);
  await expect(page.getByRole("switch", { name: "Input Dee", exact: true })).toBeAttached();

  // The row after the deleted one takes focus; with none after, the one before.
  await pins.getByRole("button", { name: "Actions for Cin" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect.poll(() => rowNames(pins, "input")).toEqual(["A", "B", "Dee"]);
  await expect(nameField(pins, "input", THIRD)).toBeFocused();
  await expect(nameField(pins, "input", THIRD)).toHaveValue("Dee");
});

test("deleting the last pin gives focus to Add inputs", async ({ page }) => {
  await createProject(page);
  const pins = await openPins(page);
  for (const name of ["A", "B", "OUT"]) {
    await pins.getByRole("button", { name: `Actions for ${name}` }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
  }
  await expect(pins.getByRole("row")).toHaveCount(0);
  await expect(pins.getByRole("button", { name: "Add inputs…" })).toBeFocused();
});

test("an empty name in the panel is refused inline", async ({ page }) => {
  await createProject(page);
  const pins = await openPins(page);
  const field = nameField(pins, "input", 1);
  await nameRow(field, "");
  await expect(pins.getByText(EMPTY_NAME)).toBeVisible();
  await expect(field).toHaveAccessibleDescription(EMPTY_NAME);
  await expect(field).toBeFocused();
  await field.press("Escape");
  await expect(field).toHaveValue("A");
});

test("Move down reorders the rows, their badges and the exported pins", async ({ page }) => {
  await createProject(page);
  const pins = await openPins(page);
  await pins.getByRole("button", { name: "Actions for A" }).click();
  await page.getByRole("menuitem", { name: "Move down" }).click();
  await expect.poll(() => rowNames(pins, "input")).toEqual(["B", "A"]);
  const inputs = pinGrid(pins, "input");
  await expect(badgeOf(inputs.getByRole("row", { name: "B" }))).toHaveText("1");
  await expect(badgeOf(inputs.getByRole("row", { name: "A" }))).toHaveText(String(TWO));
  await expect(nameField(pins, "input", 1)).toHaveValue("B");
  await closePins(page);
  expect(pinOrder(await exportedProject(page))).toEqual(["B", "A", "OUT"]);
});

test("Tidy pins puts a dragged-away B back in the column", async ({ isMobile, page }, testInfo) => {
  const pointer = pointerFor(page, usesTouch(isMobile, testInfo));
  await createProject(page);
  await pointer.drag(await chipCenter(page, DEMO_PART.inputB), await worldToPage(page, AWAY));
  await expect.poll(async () => piecePosition(await exportedProject(page), "B")).not.toEqual(B_AT);

  const pins = await openPins(page);
  await pins.getByRole("button", { name: "Tidy pins" }).click();
  await closePins(page);
  await expect.poll(async () => piecePosition(await exportedProject(page), "B")).toEqual(B_AT);
});

test("tapping input A on the canvas flips its summary and panel switches", async ({
  isMobile,
  page,
}, testInfo) => {
  const pointer = pointerFor(page, usesTouch(isMobile, testInfo));
  await createProject(page);
  await pointer.tap(await chipCenter(page, DEMO_PART.inputA));
  await expect(inputSwitch(page, "Input A")).toBeChecked();
  const pins = await openPins(page);
  await expect(pins.getByRole("switch", { name: "Value of A" })).toBeChecked();
});

test("tapping A's label, typing and Enter renames it everywhere", async ({
  isMobile,
  page,
}, testInfo) => {
  const pointer = pointerFor(page, usesTouch(isMobile, testInfo));
  await createProject(page);
  await pointer.tap(await worldToPage(page, LABEL_A));
  const field = page.getByRole("textbox", { name: "Pin name" });
  await expect(field).toHaveValue("A");
  await field.fill("Go");
  await field.press("Enter");
  await expect(field).toHaveCount(0);
  await expect(page.getByRole("switch", { name: "Input Go", exact: true })).toBeAttached();
  await expect.poll(async () => rowNames(await openPins(page), "input")).toEqual(["Go", "B"]);
});

test("a refused tap says why on screen and in the live region", async ({
  isMobile,
  page,
}, testInfo) => {
  const pointer = pointerFor(page, usesTouch(isMobile, testInfo));
  await createProject(page);
  // The NAND's a already has A's wire; tapping it, then B's pin, is refused.
  await pointer.tap(await pinPoint(page, DEMO_PART.nand, NAND_A));
  await expect(spoken(page)).toHaveText(/ready to wire/u);
  await pointer.tap(await pinPoint(page, DEMO_PART.inputB, 0));
  await expect(spoken(page)).toContainText(REFUSED);
  await expect(
    canvasHost(page).locator('p[aria-hidden="true"]').filter({ hasText: REFUSED }),
  ).toBeVisible();
});

/** In `saved-chip.json`: the open chip `Main`, which places the saved chip `Inner`. */
const MAIN_ID = "00000000-0000-4000-8000-000000000301";
const INNER = 1;
const LAST_OPENED = /"lastOpenedChipId": "[^"]+"/u;

const importFile = async (page: Page, file: Parameters<FileChooser["setFiles"]>[0]) => {
  const chooserEvent = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import" }).click();
  const chooser = await chooserEvent;
  await chooser.setFiles(file);
  await expect(page.getByRole("heading", { level: 1, name: "Saved chip" })).toBeAttached();
};

/** Selects the one placed `Inner` from the keyboard. */
const selectInner = async (page: Page): Promise<void> => {
  await canvasHost(page).focus();
  await page.keyboard.press("]");
  await expect(spoken(page)).toHaveText(/Inner 1 selected/u);
};

test("a reorder inside a saved chip changes its draft; the placed chip keeps the saved order", async ({
  page,
}) => {
  await createProject(page);
  await importFile(page, SAVED_CHIP);
  await selectInner(page);
  await page.keyboard.press("Enter");
  await page.getByRole("menuitem", { name: "Look inside" }).click();
  await expect(canvasHost(page)).toHaveAccessibleName("Inner");

  const pins = await openPins(page);
  await pins.getByRole("button", { name: "Actions for X" }).click();
  await page.getByRole("menuitem", { name: "Move down" }).click();
  await expect.poll(() => rowNames(pins, "input")).toEqual(["Y", "X"]);
  await closePins(page);
  const file = await exportedProject(page);
  expect(pinOrder(file, INNER)).toEqual(["Y", "X"]);
  expect(savedPinOrder(file, INNER)).toEqual(["X", "Y"]);

  // No Save yet (Phase 4b): reopen the same project on `Main`, through export and import.
  const text = await exportedText(page);
  expect(text).toMatch(LAST_OPENED);
  const onMain = text.replace(LAST_OPENED, `"lastOpenedChipId": "${MAIN_ID}"`);
  await importFile(page, {
    name: "saved-chip.json",
    mimeType: "application/json",
    buffer: Buffer.from(onMain),
  });
  await expect(canvasHost(page)).toHaveAccessibleName("Main");
  // P reads the placed chip's pins in order: still X then Y, from the saved version.
  await selectInner(page);
  await page.keyboard.press("p");
  await expect(spoken(page)).toHaveText(/^Pin X of Inner 1/u);
  await page.keyboard.press("p");
  await expect(spoken(page)).toHaveText(/^Pin Y of Inner 1/u);
});
