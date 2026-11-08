import { readFile } from "node:fs/promises";

import type { Locator, Page } from "@playwright/test";
import { z } from "zod";

import { PROJECT_URL, expect } from "./support";

/*
 * Helpers for the keyboard-only specs. They use no pointer at all. A control gets focus
 * with `focus()` and then a key press, so the test does not depend on how many Tab presses a
 * browser needs (WebKit skips links with Tab).
 */

/**
 * Focuses a control and presses `key` (Enter by default). The app moves focus by itself after
 * some actions (spec 3.6), a few frames later. The helper waits for those moves first, so they
 * cannot take focus away between the `focus()` and the key press.
 */
export const activate = async (control: Locator, key = "Enter"): Promise<void> => {
  await settleFocus(control.page());
  await control.focus();
  await control.page().keyboard.press(key);
};

/** The structure view's region. */
export const structureRegion = (page: Page): Locator =>
  page.getByRole("region", { name: "Circuit structure" });

/** Opens the index and creates the demo project with the keyboard. */
export const createProjectByKeyboard = async (page: Page): Promise<void> => {
  await page.goto("/");
  await activate(page.getByRole("button", { name: "New project" }));
  await expect(page).toHaveURL(PROJECT_URL);
  await expect(structureRegion(page)).toBeVisible();
};

/** Uses the skip link to reach the structure view, and checks that focus lands on its heading. */
export const skipToStructure = async (page: Page): Promise<void> => {
  await activate(page.getByRole("link", { name: "Skip to circuit structure" }));
  await expect(page.locator(":focus")).toHaveCount(1);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const active = document.activeElement;
        return active?.getAttribute("aria-label") ?? active?.textContent ?? "";
      }),
    )
    .toBe("Circuit structure");
};

const SETTLE_FRAMES = 3;
const MENU_TRIES = 3;
const MENU_MS = 1500;
/** How long to wait for the list to mark its first option as current. */
const CURRENT_MS = 750;

/** Waits some animation frames, so that a focus move that the app schedules can happen. */
export const settleFocus = (page: Page): Promise<void> =>
  page.evaluate(async (frames) => {
    for (let frame = 0; frame < frames; frame += 1) {
      const { promise, resolve } = Promise.withResolvers<void>();
      requestAnimationFrame(() => {
        resolve();
      });
      await promise;
    }
  }, SETTLE_FRAMES);

/** Opens a menu button with Enter, then picks an entry with Enter. */
export const chooseEntry = async (page: Page, button: Locator, entry: string): Promise<void> => {
  const item = page.getByRole("menuitem", { name: entry, exact: true });
  // A panel that has just opened can take focus a moment after its button is pressed.
  // Then the menu does not open. Try again, as a user would.
  for (let attempt = 1; attempt <= MENU_TRIES; attempt += 1) {
    await activate(button);
    const isOpen = await item.waitFor({ state: "visible", timeout: MENU_MS }).then(
      () => true,
      () => false,
    );
    if (isOpen) {
      break;
    }
    if (attempt === MENU_TRIES) {
      await expect(item).toBeVisible();
    }
    // Close only a menu that opened without the entry.
    // With no menu open, Escape closes the panel around the button (the library sheet on a phone).
    if ((await page.getByRole("menu").count()) > 0) {
      await page.keyboard.press("Escape");
    }
  }
  await item.press("Enter");
};

/** The names of every part in the Parts list, in list order. */
export const allPartNames = async (page: Page): Promise<readonly string[]> => {
  const labels = await structureRegion(page)
    .getByRole("button", { name: /^Actions for /u })
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label") ?? ""));
  return labels.map((label) => label.replace(/^Actions for /u, ""));
};

/**
 * Adds a built-in part from the "Add part…" menu and returns its name. The app then gives focus
 * to the new part's menu button. The helper waits for that, so the next key goes to the right
 * control.
 */
export const addPart = async (page: Page, entry: string): Promise<string> => {
  const before = await allPartNames(page);
  await chooseEntry(page, structureRegion(page).getByRole("button", { name: "Add part…" }), entry);
  const countOf = async (): Promise<number> => {
    const names = await allPartNames(page);
    return names.length;
  };
  await expect.poll(countOf).toBe(before.length + 1);
  const after = await allPartNames(page);
  const added = after.find((name) => !before.includes(name)) ?? "";
  await expect(
    structureRegion(page).getByRole("button", { name: `Actions for ${added}`, exact: true }),
  ).toBeFocused();
  return added;
};

