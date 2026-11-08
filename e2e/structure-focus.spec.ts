import path from "node:path";

import type { Locator, Page } from "@playwright/test";

import { canvasHost, chipCenter, createProject, DEMO_PART, expect, test } from "./support";

/*
 * Focus management in the structure view (phase 6, spec 3.6). Each test uses the keyboard to act
 * and reads `document.activeElement` to see where focus went.
 */

const REGISTER_FILE = path.join(import.meta.dirname, "fixtures", "register-file.json");
const DEMO_WIRES = 3;

const region = (page: Page) => page.getByRole("region", { name: "Circuit structure" });

/** The label of the element that has focus; focus must be on exactly one element, never on `body`. */
const focusedLabel = async (page: Page): Promise<string | undefined> => {
  await expect(page.locator(":focus")).toHaveCount(1);
  return page.evaluate(() => {
    const active = document.activeElement;
    return active === document.body
      ? "BODY"
      : (active?.getAttribute("aria-label") ?? active?.textContent ?? undefined);
  });
};

const expectFocusOn = async (page: Page, label: string): Promise<void> => {
  await expect.poll(() => focusedLabel(page)).toBe(label);
};

/** Opens a menu button with the keyboard and picks an entry with the keyboard. */
const chooseEntry = async (page: Page, button: Locator, entry: string): Promise<void> => {
  await button.focus();
  await page.keyboard.press("Enter");
  const item = page.getByRole("menuitem", { name: entry, exact: true });
  await expect(item).toBeVisible();
  await item.press("Enter");
};

test("a dialog from a row gives focus back to that row's menu button", async ({ page }) => {
  await createProject(page);
  const wires = region(page).getByRole("button", { name: /^Actions for wire /u });
  const button = wires.first();
  const label = await button.getAttribute("aria-label");
  await chooseEntry(page, button, "Colour…");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expectFocusOn(page, label ?? "");
});

test("Delete on a part moves focus to the next part, then the previous one", async ({ page }) => {
  await createProject(page);
  const menu = (name: string) => region(page).getByRole("button", { name: `Actions for ${name}` });
  await chooseEntry(page, menu("Input A"), "Delete");
  await expect(menu("Input A")).toHaveCount(0);
  await expectFocusOn(page, "Actions for Input B");
  await chooseEntry(page, menu("Output OUT"), "Delete");
  await expect(menu("Output OUT")).toHaveCount(0);
  await expectFocusOn(page, "Actions for NAND gate 1");
});

test("Delete on the last wire moves focus to the Wires heading", async ({ page }) => {
  await createProject(page);
  const wires = region(page).getByRole("button", { name: /^Actions for wire /u });
  await expect(wires).toHaveCount(DEMO_WIRES);
  const second = await wires.nth(1).getAttribute("aria-label");
  // The first wire goes: focus moves to the next wire.
  await chooseEntry(page, wires.first(), "Delete");
  await expect(wires).toHaveCount(DEMO_WIRES - 1);
  await expectFocusOn(page, second ?? "");
  // The last wire goes: focus moves to the previous wire.
  const first = await wires.first().getAttribute("aria-label");
  await chooseEntry(page, wires.last(), "Delete");
  await expect(wires).toHaveCount(1);
  await expectFocusOn(page, first ?? "");
  // The only wire goes: focus moves to the section heading.
  await chooseEntry(page, wires.first(), "Delete");
  await expect(wires).toHaveCount(0);
  await expectFocusOn(page, "Wires");
});

test("Add part… moves focus to the new part's menu button", async ({ page }) => {
  await createProject(page);
  await chooseEntry(page, region(page).getByRole("button", { name: "Add part…" }), "NAND");
  await expect(region(page).getByText("NAND gate 2")).toBeVisible();
  await expectFocusOn(page, "Actions for NAND gate 2");
});

test("a wire made in Wire to… returns focus to the pin's menu button", async ({ page }) => {
  await createProject(page);
  await chooseEntry(page, region(page).getByRole("button", { name: "Add part…" }), "NAND");
  await expect(region(page).getByText("NAND gate 2")).toBeVisible();
  await region(page).getByRole("button", { name: "Pins of Input A" }).click();
  await chooseEntry(
    page,
    region(page).getByRole("button", { name: "Actions for A of Input A" }),
    "Wire to…",
  );
  const dialog = page.getByRole("dialog", { name: "Wire A of Input A to…" });
  await dialog.getByRole("searchbox", { name: "Search pins" }).fill("gate 2");
  await dialog.getByRole("option", { name: "a of NAND gate 2" }).click();
  await dialog.getByRole("button", { name: "Wire", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expectFocusOn(page, "Actions for A of Input A");
});

test("Array from the view returns focus to the part's button; from the canvas, to the canvas", async ({
  page,
}) => {
  await createProject(page);
  await chooseEntry(
    page,
    region(page).getByRole("button", { name: "Actions for NAND gate 1" }),
    "Array…",
  );
  await expect(page.getByRole("dialog", { name: "Array" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Array" })).toHaveCount(0);
  await expectFocusOn(page, "Actions for NAND gate 1");

  const nand = await chipCenter(page, DEMO_PART.nand);
  await page.mouse.click(nand.x, nand.y);
  await page.mouse.click(nand.x, nand.y, { button: "right" });
  await page.getByRole("menuitem", { name: "Array…" }).click();
  await expect(page.getByRole("dialog", { name: "Array" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Array" })).toHaveCount(0);
  await expect(canvasHost(page)).toBeFocused();
});

test("the skip link moves focus to the structure heading", async ({ page, browserName }) => {
  // Safari does not move focus to links with Tab unless the user turns that on.
  test.skip(browserName === "webkit", "WebKit skips links when Tab moves focus");
  await createProject(page);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to circuit structure" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expectFocusOn(page, "Circuit structure");
});

test("Accept moves focus to the next suggestion, Dismiss to Suggest wires", async ({ page }) => {
  await createProject(page);
  const chooserEvent = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import" }).click();
  const chooser = await chooserEvent;
  await chooser.setFiles(REGISTER_FILE);
  await expect(page.getByRole("heading", { level: 1, name: "Register file" })).toBeAttached();
  const structure = region(page);
  const suggest = structure.getByRole("button", { name: "Suggest wires" });
  await suggest.click();
  const accepts = structure.getByRole("button", { name: /^Accept wire /u });
  await expect(accepts.first()).toBeVisible();
  const count = await accepts.count();
  const second = await accepts.nth(1).getAttribute("aria-label");
  await accepts.first().focus();
  await page.keyboard.press("Enter");
  await expect(accepts).toHaveCount(count - 1);
  await expectFocusOn(page, second ?? "");
  await structure.getByRole("button", { name: "Dismiss" }).focus();
  await page.keyboard.press("Enter");
  await expect(accepts).toHaveCount(0);
  await expectFocusOn(page, "Suggest wires");
});
