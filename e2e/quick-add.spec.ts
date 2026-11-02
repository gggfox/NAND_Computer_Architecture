/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Locator, Page } from "@playwright/test";

import { importLibrary } from "./library-support";
import { openPins, rowNames } from "./pins-support";
import {
  canvasHost,
  createProject,
  expect,
  exportedProject,
  GRID,
  spoken,
  test,
  touch,
  worldToPage,
} from "./support";
import type { ExportedFile, Point } from "./support";

/** Where the quick-add opens first, in world units. */
const AT: Point = { x: 400, y: 240 };
/** Empty canvas well away from the Half adder placed at `AT`. */
const ELSEWHERE: Point = { x: 120, y: 80 };
/** A pinless "Half adder" is 160 × 40 (`bodySize` in `domain/chip-layout.ts`): its centre's offset. */
const HALF_ADDER_CENTRE: Point = { x: 80, y: 20 };
/** Past the 500 ms long-press threshold. */
const LONG_PRESS_MS = 700;
/** Empty canvas below the demo's inputs and NAND. */
const EMPTY: Point = { x: 100, y: 160 };

const quickAdd = (page: Page): Locator => page.getByRole("dialog", { name: "Add to canvas" });

const rightClick = async (page: Page, world: Point): Promise<Locator> => {
  const at = await worldToPage(page, world);
  await page.mouse.click(at.x, at.y, { button: "right" });
  const menu = quickAdd(page);
  await expect(menu.getByRole("searchbox", { name: "Search chips" })).toBeFocused();
  return menu;
};

/** The open chip "Main"'s draft parts. */
const mainParts = (
  file: ExportedFile,
): ExportedFile["project"]["chips"][number]["draft"]["instances"] =>
  file.project.chips.find((chip) => chip.name === "Main")?.draft.instances ?? [];

test("the quick-add places a searched chip at the press point, then offers it under Recent", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Right-click runs on desktop");
  await importLibrary(page);

  await rightClick(page, AT);
  await page.keyboard.type("half");
  await page.keyboard.press("Enter");
  await expect(quickAdd(page)).toHaveCount(0);
  const [placed, ...more] = mainParts(await exportedProject(page));
  expect(more).toEqual([]);
  expect(placed?.kind.type).toBe("custom");
  const centre = {
    x: (placed?.position.x ?? Number.NaN) + HALF_ADDER_CENTRE.x,
    y: (placed?.position.y ?? Number.NaN) + HALF_ADDER_CENTRE.y,
  };
  expect(Math.abs(centre.x - AT.x)).toBeLessThanOrEqual(GRID);
  expect(Math.abs(centre.y - AT.y)).toBeLessThanOrEqual(GRID);

  const menu = await rightClick(page, ELSEWHERE);
  const recent = menu.getByRole("group", { name: "Recent" });
  await expect(recent.getByRole("option").first()).toHaveText("Half adder");
  await expect(menu.getByRole("option", { name: "Tidy wires" })).toBeVisible();
  await menu.getByRole("option", { name: "Add output" }).click();
  await expect(quickAdd(page)).toHaveCount(0);
  await expect(spoken(page)).toHaveText(/Added output/u);
  expect(await rowNames(await openPins(page), "output")).toHaveLength(1);
});

test("from the keyboard: Enter opens the quick-add, arrows and Enter pick, Escape closes", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Keyboard flows run on desktop");
  await importLibrary(page);
  const host = canvasHost(page);
  await host.focus();
  await page.keyboard.press("Enter");
  const menu = quickAdd(page);
  await expect(menu.getByRole("searchbox", { name: "Search chips" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(host).toBeFocused();

  // No Recent yet, so Starred comes first: XOR, then the pins.
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(menu).toHaveCount(0);
  await expect(spoken(page)).toHaveText(/Added input/u);
  await expect(host).toBeFocused();
});

test("a long-press on empty canvas opens the quick-add", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Long-press runs on phones");
  await createProject(page);
  const at = await worldToPage(page, EMPTY);
  await touch(page, [
    { type: "down", id: 1, at },
    { type: "wait", ms: LONG_PRESS_MS },
    { type: "up", id: 1, at },
  ]);
  await expect(quickAdd(page).getByRole("option", { name: "Add input" })).toBeVisible();
});
