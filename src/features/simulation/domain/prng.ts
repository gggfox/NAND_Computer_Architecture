// Mulberry32: a tiny, fast 32-bit seeded PRNG (ADR 15). The bit operations are the algorithm.
const GOLDEN_GAMMA = 0x6d_2b_79_f5;
const SHIFT_A = 15;
const SHIFT_B = 7;
const SHIFT_C = 14;
const MIX_ODD = 61;
const UINT32_RANGE = 0x1_00_00_00_00;

/** Returns a deterministic generator of floats in [0, 1) for the given seed. */
export const createPrng = (seed: number): (() => number) => {
  // State is kept as uint32 (`>>> 0`); Math.imul and `^` coerce it to int32 exactly as mulberry32 expects.
  let state = seed >>> 0;
  return () => {
    state = (state + GOLDEN_GAMMA) >>> 0;
    let mixed = Math.imul(state ^ (state >>> SHIFT_A), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> SHIFT_B), mixed | MIX_ODD);
    return ((mixed ^ (mixed >>> SHIFT_C)) >>> 0) / UINT32_RANGE;
  };
};
