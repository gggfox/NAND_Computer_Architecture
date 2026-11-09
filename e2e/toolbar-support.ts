import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

/*
 * The editor toolbar's tools. A phone (< 640 px) keeps the frequent tools in the toolbar, puts the
 * others in a More tools menu, and moves the zoom controls to the canvas corner.
 */

/** How a helper presses a control: a click by default, or a tap or a key in a touch or keyboard flow. */
export type PressControl = (control: Locator) => Promise<void>;

const click: PressControl = (control) => control.click();

/** The editor's toolbar. */
export const editorToolbar = (page: Page): Locator =>
  page.getByRole("toolbar", { name: "Editor tools" });

/**
 * Presses the editor tool `name`. On a phone the less frequent tools are in the toolbar's More
 * tools menu, so this opens the menu first.
 */
export const pressEditorTool = async (
  page: Page,
  name: string,
  press: PressControl = click,
): Promise<void> => {
  const more = editorToolbar(page).getByRole("button", { name: "More tools" });
  if (await more.isVisible()) {
    await press(more);
    await press(page.getByRole("menuitem", { name, exact: true }));
    return;
  }
  await press(editorToolbar(page).getByRole("button", { name, exact: true }));
};

/**
 * Presses the zoom control `name` (Zoom out, Zoom in or Fit). On a phone these are behind the
 * canvas corner's Zoom button; Escape then closes them again.
 */
export const pressZoomTool = async (
  page: Page,
  name: "Zoom out" | "Zoom in" | "Fit",
  press: PressControl = click,
): Promise<void> => {
  const corner = page.getByRole("button", { name: "Zoom", exact: true });
  if (await corner.isVisible()) {
    await press(corner);
    await press(page.getByRole("dialog", { name: "Zoom" }).getByRole("button", { name }));
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Zoom" })).toHaveCount(0);
    return;
  }
  await press(editorToolbar(page).getByRole("button", { name, exact: true }));
};
