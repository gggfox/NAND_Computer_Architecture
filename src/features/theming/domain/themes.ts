export const themeIds = ["light", "dark", "high-contrast"] as const;

export type ThemeId = (typeof themeIds)[number];

export interface ThemeTokens {
  readonly colorBackground: string;
  readonly colorSurface: string;
  readonly colorText: string;
  readonly colorTextMuted: string;
  readonly colorAccent: string;
  readonly colorFocusRing: string;
  readonly colorSignalHigh: string;
  readonly colorSignalLow: string;
  readonly colorWire: string;
  readonly colorChipNand: string;
  readonly colorChipText: string;
  readonly colorGrid: string;
}

export const themes: Readonly<Record<ThemeId, ThemeTokens>> = {
  light: {
    colorBackground: "#f3f4f9",
    colorSurface: "#ffffff",
    colorText: "#14172a",
    colorTextMuted: "#474c66",
    colorAccent: "#3a46d6",
    colorFocusRing: "#2d3bd0",
    colorSignalHigh: "#00451f",
    colorSignalLow: "#858a9f",
    colorWire: "#585d78",
    colorChipNand: "#c92a64",
    colorChipText: "#ffffff",
    colorGrid: "#d8dbe8",
  },
  dark: {
    colorBackground: "#0d1017",
    colorSurface: "#171b27",
    colorText: "#e9ecf6",
    colorTextMuted: "#a6adc4",
    colorAccent: "#7f9bff",
    colorFocusRing: "#ffd24a",
    colorSignalHigh: "#38ff88",
    colorSignalLow: "#68729a",
    colorWire: "#8089ad",
    colorChipNand: "#ff5c8d",
    colorChipText: "#0d1017",
    colorGrid: "#1e2331",
  },
  "high-contrast": {
    colorBackground: "#000000",
    colorSurface: "#0b0b0b",
    colorText: "#ffffff",
    colorTextMuted: "#d6d6d6",
    colorAccent: "#5fd7ff",
    colorFocusRing: "#ffff00",
    colorSignalHigh: "#00ff6a",
    colorSignalLow: "#5c5cff",
    colorWire: "#ffffff",
    colorChipNand: "#ff4f9a",
    colorChipText: "#000000",
    colorGrid: "#3a3a3a",
  },
};

const UPPERCASE = /[A-Z]/gu;

const cssVarName = (name: string): string =>
  `--${name.replaceAll(UPPERCASE, (letter) => `-${letter.toLowerCase()}`)}`;

/** `colorSignalHigh` becomes `--color-signal-high`. */
export const tokenToCssVar = (key: keyof ThemeTokens): string => cssVarName(key);

const renderDeclaration = (entry: readonly [string, string]): string =>
  `  ${cssVarName(entry[0])}: ${entry[1]};\n`;

const renderBlock = (id: ThemeId, tokens: ThemeTokens): string =>
  `:root[data-theme="${id}"] {\n${Object.entries(tokens)
    .map((entry: readonly [string, string]) => renderDeclaration(entry))
    .join("")}}\n`;

export const renderThemeCss = (all: Readonly<Record<ThemeId, ThemeTokens>>): string =>
  themeIds.map((id) => renderBlock(id, all[id])).join("\n");

export const isThemeId = (value: string | null | undefined): value is ThemeId =>
  themeIds.some((id) => id === value);

/** A valid stored choice wins; otherwise (including an unknown stored value) follow OS preferences (more-contrast beats dark). */
export const resolveInitialTheme = (
  stored: string | null | undefined,
  prefersDark: boolean,
  prefersMoreContrast: boolean,
): ThemeId => {
  if (isThemeId(stored)) {
    return stored;
  }
  if (prefersMoreContrast) {
    return "high-contrast";
  }
  return prefersDark ? "dark" : "light";
};
