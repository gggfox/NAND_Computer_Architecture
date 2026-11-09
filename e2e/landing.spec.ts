import { expect, test } from "./support";

/** How far the title's text reaches to the right of its column, in pixels (0 when it fits). */
const titleOverflow = (title: HTMLElement): number => {
  const column = title.parentElement?.getBoundingClientRect().right ?? 0;
  const range = document.createRange();
  range.selectNodeContents(title);
  const right = Math.max(...[...range.getClientRects()].map((rect) => rect.right));
  return Math.max(0, right - column);
};

test("the Spanish title fits its column, also its longest word", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Language$/u }).click();
  await page.getByRole("option", { name: "Español" }).click();

  const title = page.getByRole("heading", { level: 1 });
  await expect(title).toContainText("computadora");
  expect(await title.evaluate(titleOverflow)).toBe(0);
});
