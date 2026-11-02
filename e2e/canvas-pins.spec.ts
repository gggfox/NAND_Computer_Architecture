/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import {
  canvasHost,
  chipCenter,
  createProject,
  DEMO_PART,
  expect,
  inputSwitch,
  test,
  worldToPage,
} from "./support";

/** Input A's name, drawn just left of its body (world units). */
const LABEL_A = { x: -12, y: 20 };

test.beforeEach(({ isMobile }) => {
  test.skip(isMobile, "Mouse flows run on the desktop projects; touch has its own spec");
});

test("clicking input A's body toggles it both ways", async ({ page }) => {
  await createProject(page);
  const body = await chipCenter(page, DEMO_PART.inputA);
  await page.mouse.click(body.x, body.y);
  await expect(inputSwitch(page, "Input A")).toBeChecked();
  await page.mouse.click(body.x, body.y);
  await expect(inputSwitch(page, "Input A")).not.toBeChecked();
});

test("clicking A's name renames it in place; empty is refused, Escape cancels", async ({
  page,
}) => {
  await createProject(page);
  const label = await worldToPage(page, LABEL_A);
  await page.mouse.click(label.x, label.y);
  const field = page.getByRole("textbox", { name: "Pin name" });
  await expect(field).toBeFocused();
  await expect(field).toHaveValue("A");

  await field.fill("");
  await field.press("Enter");
  await expect(page.getByText("A name can't be empty.")).toBeVisible();
  await expect(field).toHaveAccessibleDescription("A name can't be empty.");
  await expect(field).toBeFocused();

  await field.press("Escape");
  await expect(field).toHaveCount(0);
  await expect(canvasHost(page)).toBeFocused();

  await page.mouse.click(label.x, label.y);
  await field.fill("Go");
  await field.press("Enter");
  await expect(field).toHaveCount(0);
  await expect(canvasHost(page)).toBeFocused();
  // The rename stuck: the popover reopens on the new name.
  await page.mouse.click(label.x, label.y);
  await expect(field).toHaveValue("Go");
});

test("F2 renames the focused input piece", async ({ page }) => {
  await createProject(page);
  const body = await chipCenter(page, DEMO_PART.inputB);
  await page.mouse.click(body.x, body.y);
  await canvasHost(page).press("F2");
  await expect(page.getByRole("textbox", { name: "Pin name" })).toHaveValue("B");
});
