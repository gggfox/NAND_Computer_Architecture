/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import {
  canvasHost,
  chipCenter,
  createProject,
  DEMO_PART,
  expect,
  exportedProject,
  fingerDrag,
  NAND_AT,
  NAND_MOVED,
  nandPosition,
  spoken,
  test,
  touch,
  urlCamera,
  worldToPage,
} from "./support";
import type { TouchStep } from "./support";

/** Past the 500 ms long-press threshold. */
const LONG_PRESS_MS = 700;
/** Half the starting distance between the two pinching fingers. */
const PINCH_HALF = 40;
const PINCH_STEPS = 6;
const PINCH_STEP = 10;
const LEFT_FINGER = 1;
const RIGHT_FINGER = 2;
/** The NAND's `a` pin: on its left edge, a quarter of the way down. */
const PIN_A = { x: 160, y: 60 };
/** Empty canvas below the inputs and the NAND. */
const EMPTY = { x: 100, y: 160 };
/** How far the panning finger travels, in screen pixels. */
const PAN = { x: 60, y: 30 };

test.beforeEach(({ isMobile }, testInfo) => {
  test.skip(
    !isMobile && testInfo.project.name !== "tablet-safari",
    "Touch flows run on the phone and tablet projects",
  );
});

test("a tap on the NAND selects it and says so", async ({ page }) => {
  await createProject(page);
  const nand = await chipCenter(page, DEMO_PART.nand);
  await touch(page, [
    { type: "down", id: 1, at: nand },
    { type: "up", id: 1, at: nand },
  ]);
  await expect(spoken(page)).toHaveText(/NAND gate 1 selected/u);
});

test("a one-finger drag on the NAND moves it", async ({ page }) => {
  await createProject(page);
  const nand = await chipCenter(page, DEMO_PART.nand);
  await touch(page, fingerDrag(nand, { x: nand.x + NAND_MOVED.x - NAND_AT.x, y: nand.y }));
  await expect(spoken(page)).toHaveText(/Chips moved: 1/u);
  expect(nandPosition(await exportedProject(page))).toEqual(NAND_MOVED);
});

test("a long-press on the NAND opens its menu; Delete, then Undo", async ({ page }) => {
  await createProject(page);
  const nand = await chipCenter(page, DEMO_PART.nand);
  await touch(page, [
    { type: "down", id: 1, at: nand },
    { type: "wait", ms: LONG_PRESS_MS },
    { type: "up", id: 1, at: nand },
  ]);
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(page.getByText("NAND gate 1", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("NAND gate 1", { exact: true })).toBeVisible();
});

test("a long-press on pin a shows its card", async ({ page }) => {
  await createProject(page);
  const pin = await worldToPage(page, PIN_A);
  await touch(page, [
    { type: "down", id: 1, at: pin },
    { type: "wait", ms: LONG_PRESS_MS },
    { type: "up", id: 1, at: pin },
  ]);
  const card = page.locator("[aria-hidden=true]").filter({ hasText: "1 bit" });
  await expect(card).toBeVisible();
  await expect(card.locator("p").first()).toHaveText(/^a\s*1 bit$/u);
  await expect(card).toContainText(/Value: [01?]/u);
  await expect(spoken(page)).toHaveText(/Pin a of NAND gate 1/u);
});

test("a tap on pin a arms it for wiring instead of opening its card", async ({ page }) => {
  await createProject(page);
  const pin = await worldToPage(page, PIN_A);
  await touch(page, [
    { type: "down", id: 1, at: pin },
    { type: "up", id: 1, at: pin },
  ]);
  await expect(spoken(page)).toHaveText(/a of NAND gate 1 ready to wire/u);
  await expect(page.locator("[aria-hidden=true]").filter({ hasText: "1 bit" })).toHaveCount(0);
});

test("two fingers pinching apart zoom in, and the URL keeps the zoom", async ({ page }) => {
  await createProject(page);
  const before = urlCamera(page).zoom;
  const centre = await worldToPage(page, EMPTY);
  const finger = (id: number, half: number, type: "down" | "move" | "up"): TouchStep => ({
    type,
    id,
    at: { x: centre.x + (id === LEFT_FINGER ? -half : half), y: centre.y },
  });
  const widest = PINCH_HALF + PINCH_STEPS * PINCH_STEP;
  await touch(page, [
    finger(LEFT_FINGER, PINCH_HALF, "down"),
    finger(RIGHT_FINGER, PINCH_HALF, "down"),
    ...Array.from({ length: PINCH_STEPS }, (_unused, index) => {
      const half = PINCH_HALF + (index + 1) * PINCH_STEP;
      return [finger(LEFT_FINGER, half, "move"), finger(RIGHT_FINGER, half, "move")];
    }).flat(),
    finger(LEFT_FINGER, widest, "up"),
    finger(RIGHT_FINGER, widest, "up"),
  ]);
  await expect.poll(() => urlCamera(page).zoom).toBeGreaterThan(before);
});

test("with the Pan tool, a one-finger drag on empty canvas pans", async ({ page }) => {
  await createProject(page);
  const pan = page.getByRole("radio", { name: "Pan" });
  await pan.click();
  await expect(pan).toBeChecked();
  const before = urlCamera(page);
  const from = await worldToPage(page, EMPTY);
  await touch(page, fingerDrag(from, { x: from.x + PAN.x, y: from.y + PAN.y }));
  await expect
    .poll(() => {
      const after = urlCamera(page);
      return after.x !== before.x && after.y !== before.y;
    })
    .toBe(true);
});

/** `]` steps through the demo's parts in order: A, B, the NAND, then OUT. */
const STEPS_TO_OUT = 4;
/** At zoom 1 from world x 40, OUT's name starts about 40 px from a phone's right edge. */
const OUT_NEAR_RIGHT = "zoom=1&x=40&y=0";

test("renaming OUT keeps the popover on screen, with no sideways scroll", async ({ page }) => {
  await createProject(page);
  const url = new URL(page.url());
  url.search = OUT_NEAR_RIGHT;
  await page.goto(url.toString());
  await expect.poll(() => urlCamera(page)).toEqual({ zoom: 1, x: 40, y: 0 });
  await canvasHost(page).focus();
  for (let step = 0; step < STEPS_TO_OUT; step += 1) {
    await page.keyboard.press("]");
  }
  await expect(spoken(page)).toHaveText(/OUT.*selected/u);
  await page.keyboard.press("F2");
  const field = page.getByRole("textbox", { name: "Pin name" });
  await expect(field).toHaveValue("OUT");
  const box = await page.locator("form").filter({ has: field }).boundingBox();
  // A phone stretches its layout viewport to fit wide content, so compare with the device width.
  const width = page.viewportSize()?.width ?? 0;
  expect(box).not.toBeNull();
  expect(box?.x).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
  const layout = await page.evaluate(() => ({
    inner: window.innerWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(layout.inner).toBe(width);
  expect(layout.scroll).toBeLessThanOrEqual(layout.inner);
});
