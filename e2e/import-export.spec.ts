import path from "node:path";

import type { Page } from "@playwright/test";

import { createProject, expect, test } from "./support";

const FIXTURES = path.join(import.meta.dirname, "fixtures");

const importFile = async (page: Page, file: string): Promise<void> => {
  const chooserEvent = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import" }).click();
  const chooser = await chooserEvent;
  await chooser.setFiles(file);
};

const expectDemoUnchanged = async (page: Page, url: string): Promise<void> => {
  await expect(page).toHaveURL(url);
  await expect(page.getByRole("heading", { level: 1, name: "NAND demo" })).toBeAttached();
  await expect(page.getByText("NAND gate 1", { exact: true })).toBeVisible();
  await expect(page.getByText("NAND gate 2", { exact: true })).toHaveCount(0);
};

test("an exported project imports back to the same circuit", async ({ page }, testInfo) => {
  await createProject(page);
  await page.getByRole("button", { name: "Add NAND" }).click();
  await expect(page.getByText("NAND gate 2", { exact: true })).toBeVisible();

  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export" }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("NAND demo.nand.json");
  const exported = testInfo.outputPath("exported.nand.json");
  await download.saveAs(exported);

  // Diverge from the exported file, so the import has something to restore.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("NAND gate 2", { exact: true })).toHaveCount(0);

  const url = page.url();
  await importFile(page, exported);
  await expect(page.getByText("NAND gate 2", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(url);
  await expect(page.getByRole("heading", { level: 1, name: "NAND demo" })).toBeAttached();
});

test("a file from a newer app version is rejected with a translated message", async ({ page }) => {
  await createProject(page);
  const url = page.url();
  await importFile(page, path.join(FIXTURES, "future-version.json"));
  await expect(
    page.getByText(
      "This project was saved by a newer version of the app (file version 99, supported 1).",
    ),
  ).toBeVisible();
  await expectDemoUnchanged(page, url);
});

test("a file that is not JSON is rejected with a translated message", async ({ page }) => {
  await createProject(page);
  const url = page.url();
  await importFile(page, path.join(FIXTURES, "not-json.txt"));
  await expect(page.getByText("The file is not valid JSON.")).toBeVisible();
  await expectDemoUnchanged(page, url);
});
