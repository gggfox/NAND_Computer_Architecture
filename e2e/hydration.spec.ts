import type { ConsoleMessage, Page } from "@playwright/test";

import { expect, test } from "./support";

/** Dev messages say "hydrat…"; production React throws minified #418 (text), #423 and #425. */
const HYDRATION = /hydrat|Minified React error #(?:418|423|425)/iu;

/** React reports hydration mismatches as errors, but some variants arrive as warnings. */
const REPORTED_TYPES = new Set(["error", "warning"]);

interface FirstLoad {
  readonly name: string;
  readonly colorScheme: "light" | "dark";
  readonly stored: readonly (readonly [key: string, value: string])[];
  readonly theme: string;
  readonly lang: string;
}

/*
 * The boot script sets `data-theme` before hydration from storage or the OS preference, and the
 * locale effect corrects `lang` after it; neither may make React report a mismatch (#12).
 */
const firstLoads: readonly FirstLoad[] = [
  { name: "an OS light preference", colorScheme: "light", stored: [], theme: "light", lang: "en" },
  { name: "an OS dark preference", colorScheme: "dark", stored: [], theme: "dark", lang: "en" },
  {
    name: "a stored dark theme",
    colorScheme: "light",
    stored: [["nand.theme", "dark"]],
    theme: "dark",
    lang: "en",
  },
  {
    name: "a stored light theme",
    colorScheme: "dark",
    stored: [["nand.theme", "light"]],
    theme: "light",
    lang: "en",
  },
  {
    name: "a stored es locale",
    colorScheme: "dark",
    stored: [["PARAGLIDE_LOCALE", "es"]],
    theme: "dark",
    lang: "es",
  },
];

const collectHydrationProblems = (page: Page): string[] => {
  const problems: string[] = [];
  page.on("console", (message: ConsoleMessage) => {
    if (REPORTED_TYPES.has(message.type()) && HYDRATION.test(message.text())) {
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

for (const load of firstLoads) {
  test(`first load reports no hydration mismatch with ${load.name}`, async ({ page }) => {
    const problems = collectHydrationProblems(page);
    await page.emulateMedia({ colorScheme: load.colorScheme });
    await page.addInitScript((entries) => {
      for (const [key, value] of entries) {
        localStorage.setItem(key, value);
      }
    }, load.stored);
    await page.goto("/");
    await expect(page.getByRole("button", { name: /new project|nuevo proyecto/iu })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", load.lang);
    await expect(page.locator("html")).toHaveAttribute("data-theme", load.theme);
    expect(problems).toEqual([]);
  });
}
