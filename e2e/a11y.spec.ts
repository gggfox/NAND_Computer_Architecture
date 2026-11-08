/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { AxeBuilder } from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";

import {
  importLibrary,
  libraryRow,
  libraryToggle,
  openLibrary,
  placingBanner,
} from "./library-support";
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

/** The `data-theme` value for a theme's display name: "High contrast" becomes "high-contrast". */
const themeAttribute = (theme: string): string => theme.toLowerCase().replaceAll(" ", "-");

for (const theme of THEMES) {
  test(`index and project pages have no WCAG violations in the ${theme} theme`, async ({
    page,
  }) => {
    await createProject(page);
    await pickTheme(page, theme);
    // Axe must run on the picked theme, so check that the switch applied it.
    await expect(page.locator("html")).toHaveAttribute("data-theme", themeAttribute(theme));
    expect(await violations(page)).toEqual([]);

    // The choice persists and applies before first paint on the index too.
    await page.getByRole("link", { name: "All projects" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", themeAttribute(theme));
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
    const canvasMenu = page.getByRole("dialog", { name: "Add to canvas" });
    await expect(canvasMenu.getByRole("searchbox", { name: "Search chips" })).toBeFocused();
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
  test(`the Pins panel, its row menu, the Add dialog and a refused name have no WCAG violations in the ${theme} theme`, async ({
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
    const add = page.getByRole("dialog", { name: "Add inputs" });
    await expect(add).toBeVisible();
    expect(await violations(page)).toEqual([]);
    await add.getByRole("button", { name: "Cancel" }).click();
    await expect(add).toHaveCount(0);

    // A refused name shows its reason under the field.
    const name = page.getByRole("textbox", { name: "Name of input 1", exact: true });
    await name.fill("");
    await name.press("Enter");
    await expect(name).toHaveAccessibleDescription("A name can't be empty.");
    expect(await violations(page)).toEqual([]);
  });
}

/** Opens the library again if a dialog closed its sheet; on wide screens it stays open. */
const libraryOpen = async (page: Page): Promise<Locator> =>
  (await libraryToggle(page).getAttribute("aria-expanded")) === "true"
    ? page.getByRole("treegrid", { name: "Chips" })
    : openLibrary(page);

/** Opens a dialog with `open`, checks it with axe, and cancels it. */
const checkDialog = async (
  page: Page,
  { name, open }: { readonly name: string; readonly open: () => Promise<void> },
): Promise<void> => {
  await open();
  const dialog = page.getByRole("dialog", { name });
  await expect(dialog).toBeVisible();
  expect(await violations(page)).toEqual([]);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
};

/** Picks `item` from the "⋯" menu of the row `row`. */
const fromRowMenu = async (page: Page, row: string, item: string): Promise<void> => {
  const tree = await libraryOpen(page);
  await tree.getByRole("button", { name: `Actions for ${row}`, exact: true }).click();
  await page.getByRole("menuitem", { name: item }).click();
};

const ROW_DIALOGS = [
  { item: "Tags…", name: "Tags for Scratch" },
  { item: "Move to…", name: "Move Scratch" },
  { item: "Delete", name: "Delete Scratch?" },
] as const;

const TOOL_DIALOGS = [
  { button: "New chip", name: "New chip" },
  { button: "New folder", name: "New folder" },
] as const;

for (const theme of THEMES) {
  test(`the library, its row menu, dialogs and placing banner have no WCAG violations in the ${theme} theme`, async ({
    page,
  }) => {
    await importLibrary(page);
    await pickTheme(page, theme);
    // A column on wide screens, a sheet on phones.
    const tree = await openLibrary(page);
    expect(await violations(page)).toEqual([]);

    await tree.getByRole("button", { name: "Actions for Scratch", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "Move to…" })).toBeVisible();
    expect(await violations(page)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menuitem", { name: "Move to…" })).toHaveCount(0);

    for (const { item, name } of ROW_DIALOGS) {
      await checkDialog(page, { name, open: () => fromRowMenu(page, "Scratch", item) });
    }
    for (const { button, name } of TOOL_DIALOGS) {
      await checkDialog(page, {
        name,
        open: async () => {
          await libraryOpen(page);
          await page.getByRole("button", { name: button, exact: true }).click();
        },
      });
    }

    const open = await libraryOpen(page);
    await libraryRow(open, "Built-in").click();
    await libraryRow(open, "NAND").click();
    await expect(placingBanner(page, "NAND")).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });
}
