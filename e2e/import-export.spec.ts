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

test("an exported project imports back to the same circuit", async ({
  browserName,
  page,
}, testInfo) => {
  await createProject(page);
  await page.getByRole("button", { name: "Add NAND" }).click();
  await expect(page.getByText("NAND gate 2", { exact: true })).toBeVisible();

  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export" }).click();
  const download = await downloadEvent;
  // WebKit on Linux (WPE/GTK) rewrites spaces in download names to underscores.
  const expectedName =
    browserName === "webkit" && process.platform === "linux"
      ? "NAND_demo.nand.json"
      : "NAND demo.nand.json";
  expect(download.suggestedFilename()).toBe(expectedName);
  const exported = testInfo.outputPath("exported.nand.json");
  await download.saveAs(exported);

  // Diverge from the exported file, so the import has something to restore.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("NAND gate 2", { exact: true })).toHaveCount(0);

  const url = page.url();
  await importFile(page, exported);
  // The file has the id of the open project, so the person chooses what happens.
  await page.getByRole("dialog").getByRole("button", { name: "Replace" }).click();
  await expect(page.getByText("NAND gate 2", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(url);
  await expect(page.getByRole("heading", { level: 1, name: "NAND demo" })).toBeAttached();
});

/** Exports the open project and returns the path of the file. */
const exportOpenProject = async (page: Page, outputPath: string): Promise<void> => {
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export" }).click();
  const download = await downloadEvent;
  await download.saveAs(outputPath);
};

test("importing a saved id and choosing Keep both adds a copy", async ({ page }, testInfo) => {
  await createProject(page);
  const exported = testInfo.outputPath("exported.nand.json");
  await exportOpenProject(page, exported);
  const url = page.url();

  await importFile(page, exported);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("This project is already saved")).toBeVisible();
  await dialog.getByRole("button", { name: "Keep both" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "NAND demo (copy)" })).toBeAttached();
  expect(page.url()).not.toBe(url);
  await page.getByRole("link", { name: "All projects" }).click();
  await expect(page.getByRole("link", { name: "NAND demo", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "NAND demo (copy)" })).toBeVisible();
});

test("cancelling the import dialog changes nothing", async ({ page }, testInfo) => {
  await createProject(page);
  const exported = testInfo.outputPath("exported.nand.json");
  await exportOpenProject(page, exported);
  const url = page.url();

  await importFile(page, exported);
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expectDemoUnchanged(page, url);
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
