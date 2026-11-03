/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import {
  chipCenter,
  createProject,
  DEMO_PART,
  expect,
  exportedProject,
  inputSwitch,
  NAND_AT,
  NAND_MOVED,
  nandPosition,
  test,
  urlCamera,
  worldToPage,
} from "./support";

const MOVES = 10;
const BOTH_INPUTS = 2;
const WHEEL = 100;

test.beforeEach(({ isMobile }) => {
  test.skip(isMobile, "Mouse flows run on the desktop projects; touch has its own spec");
});

test("dragging the NAND two grid steps moves it, and Undo puts it back", async ({ page }) => {
  await createProject(page);
  const start = await chipCenter(page, DEMO_PART.nand);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + NAND_MOVED.x - NAND_AT.x, start.y, { steps: MOVES });
  await page.mouse.up();

  expect(nandPosition(await exportedProject(page))).toEqual(NAND_MOVED);

  await page.getByRole("button", { name: "Undo" }).click();
  expect(nandPosition(await exportedProject(page))).toEqual(NAND_AT);
  await expect(page.getByRole("button", { name: "Redo" })).toBeEnabled();
});

test("the wheel pans up and down, and with Shift sideways", async ({ page }) => {
  await createProject(page);
  const start = await chipCenter(page, DEMO_PART.nand);
  await page.mouse.move(start.x, start.y);
  const before = urlCamera(page);
  await page.mouse.wheel(0, WHEEL);
  await expect.poll(() => urlCamera(page).y).not.toBe(before.y);
  expect(urlCamera(page).x).toBe(before.x);

  // With Shift a browser may report the scroll as deltaY (as sent) or move it to deltaX.
  for (const [deltaX, deltaY] of [
    [0, WHEEL],
    [WHEEL, 0],
  ] as const) {
    const last = urlCamera(page);
    await page.keyboard.down("Shift");
    await page.mouse.wheel(deltaX, deltaY);
    await page.keyboard.up("Shift");
    await expect.poll(() => urlCamera(page).x).not.toBe(last.x);
    expect(urlCamera(page).y).toBe(last.y);
  }
});

test("a middle-button drag pans, even when it starts on the NAND", async ({ page }) => {
  await createProject(page);
  await expect(page.getByRole("radio", { name: "Pan" })).toBeHidden();
  const before = urlCamera(page);
  const start = await chipCenter(page, DEMO_PART.nand);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(start.x + NAND_MOVED.x - NAND_AT.x, start.y, { steps: MOVES });
  await page.mouse.up({ button: "middle" });

  await expect.poll(() => urlCamera(page).x).not.toBe(before.x);
  expect(nandPosition(await exportedProject(page))).toEqual(NAND_AT);
});

test("right-click on the NAND deletes it from the menu, and Undo brings it back", async ({
  page,
}) => {
  await createProject(page);
  const nand = await chipCenter(page, DEMO_PART.nand);
  await page.mouse.click(nand.x, nand.y, { button: "right" });
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(page.getByText("NAND gate 1", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("NAND gate 1", { exact: true })).toBeVisible();
  await expect(page.getByText("selected", { exact: true })).toHaveCount(0);
});

test("a box around both inputs selects them for Delete, and Undo restores them", async ({
  page,
}) => {
  await createProject(page);
  // From empty canvas above-left of Input A to below-right of Input B, short of the NAND.
  const from = await worldToPage(page, { x: -20, y: -20 });
  const to = await worldToPage(page, { x: 80, y: 140 });
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: MOVES });
  await page.mouse.up();
  await expect(page.getByText("selected", { exact: true })).toHaveCount(BOTH_INPUTS);

  await page
    .getByRole("toolbar", { name: "Editor tools" })
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(inputSwitch(page, "Input A")).toHaveCount(0);
  await expect(inputSwitch(page, "Input B")).toHaveCount(0);
  await expect(page.getByText("NAND gate 1", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(inputSwitch(page, "Input A")).toHaveCount(1);
  await expect(inputSwitch(page, "Input B")).toHaveCount(1);
  // Undo restores the parts, not the selection.
  await expect(page.getByText("selected", { exact: true })).toHaveCount(0);
});
