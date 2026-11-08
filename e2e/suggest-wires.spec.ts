/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import path from "node:path";

import type { Page } from "@playwright/test";

import {
  canvasHost,
  createProject,
  expect,
  exportedProject,
  spoken,
  test,
  touch,
  worldToPage,
} from "./support";
import type { ExportedFile, Point } from "./support";
import { instanceIds, usesTouch, wiresOf } from "./wiring-support";

/*
 * Suggest wires (phase 5c) on a register file: four `Reg` chips, a 4-bit `d` and a `clk` with no
 * wires. Ghosts are proposals only; the export shows a wire once, and only once, it is accepted.
 */

const REGISTER_FILE = path.join(import.meta.dirname, "fixtures", "register-file.json");
const SUGGESTIONS = 20;
const REGS = 4;
const BITS = 4;
const ONE_REG = 5;
const LONG_PRESS_MS = 700;
/** The first `Reg`'s body, to select it. */
const REG_MIDDLE: Point = { x: 550, y: 100 };
/**
 * The first `Reg`'s `clk` ghost ends (420, 220), (480, 220); this is the middle of that last stretch,
 * 30 px from the pin, so well inside the canvas of the smallest viewport.
 */
const GHOST_MIDDLE: Point = { x: 450, y: 220 };
/** Empty canvas between the pin pieces and the Regs. */
const EMPTY: Point = { x: 250, y: 700 };

const bar = (page: Page) => page.getByRole("toolbar", { name: "Suggested wires" });
const suggestButton = (page: Page) =>
  page
    .getByRole("toolbar", { name: "Editor tools" })
    .getByRole("button", { name: "Suggest wires" });

const importFixture = async (page: Page): Promise<void> => {
  await createProject(page);
  const chooserEvent = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import" }).click();
  const chooser = await chooserEvent;
  await chooser.setFiles(REGISTER_FILE);
  await expect(page.getByRole("heading", { level: 1, name: "Register file" })).toBeAttached();
};

const wireCount = async (page: Page): Promise<number> =>
  wiresOf(await exportedProject(page)).length;

/** Every wire runs `clk` to a `Reg`'s `clk`, or a bit of `d` to that `Reg`'s `d<bit>`, in order. */
const expectRegisterWires = (file: ExportedFile): void => {
  const wires = wiresOf(file);
  expect(wires).toHaveLength(SUGGESTIONS);
  const [d, clk, ...rest] = instanceIds(file);
  const regs = rest.slice(BITS);
  const chip = file.project.chips.find((item) => item.name === "Reg");
  const pins = chip?.saved?.pins ?? [];
  const pinId = (name: string) => pins.find((pin) => pin.name === name)?.id;
  expect(regs).toHaveLength(REGS);
  for (const reg of regs) {
    const into = wires.filter((wire) => wire.to.instanceId === reg);
    expect(into).toHaveLength(BITS + 1);
    const clock = into.find((wire) => wire.to.pin === pinId("clk"));
    expect(clock?.from.instanceId).toBe(clk);
    for (let bit = 0; bit < BITS; bit += 1) {
      const wire = into.find((item) => item.to.pin === pinId(`d${String(bit)}`));
      expect(wire?.from.instanceId).toBe(d);
      expect(wire?.from.bit).toBe(bit);
    }
    expect(into.some((wire) => wire.to.pin === pinId("load"))).toBe(false);
  }
};

test("suggest, check nothing is applied, accept all, undo and redo", async ({
  isMobile,
  page,
}, testInfo) => {
  test.skip(usesTouch(isMobile, testInfo), "The touch flow below covers this with taps");
  await importFixture(page);
  await suggestButton(page).click();
  await expect(bar(page).getByText("Suggested wires: 20")).toBeVisible();
  await expect(spoken(page)).toHaveText(/Wires suggested: 20/u);
  expect(await wireCount(page)).toBe(0);

  await bar(page).getByRole("button", { name: "Accept all" }).click();
  await expect(spoken(page)).toHaveText(/Wires accepted: 20/u);
  await expect(bar(page)).toHaveCount(0);
  expectRegisterWires(await exportedProject(page));

  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => wireCount(page)).toBe(0);
  await page.getByRole("button", { name: "Redo" }).click();
  await expect.poll(() => wireCount(page)).toBe(SUGGESTIONS);
});

test("nothing to suggest once every wire is accepted", async ({ isMobile, page }, testInfo) => {
  test.skip(usesTouch(isMobile, testInfo), "Mouse flow");
  await importFixture(page);
  await suggestButton(page).click();
  await bar(page).getByRole("button", { name: "Accept all" }).click();
  await expect(spoken(page)).toHaveText(/Wires accepted: 20/u);
  await suggestButton(page).click();
  await expect(spoken(page)).toHaveText(/No wires to suggest/u);
  await expect(bar(page)).toHaveCount(0);
  expect(await wireCount(page)).toBe(SUGGESTIONS);
});

test("with one Reg selected, Shift+W suggests only its five wires", async ({
  isMobile,
  page,
}, testInfo) => {
  test.skip(usesTouch(isMobile, testInfo), "Needs the keyboard");
  await importFixture(page);
  const at = await worldToPage(page, REG_MIDDLE);
  await page.mouse.click(at.x, at.y);
  await expect(spoken(page)).toHaveText(/selected/u);
  await page.keyboard.press("Shift+W");
  await expect(bar(page).getByText(`Suggested wires: ${String(ONE_REG)}`)).toBeVisible();
  expect(await wireCount(page)).toBe(0);
});