/** A pin of a named part, as the structure view names them: "{pin} of {part}". */
export interface NamedPin {
  readonly part: string;
  readonly pin: string;
}

/** A wire from an output pin to an input pin, by names. */
export type NamedWire = readonly [NamedPin, NamedPin];

export const pinLabel = ({ part, pin }: NamedPin): string => `${pin} of ${part}`;

/** Opens the part's pin list, if it is closed. */
const openPinList = async (page: Page, part: string): Promise<void> => {
  const toggle = structureRegion(page).getByRole("button", {
    name: `Pins of ${part}`,
    exact: true,
  });
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await activate(toggle);
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  }
};

/** Makes one wire: opens "Wire to…" on the source pin, picks the target by name, and confirms. */
export const wireByNames = async (page: Page, [from, to]: NamedWire): Promise<void> => {
  await openPinList(page, from.part);
  const source = structureRegion(page).getByRole("button", {
    name: `Actions for ${pinLabel(from)}`,
    exact: true,
  });
  await chooseEntry(page, source, "Wire to…");
  const dialog = page.getByRole("dialog", { name: `Wire ${pinLabel(from)} to…` });
  await expect(dialog).toBeVisible();
  const search = dialog.getByRole("searchbox", { name: "Search pins" });
  await search.fill(pinLabel(to));
  const option = dialog.getByRole("option", { name: pinLabel(to), exact: true });
  await expect(option).toBeVisible();
  // The search field keeps focus. The list marks its current option with `data-focused`.
  // After a search the first option is usually current. If it is not, ArrowDown moves to it.
  const isCurrent = await expect(option)
    .toHaveAttribute("data-focused", "true", { timeout: CURRENT_MS })
    .then(
      () => true,
      () => false,
    );
  if (!isCurrent) {
    await search.press("ArrowDown");
    await expect(option).toHaveAttribute("data-focused", "true");
  }
  await search.press("Enter");
  await expect(dialog.getByText(`Wire ${pinLabel(from)} to ${pinLabel(to)}`)).toBeVisible();
  await activate(dialog.getByRole("button", { name: "Wire", exact: true }));
  await expect(dialog).toBeHidden();
  // The app gives focus back to the source pin's button. React Aria does it at once.
  // The app does it again two frames later (`returnFocus`). Wait for both moves.
  // Then the second move cannot take focus from the next wire's control.
  await expect(source).toBeFocused();
  await settleFocus(page);
  await expect(source).toBeFocused();
};

/** Deletes, from its wire menu, the one wire that ends on `to`. */
export const deleteWireInto = async (page: Page, to: NamedPin): Promise<void> => {
  const ending = new RegExp(`^Actions for wire Wire from .+ to ${pinLabel(to)}$`, "u");
  const button = structureRegion(page).getByRole("button", { name: ending });
  await expect(button).toHaveCount(1);
  await chooseEntry(page, button, "Delete");
  await expect(button).toHaveCount(0);
};

const DraftSchema = z.object({ wires: z.array(z.unknown()) });
const ChipSchema = z.object({ name: z.string(), draft: DraftSchema });
const WireCountSchema = z.object({ project: z.object({ chips: z.array(ChipSchema) }) });

/** Exports with the keyboard and returns how many wires the draft of chip `name` has. */
export const exportedWireCount = async (page: Page, name: string): Promise<number | undefined> => {
  await page.evaluate(() => {
    globalThis.scrollTo(0, 0);
  });
  const downloadEvent = page.waitForEvent("download");
  await activate(page.getByRole("button", { name: "Export" }));
  const download = await downloadEvent;
  const text = await readFile(await download.path(), "utf-8");
  const file = WireCountSchema.parse(JSON.parse(text));
  return file.project.chips.find((chip) => chip.name === name)?.draft.wires.length;
};

/** Sets an input switch with the Space key. */
export const setSwitchByKey = async (page: Page, name: string, on: boolean): Promise<void> => {
  const control = page.getByRole("switch", { name: `Input ${name}`, exact: true });
  if ((await control.isChecked()) !== on) {
    await activate(control, "Space");
  }
  await expect(control).toBeChecked({ checked: on });
};
