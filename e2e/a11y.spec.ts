/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import {
  canvasHost,
  createProject,
  expect,
  pickTheme,
  spoken,
  test,
  THEMES,
  worldToPage,
} from "./support";
import { BUS, pointerFor, usesTouch } from "./wiring-support";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

const violations = async (page: Page) => {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return results.violations;
};

for (const theme of THEMES) {
  test(`index and project pages have no WCAG violations in the ${theme} theme`, async ({
    page,
  }) => {
    await createProject(page);
    await pickTheme(page, theme);
    expect(await violations(page)).toEqual([]);

    // The index has no theme picker; the choice persists and applies before first paint.
    await page.getByRole("link", { name: "All projects" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });
}

const STEPS_TO_NAND = 3;

for (const theme of THEMES) {
  test(`the canvas's selection, menu, pin card and help have no WCAG violations in the ${theme} theme`, async ({
    page,
  }) => {
    await createProject(page);
    await pickTheme(page, theme);
    const host = canvasHost(page);
    await host.focus();
    for (let step = 0; step < STEPS_TO_NAND; step += 1) {
      await page.keyboard.press("]");
    }
    await expect(spoken(page)).toHaveText(/NAND gate 1 selected/u);
    expect(await violations(page)).toEqual([]);

    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu", { name: "Chip actions" })).toBeVisible();
    expect(await violations(page)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(host).toBeFocused();

    await page.keyboard.press("p");
    await expect(page.getByText("1 bit")).toBeVisible();
    expect(await violations(page)).toEqual([]);
    await page.keyboard.press("Escape");

    await page.keyboard.press("?");
    await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });
}

for (const theme of THEMES) {
  test(`the pin rename popover, with its error, has no WCAG violations in the ${theme} theme`, async ({
    page,
  }) => {
    await createProject(page);
    await pickTheme(page, theme);
    await canvasHost(page).focus();
    // Input A is first in canvas order: `]` focuses it and F2 renames it.
    await page.keyboard.press("]");
    await page.keyboard.press("F2");
    const field = page.getByRole("textbox", { name: "Pin name" });
    await expect(field).toBeFocused();
    expect(await violations(page)).toEqual([]);
    await field.fill("");
    await field.press("Enter");
    await expect(field).toHaveAccessibleDescription("A name can't be empty.");
    expect(await violations(page)).toEqual([]);
  });
}

/** The middle of the demo's straight wire from Input B into the NAND's b, in world units. */
const WIRE_INTO_B = { x: 100, y: 100 };
/** In `bus.json`: the NAND's a and the 4-bit input D's pin. */
const BUS_NAND_A = { x: 160, y: 60 };
const BUS_PIN = { x: 40, y: 80 };

for (const theme of THEMES) {
  test(`the wire menu, wire colour dialog, canvas menu and bit picker have no WCAG violations in the ${theme} theme`, async ({
    isMobile,
    page,
  }, testInfo) => {
    const pointer = pointerFor(page, usesTouch(isMobile, testInfo));
    await createProject(page);
    await pickTheme(page, theme);
    const host = canvasHost(page);

    await pointer.tap(await worldToPage(page, WIRE_INTO_B));
    await host.focus();
    await page.keyboard.press("Enter");
    const wireMenu = page.getByRole("menu", { name: "Wire actions" });
    await expect(wireMenu.getByRole("menuitem").first()).toBeFocused();
    expect(await violations(page)).toEqual([]);

    await wireMenu.getByRole("menuitem", { name: "Colour…" }).click();
    const dialog = page.getByRole("dialog", { name: "Wire colour" });
    await expect(dialog).toBeVisible();
    expect(await violations(page)).toEqual([]);
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(host).toBeFocused();

    // Escape clears the wire selection, so Enter opens the canvas menu.
    await page.keyboard.press("Escape");
    await page.keyboard.press("Enter");
    const canvasMenu = page.getByRole("menu", { name: "Canvas actions" });
    await expect(canvasMenu.getByRole("menuitem").first()).toBeFocused();
    expect(await violations(page)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(host).toBeFocused();

    const chooserEvent = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Import" }).click();
    const chooser = await chooserEvent;
    await chooser.setFiles(BUS);
    await expect(page.getByRole("heading", { level: 1, name: "Bus" })).toBeAttached();
    await pointer.tap(await worldToPage(page, BUS_NAND_A));
    await expect(spoken(page)).toHaveText(/ready to wire/u);
    await pointer.tap(await worldToPage(page, BUS_PIN));
    await expect(
      page.getByRole("menu", { name: "Pick a bit" }).getByRole("menuitem").first(),
    ).toBeFocused();
    expect(await violations(page)).toEqual([]);
  });
}

for (const theme of THEMES) {
  test(`the Pins panel, its row menu and the Add dialog have no WCAG violations in the ${theme} theme`, async ({
    page,
  }) => {
    await createProject(page);
    await pickTheme(page, theme);
    // Inline and open from 640 px; on phones the button opens it in a sheet.
    const toggle = page.getByRole("button", { name: "Pins 3" });
    if ((await toggle.getAttribute("aria-expanded")) === "false") {
      await toggle.click();
      await expect(page.getByRole("dialog", { name: "Pins 3" })).toBeVisible();
    }
    const inputs = page.getByRole("grid", { name: "Inputs" });
    await expect(inputs.getByRole("row", { name: "B" })).toBeVisible();
    expect(await violations(page)).toEqual([]);

    await page.getByRole("button", { name: "Actions for A" }).click();
    await expect(page.getByRole("menuitem", { name: "Move down" })).toBeVisible();
    expect(await violations(page)).toEqual([]);
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Add inputs…" }).click();
    await expect(page.getByRole("dialog", { name: "Add inputs" })).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });
}
