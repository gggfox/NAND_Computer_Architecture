/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import {
  aboveSheet,
  centreOf,
  desktopMouse,
  LONG_PRESS,
  longPressDrag,
  cdpTouch,
  mainParts,
  mouseDrag,
  phoneTouch,
} from "./library-drag-support";
import { importLibrary, libraryRow, openLibrary } from "./library-support";
import { canvasHost, exportedProject, expect, GRID, test, worldToPage } from "./support";
import type { Point } from "./support";

/** The layout's breakpoint: below it the library is a sheet. */
const WIDE = 640;
/** Where the Half adder is dropped, in world units. */
const DROP_WORLD: Point = { x: 300, y: 200 };
/** A pinless "Half adder" is 160 × 40 (`bodySize` in `domain/chip-layout.ts`): its centre's offset. */
const HALF_ADDER_CENTRE: Point = { x: 80, y: 20 };

test("a chip dragged onto the canvas is placed where it was dropped", async ({
  page,
  isMobile,
}) => {
  desktopMouse({ isMobile });
  await importLibrary(page);
  const tree = await openLibrary(page);
  await libraryRow(tree, "Arithmetic").click();
  await libraryRow(tree, "Adders").click();
  // The library scrolls inside its column, which the chip header leaves shorter (D9).
  await libraryRow(tree, "Half adder").scrollIntoViewIfNeeded();
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

test("a long-press drags NAND up out of the sheet, which tucks away, onto the canvas", async ({
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
  const via = await aboveSheet(page, from.x);
  const finger = await longPressDrag(page, { from, via, to });
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
  // Up out of the sheet, then onto the toolbar above the canvas, which takes no drop.
  const to = { x: from.x, y: Math.max(1, (canvas?.y ?? 0) - 1) };
  const via = await aboveSheet(page, from.x);
  const finger = await longPressDrag(page, { from, via, to });
  const sheet = page.getByRole("dialog", { name: "Chip library" });
  await expect(sheet).toBeHidden();
  await finger.release();

  await expect(sheet).toBeVisible();
  await expect(libraryRow(tree, "NAND")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  expect(mainParts(await exportedProject(page))).toHaveLength(0);
});

test("a drag cut short when the tree goes away leaves the sheet untucked", async ({
  page,
  browserName,
  isMobile,
}) => {
  phoneTouch({ browserName, isMobile });
  const phone = page.viewportSize() ?? { width: WIDE - 1, height: WIDE };
  await importLibrary(page);
  const to = await centreOf(canvasHost(page));
  const tree = await openLibrary(page);
  await libraryRow(tree, "Built-in").click();
  const from = await centreOf(libraryRow(tree, "NAND"));
  const via = await aboveSheet(page, from.x);
  const finger = await longPressDrag(page, { from, via, to });
  const sheet = page.getByRole("dialog", { name: "Chip library" });
  await expect(sheet).toBeHidden();
  // Crossing 640 px swaps the sheet for the column, which unmounts the dragged row's tree.
  await page.setViewportSize({ width: WIDE + WIDE, height: phone.height });
  await expect(sheet).toHaveCount(0);
  await finger.release();
  await page.setViewportSize(phone);

  await expect(page.getByRole("button", { name: "Library", exact: true })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(sheet).toBeVisible();
  await expect(libraryRow(tree, "NAND")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toHaveCount(0);
});

test("on a phone, a long-press drags XOR onto a folder row in the open sheet", async ({
  page,
  browserName,
  isMobile,
}) => {
  phoneTouch({ browserName, isMobile });
  await importLibrary(page);
  const tree = await openLibrary(page);
  await libraryRow(tree, "Logic").click();
  const arithmetic = libraryRow(tree, "Arithmetic");
  const finger = await longPressDrag(page, {
    from: await centreOf(libraryRow(tree, "XOR")),
    to: await centreOf(arithmetic),
  });
  // Over the sheet, the sheet stays in view so its folder rows can take the drop.
  const sheet = page.getByRole("dialog", { name: "Chip library" });
  await expect(sheet).toBeVisible();
  await finger.release();

  await expect(sheet).toBeVisible();
  await expect(libraryRow(tree, "XOR")).toHaveCount(0);
  await expect(async () => {
    if ((await arithmetic.getAttribute("aria-expanded")) !== "true") {
      await arithmetic.click();
    }
    await expect(libraryRow(tree, "XOR")).toHaveAttribute("aria-level", "2", { timeout: 500 });
  }).toPass();
  await page.getByRole("button", { name: "Close" }).click();
  expect(mainParts(await exportedProject(page))).toHaveLength(0);
});
