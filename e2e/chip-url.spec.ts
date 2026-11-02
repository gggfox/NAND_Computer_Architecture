import { importLibrary, openLibrary } from "./library-support";
import { expect, test } from "./support";

const MAIN_ID = "00000000-0000-4000-8000-000000000401";
const SCRATCH_ID = "00000000-0000-4000-8000-000000000404";
const RANDOM_ID = "11111111-1111-4111-8111-111111111111";

const chipParam = (url: string): string | null => new URL(url).searchParams.get("chip");

test("reloading reopens the chip named in the URL", async ({ page }) => {
  await importLibrary(page);
  const tree = await openLibrary(page);
  await tree.getByRole("button", { name: "Actions for Scratch", exact: true }).click();
  await page.getByRole("menuitem", { name: "Open" }).click();
  await expect.poll(() => chipParam(page.url())).toBe(SCRATCH_ID);

  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Library" })).toBeAttached();
  // The editor opened Scratch, so the URL stays as it was instead of being corrected to Main.
  await expect.poll(() => chipParam(page.url())).toBe(SCRATCH_ID);
});

for (const [label, chip] of [
  ["an unknown id", RANDOM_ID],
  ["garbage", "garbage"],
] as const) {
  test(`${label} in ?chip= opens the last opened chip and corrects the URL`, async ({ page }) => {
    await importLibrary(page);
    const url = new URL(page.url());
    url.searchParams.set("chip", chip);
    await page.goto(url.toString());
    await expect(page.getByRole("heading", { level: 1, name: "Library" })).toBeAttached();
    await expect.poll(() => chipParam(page.url())).toBe(MAIN_ID);
  });
}

test("a known chip in ?chip= is opened instead of the last opened one", async ({ page }) => {
  await importLibrary(page);
  const url = new URL(page.url());
  url.searchParams.set("chip", SCRATCH_ID);
  await page.goto(url.toString());
  await expect(page.getByRole("heading", { level: 1, name: "Library" })).toBeAttached();
  // Were Main opened, the mount-time correction would have rewritten the URL to Main.
  await expect.poll(() => chipParam(page.url())).toBe(SCRATCH_ID);
  await expect(page.getByRole("heading", { name: "Pins 0" })).toBeVisible();
});
