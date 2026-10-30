import { expect, test } from "./support";

test("the app shell loads offline once the service worker is active", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // With clientsClaim, the active worker takes over this page without a reload.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1, name: "NAND Computer Architecture" }),
  ).toBeVisible();
});
