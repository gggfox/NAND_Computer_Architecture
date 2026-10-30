import {
  createProject,
  expect,
  inputSwitch,
  output,
  PROJECT_URL,
  setInputs,
  test,
} from "./support";

const NAND_TRUTH_TABLE = [
  { a: false, b: false, out: 1 },
  { a: false, b: true, out: 1 },
  { a: true, b: false, out: 1 },
  { a: true, b: true, out: 0 },
] as const;

test("the demo project follows the NAND truth table and survives a reload", async ({ page }) => {
  await createProject(page);

  for (const row of NAND_TRUTH_TABLE) {
    await setInputs(page, row.a, row.b);
    await expect(page.getByText(/Output: 1|Output: 0/u)).toHaveText(`Output: ${String(row.out)}`);
  }

  const url = page.url();
  await page.reload();
  await expect(page).toHaveURL(url);
  await expect(page.getByRole("heading", { level: 1, name: "NAND demo" })).toBeAttached();
  await expect(inputSwitch(page, "Input A")).toBeVisible();
  await expect(output(page)).toHaveText(/Output: [01]/u);

  await page.getByRole("link", { name: "All projects" }).click();
  await expect(page.getByRole("link", { name: "NAND demo" })).toBeVisible();
});

test("toolbar buttons do not animate under reduced motion", async ({ page }) => {
  await createProject(page);
  const addNand = page.getByRole("button", { name: "Add NAND" });
  await expect(addNand).toHaveCSS("transition-duration", "0s");
});

test("switching to Spanish translates the toolbar", async ({ page }) => {
  await createProject(page);
  await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();

  await page.getByRole("button", { name: /Language$/u }).click();
  await page.getByRole("option", { name: "Español" }).click();

  await expect(page.getByRole("button", { name: "Deshacer" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo" })).toHaveCount(0);
  await expect(page).toHaveURL(PROJECT_URL);
});
