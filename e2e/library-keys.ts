import type { Locator, Page } from "@playwright/test";

import { expect } from "./support";

const MAX_PRESSES = 40;

const isFocused = (target: Locator): Promise<boolean> =>
  target.evaluate((element) => element === document.activeElement);

/** Presses `key` until `target` has focus; fails if it never gets there. */
export const pressUntilFocused = async (
  page: Page,
  key: string,
  target: Locator,
): Promise<void> => {
  for (let step = 0; step < MAX_PRESSES && !(await isFocused(target)); step += 1) {
    await page.keyboard.press(key);
  }
  await expect(target).toBeFocused();
};

/** Tabs to the button named `name` and presses Enter. */
export const pressButton = async (page: Page, scope: Locator, name: string): Promise<void> => {
  await pressUntilFocused(page, "Tab", scope.getByRole("button", { name, exact: true }));
  await page.keyboard.press("Enter");
};

const isOnRow = (tree: Locator): Promise<boolean> =>
  tree.evaluate((element) => {
    const focused = document.activeElement;
    return focused !== null && element.contains(focused) && focused.getAttribute("role") === "row";
  });

/** Tabs into the tree, steps out of a row's button onto its row, then arrows down to the row. */
export const focusRow = async (page: Page, tree: Locator, name: string): Promise<Locator> => {
  const row = tree.getByRole("row", { name, exact: true });
  const isInTree = (): Promise<boolean> =>
    tree.evaluate((element) => element.contains(document.activeElement));
  for (let step = 0; step < MAX_PRESSES && !(await isInTree()); step += 1) {
    await page.keyboard.press("Tab");
  }
  if (!(await isOnRow(tree))) {
    await page.keyboard.press("ArrowLeft");
  }
  if (!(await isFocused(row))) {
    await page.keyboard.press("Home");
    await pressUntilFocused(page, "ArrowDown", row);
  }
  await expect(row).toBeFocused();
  return row;
};

/** Opens the row's "⋯" menu from the keyboard (→ moves into the row) and picks `item`. */
export const rowMenu = async (
  page: Page,
  { tree, row, item }: { readonly tree: Locator; readonly row: string; readonly item: string },
): Promise<void> => {
  await focusRow(page, tree, row);
  await pressUntilFocused(
    page,
    "ArrowRight",
    tree.getByRole("button", { name: `Actions for ${row}`, exact: true }),
  );
  await page.keyboard.press("Enter");
  await pressUntilFocused(page, "ArrowDown", page.getByRole("menuitem", { name: item }));
  await page.keyboard.press("Enter");
};

/** Picks `option` in the dialog's select named `label`, from the keyboard. */
export const chooseOption = async (
  page: Page,
  dialog: Locator,
  { label, option }: { readonly label: string; readonly option: string },
): Promise<void> => {
  await pressUntilFocused(
    page,
    "Tab",
    dialog.getByRole("button", { name: new RegExp(label, "u") }),
  );
  await page.keyboard.press("Enter");
  // The list opens on the current choice; start from the top.
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("Home");
  await pressUntilFocused(
    page,
    "ArrowDown",
    page.getByRole("option", { name: option, exact: true }),
  );
  await page.keyboard.press("Enter");
};

/** Types into the dialog's field named `label`, reached with Tab. */
export const typeInto = async (
  page: Page,
  dialog: Locator,
  { label, text }: { readonly label: string; readonly text: string },
): Promise<void> => {
  await pressUntilFocused(page, "Tab", dialog.getByRole("textbox", { name: label }));
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(text);
};
