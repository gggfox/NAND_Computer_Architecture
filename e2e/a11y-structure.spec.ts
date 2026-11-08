import path from "node:path";

import { AxeBuilder } from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";

import { closePins, openPins } from "./pins-support";
import { createProject, expect, pickTheme, test, THEMES } from "./support";

/*
 * Axe on the structure view (phase 6), in every theme. The states are: pins collapsed and
 * expanded, a part, pin and wire menu, the Add part… menu, the Wire to… dialog with a refusal,
 * the suggested list with a row focused, a focused heading and the focused skip link.
 */

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const REGISTER_FILE = path.join(import.meta.dirname, "fixtures", "register-file.json");

const violations = async (page: Page) => {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return results.violations;
};

const region = (page: Page) => page.getByRole("region", { name: "Circuit structure" });

/** Adds one 4-bit output pin through the Pins panel; the structure view lists it as a part. */
const addWideOutput = async (page: Page): Promise<void> => {
  const pins = await openPins(page);
  await pins.getByRole("button", { name: "Add outputs…" }).click();
  const add = page.getByRole("dialog", { name: "Add outputs" });
  await add.getByRole("button", { name: /Width/u }).click();
  await page.getByRole("option", { name: "4 bits" }).click();
  await add.getByRole("button", { name: "Add", exact: true }).click();
  await expect(add).toHaveCount(0);
  await closePins(page);
};

/** Opens "Wire to…" on `pin` and picks bit 0 of the wide output; returns the dialog. */
const wireToWideBit = async (page: Page, pin: string): Promise<Locator> => {
  const part = pin.split(" of ")[1] ?? "";
  const toggle = region(page).getByRole("button", { name: `Pins of ${part}` });
  if ((await toggle.getAttribute("aria-expanded")) === "false") {
    await toggle.click();
  }
  await region(page)
    .getByRole("button", { name: `Actions for ${pin}` })
    .click();
  await page.getByRole("menuitem", { name: "Wire to…" }).click();
  const dialog = page.getByRole("dialog", { name: `Wire ${pin} to…` });
  await dialog.getByRole("option", { name: "OUT1[4] of Output OUT1" }).click();
  await dialog.getByRole("button", { name: "Wire", exact: true }).click();
  return dialog;
};

for (const theme of THEMES) {
  test(`the structure view and its menus have no WCAG violations in the ${theme} theme`, async ({
    page,
  }) => {
    await createProject(page);
    await pickTheme(page, theme);

    // Pins collapsed, then one part expanded.
    await expect(region(page).getByRole("heading", { name: "Parts" })).toBeVisible();
    expect(await violations(page)).toEqual([]);
    await region(page).getByRole("button", { name: "Pins of NAND gate 1" }).click();
    await expect(region(page).getByText("a, input, width 1", { exact: false })).toBeVisible();
    expect(await violations(page)).toEqual([]);

    // A heading with focus (the headings are focusable).
    const heading = region(page).getByRole("heading", { name: "Parts" });
    await heading.focus();
    await expect(heading).toBeFocused();
    expect(await violations(page)).toEqual([]);

    // The part menu.
    await region(page).getByRole("button", { name: "Actions for NAND gate 1" }).click();
    await expect(page.getByRole("menu", { name: "Actions for NAND gate 1" })).toBeVisible();
    expect(await violations(page)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toBeHidden();

    // The Add part… menu.
    await region(page).getByRole("button", { name: "Add part…" }).click();
    await expect(page.getByRole("menu", { name: "Add part…" })).toBeVisible();
    expect(await violations(page)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toBeHidden();

    // The wire menu.
    await region(page)
      .getByRole("button", { name: /^Actions for wire /u })
      .first()
      .click();
    await expect(page.getByRole("menu")).toBeVisible();
    expect(await violations(page)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toBeHidden();

    // The pin menu.
    await region(page).getByRole("button", { name: "Pins of Input A" }).click();
    await region(page).getByRole("button", { name: "Actions for A of Input A" }).click();
    await expect(page.getByRole("menuitem", { name: "Wire to…" })).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });
}

for (const theme of THEMES) {
  test(`the Wire to… dialog, with a refusal, has no WCAG violations in the ${theme} theme`, async ({
    page,
  }) => {
    await createProject(page);
    await pickTheme(page, theme);
    await region(page).getByRole("button", { name: "Pins of Input A" }).click();
    await region(page).getByRole("button", { name: "Actions for A of Input A" }).click();
    await page.getByRole("menuitem", { name: "Wire to…" }).click();
    const dialog = page.getByRole("dialog", { name: "Wire A of Input A to…" });
    await expect(dialog).toBeVisible();
    expect(await violations(page)).toEqual([]);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // A refusal needs a pin that is listed but has a driven bit: a 4-bit output with bit 0 wired.
    await addWideOutput(page);
    await wireToWideBit(page, "A of Input A");
    const refused = await wireToWideBit(page, "B of Input B");
    await expect(refused.getByRole("alert")).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });
}

for (const theme of THEMES) {
  test(`the suggested list and the skip link have no WCAG violations in the ${theme} theme`, async ({
    page,
  }) => {
    await createProject(page);
    const chooserEvent = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Import" }).click();
    const chooser = await chooserEvent;
    await chooser.setFiles(REGISTER_FILE);
    await expect(page.getByRole("heading", { level: 1, name: "Register file" })).toBeAttached();
    await pickTheme(page, theme);

    await region(page).getByRole("button", { name: "Suggest wires" }).click();
    const list = region(page).getByRole("region", { name: "Suggested wires: 20" });
    await expect(list).toBeVisible();
    await list
      .getByRole("button", { name: /^Accept wire /u })
      .first()
      .focus();
    expect(await violations(page)).toEqual([]);

    // Focus the first link by script: Tab does not reach links in Safari unless the user allows it.
    const skip = page.getByRole("link", { name: "Skip to circuit structure" });
    await skip.focus();
    await expect(skip).toBeFocused();
    expect(await violations(page)).toEqual([]);
  });
}
