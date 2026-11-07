import { createProject, expect, test } from "./support";

const DEMO_WIRES = 3;

test("a wire menu opens by keyboard, Escape closes it, and Delete removes the wire", async ({
  page,
}) => {
  await createProject(page);
  const region = page.getByRole("region", { name: "Circuit structure" });
  const wires = region.getByRole("list").last().locator("> li");
  await expect(wires).toHaveCount(DEMO_WIRES);
  const button = wires.first().getByRole("button", { name: /^Actions for wire /u });
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(button).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu")).toBeVisible();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(wires).toHaveCount(DEMO_WIRES - 1);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(wires).toHaveCount(DEMO_WIRES);
});
