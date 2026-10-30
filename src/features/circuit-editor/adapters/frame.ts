import type { InstanceId } from "~/shared/ids";

import type { LayoutCache, Rect, Size } from "../domain/chip-layout";
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
  /**
   * During a drag the scene is drawn in two parts: everything that stays put (cached once), then
   * the chips being moved and every wire touching them. Absent: draw everything.
   */
  readonly part?: { readonly moved: ReadonlySet<InstanceId>; readonly drawMoved: boolean };
}

/** Whether a chip or wire touching `instanceIds` belongs to the part this frame draws. */
export const inPart = (frame: Frame, instanceIds: readonly InstanceId[]): boolean => {
  const { part } = frame;
  return part === undefined || instanceIds.some((id) => part.moved.has(id)) === part.drawMoved;
};

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

export interface Viewport extends Size {
  readonly dpr: number;
}

/** Matches the backing store to the element's CSS size times the device pixel ratio. */
export const fitBackingStore = (canvas: HTMLCanvasElement): Viewport => {
  const dpr = globalThis.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const backingWidth = Math.round(width * dpr);
  const backingHeight = Math.round(height * dpr);
  if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
    canvas.width = backingWidth;
    canvas.height = backingHeight;
  }
  return { width, height, dpr };
};
