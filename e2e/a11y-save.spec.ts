import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { closePins, openPins } from "./pins-support";
import {
  importSaveFlow,
  moreButton,
  moveNand,
  openChip,
  saveButton,
  unsavedDot,
} from "./save-support";
import { expect, pickTheme, test, THEMES } from "./support";

/*
 * Axe on the save flow's surfaces (Task 8): the chip header with its unsaved dot, its ⋯ menu, the
 * discard and save confirmations, and the first save's folder dialog. `a11y.spec.ts` holds the rest;
 * this file is separate to keep both under the 300-line limit.
 */

/** The same WCAG 2.2 AA tags as `a11y.spec.ts`. */
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

const violations = async (page: Page) => {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return results.violations;
};

for (const theme of THEMES) {
  test(`the chip header, its menu and the save dialogs have no WCAG violations in the ${theme} theme`, async ({
    page,
  }) => {
    await importSaveFlow(page);
    await pickTheme(page, theme);
    await moveNand(page);
    await expect(unsavedDot(page)).toBeAttached();
    expect(await violations(page)).toEqual([]);

    await moreButton(page).click();
    const discard = page.getByRole("menuitem", { name: "Discard changes…" });
    await expect(discard).toBeVisible();
    expect(await violations(page)).toEqual([]);
    await discard.click();
    const discardDialog = page.getByRole("dialog", { name: "Discard changes to Half adder?" });
    await expect(discardDialog).toBeVisible();
    expect(await violations(page)).toEqual([]);
    await discardDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(discardDialog).toHaveCount(0);

    // Removing B drops Full adder's wire into it, so the save asks first.
    const pins = await openPins(page);
    await pins.getByRole("button", { name: "Actions for B" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await closePins(page);
    await saveButton(page).click();
    const saveDialog = page.getByRole("dialog", { name: "Save Half adder?" });
    await expect(saveDialog.getByRole("listitem").first()).toBeVisible();
    expect(await violations(page)).toEqual([]);
    await saveDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(saveDialog).toHaveCount(0);

    await openChip(page, "Scratch");
    await saveButton(page).click();
    const firstSave = page.getByRole("dialog", { name: "Save Scratch" });
    await expect(firstSave).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });
}
