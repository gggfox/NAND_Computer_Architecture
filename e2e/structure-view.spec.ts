import {
  createProject,
  expect,
  exportedProject,
  GRID,
  nandPosition,
  NAND_AT,
  test,
} from "./support";

const DEMO_PARTS = 4;
const DEMO_WIRES = 3;

test("the structure view lists four parts and three wires, with pins behind a button", async ({
  page,
}) => {
  await createProject(page);
  const region = page.getByRole("region", { name: "Circuit structure" });
  await expect(region.getByRole("heading", { name: "Parts" })).toBeVisible();
  await expect(region.getByRole("heading", { name: "Wires" })).toBeVisible();
  await expect(region.getByRole("list").first().locator("> li")).toHaveCount(DEMO_PARTS);
  await expect(region.getByRole("list").last().locator("> li")).toHaveCount(DEMO_WIRES);
  const toggle = region.getByRole("button", { name: "Pins of NAND gate 1" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(region.getByText("a, input, width 1", { exact: false })).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(region.getByText("a, input, width 1, A of Input A")).toBeVisible();
});

test("the skip link is the first Tab stop in main and moves focus to the structure heading", async ({
  page,
  browserName,
}) => {
  // Safari does not move focus to links with Tab unless the user turns that on.
  test.skip(browserName === "webkit", "WebKit skips links when Tab moves focus");
  await createProject(page);
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to circuit structure" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Circuit structure" })).toBeFocused();
});

test("the part menu opens by keyboard, moves the part one step right and gives focus back", async ({
  page,
}) => {
  await createProject(page);
  const button = page.getByRole("button", { name: "Actions for NAND gate 1" });
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu", { name: "Actions for NAND gate 1" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(button).toBeFocused();
  await page.keyboard.press("Space");
  await page.getByRole("menuitem", { name: "Move right" }).click();
  const moved = nandPosition(await exportedProject(page));
  expect(moved?.x).toBe(NAND_AT.x + GRID);
  expect(moved?.y).toBe(NAND_AT.y);
});