test("tapping the middle of a ghost accepts it alone; Dismiss keeps that one wire", async ({
  isMobile,
  page,
}, testInfo) => {
  test.skip(usesTouch(isMobile, testInfo), "Mouse flow");
  await importFixture(page);
  await suggestButton(page).click();
  await expect(bar(page).getByText("Suggested wires: 20")).toBeVisible();
  const at = await worldToPage(page, GHOST_MIDDLE);
  await page.mouse.click(at.x, at.y);
  await expect(bar(page).getByText("Suggested wires: 19")).toBeVisible();
  expect(await wireCount(page)).toBe(1);

  await bar(page).getByRole("button", { name: "Dismiss" }).click();
  await expect(spoken(page)).toHaveText(/Suggestions dismissed/u);
  await expect(bar(page)).toHaveCount(0);
  expect(await wireCount(page)).toBe(1);
});

test("any other edit clears the ghosts and adds no wire", async ({ isMobile, page }, testInfo) => {
  test.skip(usesTouch(isMobile, testInfo), "Needs the keyboard");
  await importFixture(page);
  const at = await worldToPage(page, REG_MIDDLE);
  await page.mouse.click(at.x, at.y);
  await page.keyboard.press("Shift+W");
  await expect(bar(page)).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(bar(page)).toHaveCount(0);
  expect(await wireCount(page)).toBe(0);
});

test("from the keyboard alone: Shift+W, n, n, Enter accepts one; Escape dismisses", async ({
  isMobile,
  page,
}, testInfo) => {
  test.skip(usesTouch(isMobile, testInfo), "Needs the keyboard");
  await importFixture(page);
  await canvasHost(page).focus();
  await page.keyboard.press("Shift+W");
  await expect(spoken(page)).toHaveText(/Wires suggested: 20/u);
  await page.keyboard.press("n");
  await page.keyboard.press("n");
  await page.keyboard.press("Enter");
  await expect(spoken(page)).toHaveText(/Wires accepted: 1/u);
  expect(await wireCount(page)).toBe(1);
  await expect(bar(page).getByText("Suggested wires: 19")).toBeVisible();
  // The export took the focus to its button; Escape goes to the canvas.
  await canvasHost(page).focus();
  await page.keyboard.press("Escape");
  await expect(spoken(page)).toHaveText(/Suggestions dismissed/u);
  await expect(bar(page)).toHaveCount(0);
  expect(await wireCount(page)).toBe(1);
});

test("on a touch screen: long-press, pick Suggest wires, tap Accept all", async ({
  isMobile,
  page,
}, testInfo) => {
  test.skip(!usesTouch(isMobile, testInfo), "Touch projects only");
  await importFixture(page);
  const at = await worldToPage(page, EMPTY);
  await touch(page, [
    { type: "down", id: 1, at },
    { type: "wait", ms: LONG_PRESS_MS },
    { type: "up", id: 1, at },
  ]);
  await page
    .getByRole("dialog", { name: "Add to canvas" })
    .getByRole("option", { name: "Suggest wires" })
    .click();
  await expect(bar(page).getByText("Suggested wires: 20")).toBeVisible();
  expect(await wireCount(page)).toBe(0);
  await bar(page).getByRole("button", { name: "Accept all" }).tap();
  await expect(spoken(page)).toHaveText(/Wires accepted: 20/u);
  expect(await wireCount(page)).toBe(SUGGESTIONS);
});

const structure = (page: Page) => page.getByRole("region", { name: "Circuit structure" });

test("in the structure view: suggest, accept one wire, then accept all", async ({ page }) => {
  await importFixture(page);
  await structure(page).getByRole("button", { name: "Suggest wires" }).click();
  const list = structure(page).getByRole("region", { name: "Suggested wires: 20" });
  await expect(list.getByRole("listitem")).toHaveCount(SUGGESTIONS);
  // The ghosts are proposals: the export has no wire yet.
  expect(await wireCount(page)).toBe(0);

  await list
    .getByRole("button", { name: /^Accept wire /u })
    .first()
    .click();
  await expect.poll(() => wireCount(page)).toBe(1);
  await expect(structure(page).getByRole("region", { name: "Suggested wires: 19" })).toBeVisible();

  await structure(page).getByRole("button", { name: "Accept all" }).click();
  await expect.poll(() => wireCount(page)).toBe(SUGGESTIONS);
  await expect(structure(page).getByRole("region", { name: /^Suggested wires/u })).toHaveCount(0);
  expectRegisterWires(await exportedProject(page));
});

test("in the structure view: Dismiss clears the list and keeps the circuit", async ({ page }) => {
  await importFixture(page);
  await structure(page).getByRole("button", { name: "Suggest wires" }).click();
  await expect(structure(page).getByRole("button", { name: "Accept all" })).toBeVisible();
  await structure(page).getByRole("button", { name: "Dismiss" }).click();
  await expect(structure(page).getByRole("region", { name: /^Suggested wires/u })).toHaveCount(0);
  expect(await wireCount(page)).toBe(0);
});
