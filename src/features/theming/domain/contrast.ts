const HEX_COLOR = /^#(?<r>[\da-f]{2})(?<g>[\da-f]{2})(?<b>[\da-f]{2})$/iu;
const HEX_RADIX = 16;
const MAX_CHANNEL = 255;
const LINEAR_THRESHOLD = 0.04045;
const LINEAR_DIVISOR = 12.92;
const GAMMA_OFFSET = 0.055;
const GAMMA_DIVISOR = 1.055;
const GAMMA_EXPONENT = 2.4;
const RED_WEIGHT = 0.2126;
const GREEN_WEIGHT = 0.7152;
const BLUE_WEIGHT = 0.0722;
const FLARE = 0.05;

const linearize = (hex: string): number => {
  const channel = Number.parseInt(hex, HEX_RADIX) / MAX_CHANNEL;
  return channel <= LINEAR_THRESHOLD
    ? channel / LINEAR_DIVISOR
    : ((channel + GAMMA_OFFSET) / GAMMA_DIVISOR) ** GAMMA_EXPONENT;
};

/** WCAG 2.x relative luminance of a `#rrggbb` color, or NaN when malformed. */
const luminance = (color: string): number => {
  const groups = HEX_COLOR.exec(color)?.groups;
  if (groups?.["r"] === undefined || groups["g"] === undefined || groups["b"] === undefined) {
    return Number.NaN;
  }
  return (
    RED_WEIGHT * linearize(groups["r"]) +
    GREEN_WEIGHT * linearize(groups["g"]) +
    BLUE_WEIGHT * linearize(groups["b"])
  );
};

/** WCAG 2.x contrast ratio (1 to 21) between two `#rrggbb` colors; NaN if either is malformed. */
export const contrastRatio = (fg: string, bg: string): number => {
  const lumFg = luminance(fg);
  const lumBg = luminance(bg);
  return (Math.max(lumFg, lumBg) + FLARE) / (Math.min(lumFg, lumBg) + FLARE);
};
