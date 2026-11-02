/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Locator, Page } from "@playwright/test";

import { importLibrary, libraryRow, openLibrary } from "./library-support";
import { canvasHost, exportedProject, expect, GRID, test, worldToPage } from "./support";
import type { ExportedFile, Point } from "./support";

/** The layout's breakpoint: below it the library is a sheet. */
const WIDE = 640;
/** Past `LONG_PRESS_MS` (400 ms) in `domain/drag-intent.ts`. */
const LONG_PRESS = 700;
const MOVES = 10;
const HALF = 0.5;
/** Where the Half adder is dropped, in world units. */
const DROP_WORLD: Point = { x: 300, y: 200 };
/** A pinless "Half adder" is 160 × 40 (`bodySize` in `domain/chip-layout.ts`): its centre's offset. */
const HALF_ADDER_CENTRE: Point = { x: 80, y: 20 };

const centreOf = async (target: Locator): Promise<Point> => {
  const box = await target.boundingBox();
  if (box === null) {
    throw new Error("The element is not visible");
  }
  return { x: box.x + box.width * HALF, y: box.y + box.height * HALF };
};

const between = (from: Point, to: Point, share: number): Point => ({
  x: from.x + (to.x - from.x) * share,
  y: from.y + (to.y - from.y) * share,
});

/** A mouse drag from `from` to `to` in even moves; `beforeRelease` runs with the button still down. */
const mouseDrag = async (
  page: Page,
  { from, to }: { readonly from: Point; readonly to: Point },
  beforeRelease: () => Promise<void> = async () => {},
): Promise<void> => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let step = 1; step <= MOVES; step += 1) {
    const at = between(from, to, step / MOVES);
    await page.mouse.move(at.x, at.y);
  }
  await beforeRelease();
  await page.mouse.up();
};

/** Real touches through CDP (Chromium only): the synthetic `touch` helper can't drive a list. */
const cdpTouch = async (page: Page) => {
  const cdp = await page.context().newCDPSession(page);
  const send = (type: "touchStart" | "touchMove" | "touchEnd", at?: Point) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: at === undefined ? [] : [{ x: at.x, y: at.y }],
    });
  return {
    press: (at: Point) => send("touchStart", at),
    move: (at: Point) => send("touchMove", at),
    release: () => send("touchEnd"),
  };
};

/** The open chip "Main"'s draft parts. */
const mainParts = (
  file: ExportedFile,
): ExportedFile["project"]["chips"][number]["draft"]["instances"] => {
  const main = file.project.chips.find((chip) => chip.name === "Main");
  if (main === undefined) {
    throw new Error("The project has no Main chip");
  }
  return main.draft.instances;
};

const desktopMouse = ({ isMobile }: { readonly isMobile: boolean }): void => {
  test.skip(isMobile, "Mouse drags run on desktop");
};

const phoneTouch = ({
  browserName,
  isMobile,
}: {
  readonly browserName: string;
  readonly isMobile: boolean;
}): void => {
  test.skip(!isMobile, "Touch drags run on phones");
  test.skip(
    browserName !== "chromium",
    "Playwright's WebKit can't inject real touches (no CDP); checked by hand on iOS",
  );
};

test("a chip dragged onto the canvas is placed where it was dropped", async ({
  page,
  isMobile,
}) => {
  desktopMouse({ isMobile });
  await importLibrary(page);
  const tree = await openLibrary(page);
  await libraryRow(tree, "Arithmetic").click();
  await libraryRow(tree, "Adders").click();
  const to = await worldToPage(page, DROP_WORLD);
  await mouseDrag(page, { from: await centreOf(libraryRow(tree, "Half adder")), to });

  const placed = mainParts(await exportedProject(page));
  expect(placed).toHaveLength(1);
  const [instance] = placed;
  expect(instance?.kind.type).toBe("custom");
  const centre = {
    x: (instance?.position.x ?? Number.NaN) + HALF_ADDER_CENTRE.x,
    y: (instance?.position.y ?? Number.NaN) + HALF_ADDER_CENTRE.y,
  };
  expect(Math.abs(centre.x - DROP_WORLD.x)).toBeLessThanOrEqual(GRID);
  expect(Math.abs(centre.y - DROP_WORLD.y)).toBeLessThanOrEqual(GRID);
});

