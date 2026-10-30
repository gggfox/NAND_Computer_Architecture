import type { WireColor } from "~/features/projects";

import { wireDash } from "./signals";
import type { Level } from "./signals";

/** The theme token a wire is stroked with (`--color-<token>`). */
export type WireToken =
  | "wire"
  | "signal-high"
  | "signal-low"
  | `wire-${WireColor}`
  | `wire-${WireColor}-muted`;

/** How one wire is stroked; wires with equal `token`, `dash` and `width` are stroked together. */
export interface WireStyle {
  readonly token: WireToken;
  readonly dash: readonly number[];
  readonly width: number;
  /** A high wire glows: the same path, wide and faint, under it. */
  readonly glow: boolean;
  /** Draw order: unknown first, then low, then high, so high wires stay on top where they cross. */
  readonly rank: number;
}

export const WIRE_WIDTH = 3;
/**
 * The glow under a high wire: its width in world px and its opacity. Narrower than the selection
 * halo (9), so a glow never reads as a selected wire.
 */
export const GLOW_WIDTH = 7;
export const GLOW_ALPHA = 0.25;
/** Below this zoom the glow is skipped: it would only blur thin wires together. */
const GLOW_MIN_ZOOM = 0.5;

const RANK_UNKNOWN = 0;
const RANK_LOW = 1;
const RANK_HIGH = 2;

const tokenFor = (color: WireColor | undefined, level: Level): WireToken => {
  if (color === undefined) {
    return level === 1 ? "signal-high" : "signal-low";
  }
  return level === 1 ? `wire-${color}` : `wire-${color}-muted`;
};

/**
 * A wire's stroke at `level`. A default wire keeps the signal colours; a coloured wire is its full
 * colour when on and its muted colour when off. Off is dashed, so it never rests on colour alone,
 * and on is one px thicker. An unknown level stays the solid `wire` token.
 */
export const wireStyle = ({
  color,
  level,
}: {
  readonly color?: WireColor | undefined;
  readonly level?: Level | undefined;
}): WireStyle => {
  if (level === undefined) {
    return { token: "wire", dash: wireDash(), width: WIRE_WIDTH, glow: false, rank: RANK_UNKNOWN };
  }
  const high = level === 1;
  return {
    token: tokenFor(color, level),
    dash: wireDash(level),
    width: high ? WIRE_WIDTH + 1 : WIRE_WIDTH,
    glow: high,
    rank: high ? RANK_HIGH : RANK_LOW,
  };
};

/** The batch a style is stroked in. */
export const styleKey = (style: WireStyle): string =>
  `${style.token}|${style.dash.join(",")}|${String(style.width)}`;

/** Whether glows are drawn at `zoom`. Also the static layer's zoom band. */
export const glowsAt = (zoom: number): boolean => zoom >= GLOW_MIN_ZOOM;

/** The colour a wire being drawn previews in: the armed colour, or the focus ring by default. */
export const previewToken = (color?: WireColor): WireToken | "focus-ring" =>
  color === undefined ? "focus-ring" : `wire-${color}`;
