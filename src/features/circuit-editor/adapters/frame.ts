import type { LayoutCache, Rect } from "../domain/chip-layout";
import type { Scene } from "../domain/geometry";
import type { KnownLevels, Level } from "../domain/signals";

const TOKENS = [
  "background",
  "surface",
  "text",
  "grid",
  "wire",
  "signal-high",
  "signal-low",
  "chip-nand",
  "chip-text",
  "chip-text-low",
  "focus-ring",
] as const;
type Token = (typeof TOKENS)[number];
export type Palette = Readonly<Record<Token, string>>;

/** Theme tokens are CSS custom properties on <html> (ADR 10); the canvas reads the same values. */
export const readPalette = (): Palette => {
  const style = getComputedStyle(document.documentElement);
  const entries = TOKENS.map((token) => [token, style.getPropertyValue(`--color-${token}`).trim()]);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- built from the exhaustive TOKENS list above
  return Object.fromEntries(entries) as Palette;
};

/** One draw: the scene, how to paint it, and the world rect on screen (for culling). */
export interface Frame extends Scene {
  readonly ctx: CanvasRenderingContext2D;
  readonly palette: Palette;
  readonly known: KnownLevels;
  readonly layout: LayoutCache;
  readonly visible: Rect;
}

export const levelColor = (palette: Palette, level: Level | undefined): string => {
  if (level === undefined) {
    return palette.wire;
  }
  return level === 1 ? palette["signal-high"] : palette["signal-low"];
};

export const intersects = (first: Rect, second: Rect): boolean =>
  first.x <= second.x + second.width &&
  second.x <= first.x + first.width &&
  first.y <= second.y + second.height &&
  second.y <= first.y + first.height;
