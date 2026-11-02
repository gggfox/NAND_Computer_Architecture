/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { createProject, expect, test, worldToPage } from "./support";

const MOVES = 10;
const BOTH_INPUTS = 2;
/** Enough presses to pass every drop position of the demo's two inputs. */
const MOST_DROP_STEPS = 4;

test.beforeEach(({ isMobile }) => {
  test.skip(isMobile, "The marquee is a mouse flow; touch has its own spec");
});

test("dragging one of several selected rows moves only that row", async ({ page }) => {
  await createProject(page);
  // A box around both inputs selects them on the canvas, so both rows are highlighted.
  const from = await worldToPage(page, { x: -20, y: -20 });
  const to = await worldToPage(page, { x: 80, y: 140 });
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: MOVES });
  await page.mouse.up();
  await expect(page.getByText("selected", { exact: true })).toHaveCount(BOTH_INPUTS);

  const inputs = page.getByRole("grid", { name: "Inputs" });
  // The handle offers the one row, not "2 selected items".
  const handle = inputs.getByRole("button", { name: "Drag A", exact: true });
  await handle.focus();
  await page.keyboard.press("Enter");
  await expect(inputs.locator("[data-dragging]")).toHaveCount(1);
  const focusedLabel = () =>
    page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  // Keyboard drag moves focus to a drop position once it has started.
  await expect.poll(focusedLabel).toMatch(/^Insert/u);
  for (let step = 0; step < MOST_DROP_STEPS; step += 1) {
    const label = await focusedLabel();
    if (label === "Insert after B") {
      break;
    }
    await page.keyboard.press("ArrowDown");
    await expect.poll(focusedLabel).not.toBe(label);
  }
  expect(await focusedLabel()).toBe("Insert after B");
  await page.keyboard.press("Enter");

  const rowNames = () =>
    inputs
      .getByRole("row")
      .evaluateAll((rows) => rows.map((row) => row.getAttribute("aria-label")));
  await expect.poll(rowNames).toEqual(["B", "A"]);
});
