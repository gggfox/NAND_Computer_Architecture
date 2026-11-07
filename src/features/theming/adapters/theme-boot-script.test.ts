import { runInNewContext } from "node:vm";

import { describe, expect, it } from "vitest";

import { resolveInitialTheme } from "../domain/themes";
import { THEME_STORAGE_KEY } from "./apply-theme";
import { themeBootScript } from "./theme-boot-script";

interface Environment {
  /** The stored value; `undefined` means the key is missing. */
  readonly stored: string | undefined;
  /** Makes `localStorage.getItem` throw, like blocked storage. */
  readonly blocked: boolean;
  readonly prefersDark: boolean;
  readonly prefersMoreContrast: boolean;
}

/** Runs the serialized boot script against stubbed browser globals and returns the applied theme. */
const runBootScript = (environment: Environment): string | undefined => {
  const dataset: Record<string, string> = {};
  const requestedKeys: string[] = [];
  runInNewContext(themeBootScript, {
    localStorage: {
      getItem: (key: string): string | null => {
        requestedKeys.push(key);
        if (environment.blocked) {
          throw new Error("storage blocked");
        }
        // A missing key reads as null in a real browser.
        /* oxlint-disable-next-line unicorn/no-null -- localStorage.getItem returns null for a missing key */
        return environment.stored ?? null;
      },
    },
    matchMedia: (query: string) => ({
      matches:
        (query === "(prefers-color-scheme: dark)" && environment.prefersDark) ||
        (query === "(prefers-contrast: more)" && environment.prefersMoreContrast),
    }),
    document: { documentElement: { dataset } },
  });
  expect(requestedKeys).toEqual([THEME_STORAGE_KEY]);
  return dataset["theme"];
};

const storedCases: (string | undefined)[] = [
  undefined,
  "light",
  "dark",
  "high-contrast",
  "",
  "Dark",
  "solarized",
  "__proto__",
];

const flags = [false, true];

const environments: Environment[] = [];
for (const stored of storedCases) {
  for (const blocked of flags) {
    for (const prefersDark of flags) {
      for (const prefersMoreContrast of flags) {
        environments.push({ stored, blocked, prefersDark, prefersMoreContrast });
      }
    }
  }
}

describe("theme boot script", () => {
  it.each(environments)("matches resolveInitialTheme for %o", (environment) => {
    // Blocked storage reads as "nothing stored" in the function under comparison.
    const stored = environment.blocked ? undefined : environment.stored;
    expect(runBootScript(environment)).toBe(
      resolveInitialTheme(stored, environment.prefersDark, environment.prefersMoreContrast),
    );
  });
});
