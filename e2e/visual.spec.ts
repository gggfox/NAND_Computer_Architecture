/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { importLibrary, libraryRow, openLibrary } from "./library-support";
import {
  createProject,
  expect,
  output,
  pickTheme,
  setInputs,
  test,
  THEMES,
  worldToPage,
} from "./support";

const slug = (theme: string): string => theme.toLowerCase().replaceAll(" ", "-");

/*
 * Canvas baselines are Linux-only: generate them with `pnpm e2e:visual:docker --update-snapshots`
 * (or in CI). `pnpm e2e` excludes @visual, so a missing baseline never fails it.
 */
for (const theme of THEMES) {
  test(
    `demo canvas with A = 1 and B = 1 in the ${theme} theme`,
    { tag: "@visual" },
    async ({ page }) => {
      await createProject(page);
      await pickTheme(page, theme);
      await setInputs(page, true, true);
      await expect(output(page)).toHaveText("Output OUT: 0");
      // The main canvas; its screenshot includes the minimap drawn over its corner.
      await expect(page.locator("canvas").first()).toHaveScreenshot(`demo-${slug(theme)}.png`);
    },
  );
}

const DEMO_INPUTS = 2;

test("demo with the Pins panel open", { tag: "@visual" }, async ({ page }) => {
  await createProject(page);
  await expect(page.getByRole("grid", { name: "Inputs" }).getByRole("row")).toHaveCount(
    DEMO_INPUTS,
  );
  // The whole editor: the canvas, its pin badges and the panel beside it.
  await expect(page).toHaveScreenshot("demo-pins-panel.png");
});

test("the library open with Arithmetic expanded", { tag: "@visual" }, async ({ page }) => {
  await importLibrary(page);
  const tree = await openLibrary(page);
  await libraryRow(tree, "Arithmetic").click();
  await expect(libraryRow(tree, "Adders")).toBeVisible();
  // The pointer would leave a hover style on the row it clicked.
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot("library-panel.png");
});

/** Empty canvas where the quick-add opens, in world units. */
const QUICK_ADD_AT = { x: 400, y: 240 };

test("the quick-add menu", { tag: "@visual" }, async ({ page }) => {
  await importLibrary(page);
  const at = await worldToPage(page, QUICK_ADD_AT);
  await page.mouse.click(at.x, at.y, { button: "right" });
  const menu = page.getByRole("dialog", { name: "Add to canvas" });
  await expect(menu.getByRole("searchbox", { name: "Search chips" })).toBeFocused();
  await expect(page).toHaveScreenshot("quick-add.png");
});
