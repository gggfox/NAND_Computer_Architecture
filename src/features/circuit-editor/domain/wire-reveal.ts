import type { WireId } from "~/shared/ids";

/** How long a new wire takes to draw itself along its route. */
export const REVEAL_MS = 250;

/** What the renderer remembers between frames: the wire ids it drew and when new ones appeared. */
export interface Reveal {
  /** Absent before the first frame, so the wires already there on load are never revealed. */
  readonly seen?: ReadonlySet<WireId>;
  readonly started: ReadonlyMap<WireId, number>;
}

/** A line dash alternates drawn and gap lengths: even indices are drawn. */
const PAIR = 2;

/** The ease-out curve's power: fast at first, settling at the end. */
const EASE_POWER = 3;

export const NO_REVEAL: Reveal = { started: new Map() };

interface Tick {
  /** The wire ids in this frame's circuit. */
  readonly ids: readonly WireId[];
  readonly now: number;
  /** False under `prefers-reduced-motion`: new wires appear whole. */
  readonly animate: boolean;
}

/**
 * Whether the circuit was swapped for another (a chip opened): wires were drawn last frame and
 * none of them is still here. Its wires are not new, so they are not revealed.
 */
const swapped = (seen: ReadonlySet<WireId>, ids: readonly WireId[]): boolean =>
  seen.size > 0 && !ids.some((id) => seen.has(id));

/** The reveal after one frame: new ids start, finished or removed ones are dropped. */
export const nextReveal = (reveal: Reveal, { ids, now, animate }: Tick): Reveal => {
  const { seen } = reveal;
  const current = new Set(ids);
  const started = new Map(
    [...reveal.started].filter(([id, at]) => current.has(id) && now - at < REVEAL_MS),
  );
  if (seen !== undefined && animate && !swapped(seen, ids)) {
    for (const id of ids.filter((item) => !seen.has(item))) {
      started.set(id, now);
    }
  }
  return { seen: current, started };
};

/** How much of a revealing wire is drawn at `now`, 0 to 1, easing out. */
export const revealFraction = (start: number, now: number): number => {
  const linear = Math.min(1, Math.max(0, (now - start) / REVEAL_MS));
  return 1 - (1 - linear) ** EASE_POWER;
};

/** The wire's dash steps up to `shown` long: whole periods, then the last one cut short. */
const dashesUpTo = (
  dash: readonly number[],
  { period, shown }: { readonly period: number; readonly shown: number },
): readonly number[] => {
  const out: number[] = [];
  let at = 0;
  for (const step of Array.from({ length: Math.ceil(shown / period) }, () => dash).flat()) {
    if (at >= shown) {
      break;
    }
    out.push(out.length % PAIR === 0 ? Math.min(step, shown - at) : step);
    at += step;
  }
  return out;
};

/**
 * The line dash that draws the first `fraction` of a route `total` long, keeping the wire's own
 * `dash` (a low wire stays dashed while it is revealed), then a gap past the end.
 */
export const revealDash = (
  dash: readonly number[],
  total: number,
  fraction: number,
): readonly number[] => {
  const shown = total * fraction;
  const period = dash.reduce((sum, step) => sum + step, 0);
  if (period <= 0) {
    return [shown, total];
  }
  const out = dashesUpTo(dash, { period, shown });
  // The pattern must end on a gap that hides the rest of the route.
  return out.length % PAIR === 1 ? [...out, total] : [...out, 0, total];
};
