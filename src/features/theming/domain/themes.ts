/** The first id is the default theme. */
export const themeIds = ["amber", "light", "dark", "high-contrast"] as const;

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
  /** Label colour on a low-signal body: no single chip-text colour clears AA on both signal levels. */
  readonly colorChipTextLow: string;
  readonly colorGrid: string;
  readonly colorWireBlue: string;
  readonly colorWireBlueMuted: string;
  readonly colorWireRed: string;
  readonly colorWireRedMuted: string;
  readonly colorWireOrange: string;
  readonly colorWireOrangeMuted: string;
  readonly colorWireYellow: string;
  readonly colorWireYellowMuted: string;
  readonly colorWireGreen: string;
  readonly colorWireGreenMuted: string;
  readonly colorWireTeal: string;
  readonly colorWireTealMuted: string;
  readonly colorWirePurple: string;
  readonly colorWirePurpleMuted: string;
  readonly colorWirePink: string;
  readonly colorWirePinkMuted: string;
}

export const themes: Readonly<Record<ThemeId, ThemeTokens>> = {
  amber: {
    colorBackground: "#050505",
    colorSurface: "#111111",
    colorText: "#f5f3ef",
    colorTextMuted: "#b5b0a8",
    colorAccent: "#ff9800",
    colorFocusRing: "#5fe3ff",
    colorSignalHigh: "#ffb627",
    colorSignalLow: "#6b6258",
    colorWire: "#8a8178",
    colorChipNand: "#ff6a3d",
    colorChipText: "#050505",
    colorChipTextLow: "#ffffff",
    colorGrid: "#1c1915",
    colorWireBlue: "#94b4ff",
    colorWireBlueMuted: "#2d5ed2",
    colorWireRed: "#ff9999",
    colorWireRedMuted: "#c22929",
    colorWireOrange: "#ff9a4d",
    colorWireOrangeMuted: "#9c5621",
    colorWireYellow: "#dbaf00",
    colorWireYellowMuted: "#7a671a",
    colorWireGreen: "#00d134",
    colorWireGreenMuted: "#197630",
    colorWireTeal: "#00ccc5",
    colorWireTealMuted: "#18726f",
    colorWirePurple: "#d79eff",
    colorWirePurpleMuted: "#9235d4",
    colorWirePink: "#ff8fd0",
    colorWirePinkMuted: "#b9277c",
  },
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
    colorChipTextLow: "#14172a",
    colorGrid: "#d8dbe8",
    colorWireBlue: "#2354c7",
    colorWireBlueMuted: "#6487d8",
    colorWireRed: "#b21f1f",
    colorWireRedMuted: "#d86464",
    colorWireOrange: "#8b4a18",
    colorWireOrangeMuted: "#c87332",
    colorWireYellow: "#6c5b13",
    colorWireYellowMuted: "#9f8728",
    colorWireGreen: "#126828",
    colorWireGreenMuted: "#279b44",
    colorWireTeal: "#126461",
    colorWireTealMuted: "#269793",
    colorWirePurple: "#8624cc",
    colorWirePurpleMuted: "#ac6cda",
    colorWirePink: "#a91e6f",
    colorWirePinkMuted: "#d65ca3",
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
    colorChipTextLow: "#ffffff",
    colorGrid: "#1e2331",
    colorWireBlue: "#94b4ff",
    colorWireBlueMuted: "#2d5ed2",
    colorWireRed: "#ff9999",
    colorWireRedMuted: "#c22929",
    colorWireOrange: "#ff9a4d",
    colorWireOrangeMuted: "#9c5621",
    colorWireYellow: "#dbaf00",
    colorWireYellowMuted: "#7a671a",
    colorWireGreen: "#00d134",
    colorWireGreenMuted: "#197630",
    colorWireTeal: "#00ccc5",
    colorWireTealMuted: "#18726f",
    colorWirePurple: "#d79eff",
    colorWirePurpleMuted: "#9235d4",
    colorWirePink: "#ff8fd0",
    colorWirePinkMuted: "#b9277c",
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
    colorChipTextLow: "#ffffff",
    colorGrid: "#3a3a3a",
    colorWireBlue: "#759fff",
    colorWireBlueMuted: "#1f62ff",
    colorWireRed: "#ff7575",
    colorWireRedMuted: "#e60000",
    colorWireOrange: "#ff7a14",
    colorWireOrangeMuted: "#bd5200",
    colorWireYellow: "#c79f00",
    colorWireYellowMuted: "#8a6e00",
    colorWireGreen: "#00bd2f",
    colorWireGreenMuted: "#008521",
    colorWireTeal: "#00b3ad",
    colorWireTealMuted: "#00807b",
    colorWirePurple: "#ca80ff",
    colorWirePurpleMuted: "#a424ff",
    colorWirePink: "#ff6bc1",
    colorWirePinkMuted: "#db0080",
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

/** A valid stored choice wins; otherwise (including an unknown stored value) a more-contrast preference gives high contrast, and all else gives amber. */
export const resolveInitialTheme = (
  stored: string | null | undefined,
  prefersMoreContrast: boolean,
): ThemeId => {
  if (isThemeId(stored)) {
    return stored;
  }
  return prefersMoreContrast ? "high-contrast" : "amber";
};
