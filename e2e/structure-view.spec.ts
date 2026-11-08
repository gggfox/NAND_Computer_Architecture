import {
  createProject,
  expect,
  exportedProject,
  GRID,
  nandPosition,
  NAND_AT,
  spoken,
  test,
} from "./support";

const DEMO_PARTS = 4;
const DEMO_WIRES = 3;
const NANDS_AFTER_ADD = 2;

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

test("Wire to… connects Input A to a new NAND through the dialog, by keyboard", async ({
  page,
}) => {
  await createProject(page);
  await page.getByRole("button", { name: "Add NAND" }).click();
  const region = page.getByRole("region", { name: "Circuit structure" });
  await expect(region.getByText("NAND gate 2")).toBeVisible();
  const exportedBefore = await exportedProject(page);
  const before = exportedBefore.project.chips[0]?.draft.wires.length ?? 0;

  await region.getByRole("button", { name: "Pins of Input A" }).click();
  await region.getByRole("button", { name: "Actions for A of Input A" }).click();
  await page.getByRole("menuitem", { name: "Wire to…" }).click();
  const dialog = page.getByRole("dialog", { name: "Wire A of Input A to…" });
  await expect(dialog).toBeVisible();

  // Enter with no pin chosen does not wire and does not close the dialog.
  const search = dialog.getByRole("searchbox", { name: "Search pins" });
  await search.press("Enter");
  await expect(dialog).toBeVisible();

  await search.fill("gate 2");
  await dialog.getByRole("option", { name: "a of NAND gate 2" }).click();
  await expect(dialog.getByText("Wire A of Input A to a of NAND gate 2")).toBeVisible();
  await dialog.getByRole("button", { name: "Wire", exact: true }).click();
  await expect(dialog).toBeHidden();

  const exportedAfter = await exportedProject(page);
  const wires = exportedAfter.project.chips[0]?.draft.wires ?? [];
  expect(wires).toHaveLength(before + 1);
});

test("Escape closes the Wire to… dialog without a wire", async ({ page }) => {
  await createProject(page);
  const region = page.getByRole("region", { name: "Circuit structure" });
  await region.getByRole("button", { name: "Pins of Input A" }).click();
  await region.getByRole("button", { name: "Actions for A of Input A" }).click();
  await page.getByRole("menuitem", { name: "Wire to…" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("Read outputs speaks every output once through the canvas region", async ({ page }) => {
  await createProject(page);
  await page.getByRole("button", { name: "Read outputs" }).click();
  await expect(spoken(page)).toHaveText("Outputs: OUT 1");
});

test("Add part… places a NAND, selects it and says so, by keyboard", async ({ page }) => {
  await createProject(page);
  const region = page.getByRole("region", { name: "Circuit structure" });
  await region.getByRole("button", { name: "Add part…" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu", { name: "Add part…" })).toBeVisible();
  await page.getByRole("menuitem", { name: "NAND", exact: true }).press("Enter");
  await expect(region.getByText("NAND gate 2")).toBeVisible();
  await expect(spoken(page)).toHaveText(/NAND gate 2 selected/u);
  const file = await exportedProject(page);
  const nands = file.project.chips[0]?.draft.instances.filter((item) => item.kind.type === "nand");
  expect(nands).toHaveLength(NANDS_AFTER_ADD);
});

test("Add part… adds an input pin", async ({ page }) => {
  await createProject(page);
  const region = page.getByRole("region", { name: "Circuit structure" });
  await region.getByRole("button", { name: "Add part…" }).click();
  await page.getByRole("menuitem", { name: "Input pin" }).click();
  await expect(region.getByRole("list").first().locator("> li")).toHaveCount(DEMO_PARTS + 1);
});