test("a chip dragged onto a folder row is filed there", async ({ page, isMobile }) => {
  desktopMouse({ isMobile });
  await importLibrary(page);
  const tree = await openLibrary(page);
  await libraryRow(tree, "Logic").click();
  await mouseDrag(page, {
    from: await centreOf(libraryRow(tree, "XOR")),
    to: await centreOf(libraryRow(tree, "Arithmetic")),
  });
  await expect(libraryRow(tree, "XOR")).toHaveCount(0);
  await libraryRow(tree, "Arithmetic").click();
  await expect(libraryRow(tree, "XOR")).toHaveAttribute("aria-level", "2");
});

test("a folder dragged onto its own subfolder is refused, and nothing moves", async ({
  page,
  isMobile,
}) => {
  desktopMouse({ isMobile });
  await importLibrary(page);
  const tree = await openLibrary(page);
  await libraryRow(tree, "Arithmetic").click();
  const ghost = page.locator("[data-drag-ghost]");
  await mouseDrag(
    page,
    {
      from: await centreOf(libraryRow(tree, "Arithmetic")),
      to: await centreOf(libraryRow(tree, "Adders")),
    },
    async () => {
      await expect(ghost).toContainText("Arithmetic");
      await expect(ghost).toHaveClass(/refused/u);
    },
  );
  await expect(ghost).toHaveCount(0);
  await expect(libraryRow(tree, "Adders")).toHaveAttribute("aria-level", "2");
  await expect(libraryRow(tree, "Arithmetic")).toHaveAttribute("aria-level", "1");
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
});

test("a long-press drags NAND out of the tucked sheet onto the canvas", async ({
  page,
  browserName,
  isMobile,
}) => {
  phoneTouch({ browserName, isMobile });
  expect(page.viewportSize()?.width ?? WIDE).toBeLessThan(WIDE);
  await importLibrary(page);
  const to = await centreOf(canvasHost(page));
  const tree = await openLibrary(page);
  await libraryRow(tree, "Built-in").click();
  const from = await centreOf(libraryRow(tree, "NAND"));
  const finger = await cdpTouch(page);
  await finger.press(from);
  await page.waitForTimeout(LONG_PRESS);
  for (let step = 1; step <= MOVES; step += 1) {
    await finger.move(between(from, to, step / MOVES));
  }
  const sheet = page.getByRole("dialog", { name: "Chip library" });
  await expect(sheet).toBeHidden();
  await finger.release();

  await expect(page.getByRole("button", { name: "Library", exact: true })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  const placed = mainParts(await exportedProject(page));
  expect(placed.filter((instance) => instance.kind.type === "nand")).toHaveLength(1);
});

test("a long-press held still on a row opens its menu", async ({ page, browserName, isMobile }) => {
  phoneTouch({ browserName, isMobile });
  await importLibrary(page);
  const tree = await openLibrary(page);
  await libraryRow(tree, "Logic").click();
  const finger = await cdpTouch(page);
  await finger.press(await centreOf(libraryRow(tree, "XOR")));
  await page.waitForTimeout(LONG_PRESS);
  await finger.release();
  await expect(page.getByRole("menuitem", { name: "Move to…" })).toBeVisible();
  await expect(tree.getByText("Armed", { exact: true })).toHaveCount(0);
});

test("a touch drag dropped off the canvas brings the sheet back", async ({
  page,
  browserName,
  isMobile,
}) => {
  phoneTouch({ browserName, isMobile });
  await importLibrary(page);
  const canvas = await canvasHost(page).boundingBox();
  const tree = await openLibrary(page);
  await libraryRow(tree, "Built-in").click();
  const from = await centreOf(libraryRow(tree, "NAND"));
  // Above the canvas: the toolbar, which takes no drop.
  const to = { x: from.x, y: Math.max(1, (canvas?.y ?? 0) - 1) };
  const finger = await cdpTouch(page);
  await finger.press(from);
  await page.waitForTimeout(LONG_PRESS);
  for (let step = 1; step <= MOVES; step += 1) {
    await finger.move(between(from, to, step / MOVES));
  }
  const sheet = page.getByRole("dialog", { name: "Chip library" });
  await expect(sheet).toBeHidden();
  await finger.release();

  await expect(sheet).toBeVisible();
  await expect(libraryRow(tree, "NAND")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  expect(mainParts(await exportedProject(page))).toHaveLength(0);
});
