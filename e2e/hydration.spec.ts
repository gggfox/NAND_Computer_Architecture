import type { ConsoleMessage, Page } from "@playwright/test";

import { expect, test } from "./support";

/** Dev messages say "hydrat…"; production React throws minified #418 (text), #423 and #425. */
const HYDRATION = /hydrat|Minified React error #(?:418|423|425)/iu;

interface StoredChoice {
  readonly name: string;
  readonly key: string;
  readonly value: string;
  readonly theme: string | undefined;
  readonly lang: string;
}

const choices: readonly StoredChoice[] = [
  { name: "stored dark theme", key: "nand.theme", value: "dark", theme: "dark", lang: "en" },
  { name: "stored es locale", key: "PARAGLIDE_LOCALE", value: "es", theme: undefined, lang: "es" },
];

const collectHydrationErrors = (page: Page): string[] => {
  const problems: string[] = [];
  page.on("console", (message: ConsoleMessage) => {
    if (message.type() === "error" && HYDRATION.test(message.text())) {
      problems.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    if (HYDRATION.test(error.message)) {
      problems.push(error.message);
    }
  });
  return problems;
};

for (const choice of choices) {
  test(`first load logs no hydration error with a ${choice.name}`, async ({ page }) => {
    const problems = collectHydrationErrors(page);
    await page.addInitScript(
      ([key, value]) => {
        localStorage.setItem(key, value);
      },
      [choice.key, choice.value] as const,
    );
    await page.goto("/");
    await expect(page.getByRole("button", { name: /new project|nuevo proyecto/iu })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", choice.lang);
    if (choice.theme !== undefined) {
      await expect(page.locator("html")).toHaveAttribute("data-theme", choice.theme);
    }
    expect(problems).toEqual([]);
  });
}
