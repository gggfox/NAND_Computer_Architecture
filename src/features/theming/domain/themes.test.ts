import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { contrastRatio } from "./contrast";
import { renderThemeCss, resolveInitialTheme, themeIds, themes, tokenToCssVar } from "./themes";
import type { ThemeId } from "./themes";

const MIN_TEXT = 4.5;
const MIN_UI = 3;
const MIN_ENHANCED_TEXT = 7;

describe("theme legibility", () => {
  test.each(themeIds)("%s: text on background and surface >= 4.5", (id) => {
    const tokens = themes[id];
    expect(contrastRatio(tokens.colorText, tokens.colorBackground)).toBeGreaterThanOrEqual(
      MIN_TEXT,
    );
    expect(contrastRatio(tokens.colorText, tokens.colorSurface)).toBeGreaterThanOrEqual(MIN_TEXT);
    expect(contrastRatio(tokens.colorTextMuted, tokens.colorBackground)).toBeGreaterThanOrEqual(
      MIN_TEXT,
    );
    expect(contrastRatio(tokens.colorChipText, tokens.colorChipNand)).toBeGreaterThanOrEqual(
      MIN_TEXT,
    );
  });

  test.each(themeIds)("%s: signals and focus ring vs background >= 3", (id) => {
    const tokens = themes[id];
    for (const color of [
      tokens.colorSignalHigh,
      tokens.colorSignalLow,
      tokens.colorFocusRing,
      tokens.colorWire,
    ]) {
      expect(contrastRatio(color, tokens.colorBackground)).toBeGreaterThanOrEqual(MIN_UI);
    }
  });

  test("high-contrast text ratio >= 7", () => {
    const hc = themes["high-contrast"];
    expect(contrastRatio(hc.colorText, hc.colorBackground)).toBeGreaterThanOrEqual(
      MIN_ENHANCED_TEXT,
    );
  });
});

describe("tokens", () => {
  test("tokenToCssVar kebab-cases", () => {
    expect(tokenToCssVar("colorSignalHigh")).toBe("--color-signal-high");
    expect(tokenToCssVar("colorBackground")).toBe("--color-background");
  });

  test("committed tokens.css matches renderThemeCss(themes)", () => {
    expect(readFileSync("src/features/theming/tokens.css", "utf-8")).toBe(renderThemeCss(themes));
  });
});

interface InitialCase {
  readonly stored: string | undefined;
  readonly prefersDark: boolean;
  readonly prefersMoreContrast: boolean;
  readonly want: ThemeId;
}

const initialCases: readonly InitialCase[] = [
  { stored: undefined, prefersDark: true, prefersMoreContrast: false, want: "dark" },
  { stored: undefined, prefersDark: false, prefersMoreContrast: true, want: "high-contrast" },
  { stored: "light", prefersDark: true, prefersMoreContrast: true, want: "light" },
  { stored: "bogus", prefersDark: false, prefersMoreContrast: false, want: "light" },
  { stored: "bogus", prefersDark: true, prefersMoreContrast: false, want: "dark" },
  { stored: undefined, prefersDark: false, prefersMoreContrast: false, want: "light" },
];

describe("resolveInitialTheme", () => {
  test.each(initialCases)("%o", ({ stored, prefersDark, prefersMoreContrast, want }) => {
    expect(resolveInitialTheme(stored, prefersDark, prefersMoreContrast)).toBe(want);
  });
});
