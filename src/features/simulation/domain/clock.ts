/** Slowest and fastest clock speeds, in steps (half cycles) per second. */
export const MIN_STEPS_PER_SECOND = 0.5;
export const MAX_STEPS_PER_SECOND = 1000;
export const DEFAULT_STEPS_PER_SECOND = 4;

/** The worker runs due steps in batches this many milliseconds apart. */
export const CLOCK_BATCH_MS = 16;

/** A batch runs at most this many steps; any excess is dropped so a stalled tab cannot pile up work. */
export const MAX_STEPS_PER_BATCH = 64;

export interface StepsDue {
  readonly steps: number;
  readonly carrySteps: number;
}

const MS_PER_SECOND = 1000;

/**
 * How many whole steps are due after `elapsedMs` at `stepsPerSecond`, plus the fractional step
 * carried into the next batch. Negative or non-finite elapsed time adds nothing.
 */
export const stepsDue = (
  carrySteps: number,
  elapsedMs: number,
  stepsPerSecond: number,
): StepsDue => {
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const pending = carrySteps + (elapsed * stepsPerSecond) / MS_PER_SECOND;
  const whole = Math.floor(pending);
  if (whole > MAX_STEPS_PER_BATCH) {
    return { steps: MAX_STEPS_PER_BATCH, carrySteps: 0 };
  }
  return { steps: whole, carrySteps: pending - whole };
};
