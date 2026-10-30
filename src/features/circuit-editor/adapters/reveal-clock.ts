import type { Circuit } from "~/features/projects";
import type { WireId } from "~/shared/ids";

import { NO_REVEAL, nextReveal, revealFraction } from "../domain/wire-reveal";
import type { Reveal } from "../domain/wire-reveal";

/** Wires being revealed, by id: how much of each route is drawn, 0 to 1. */
export type RevealFractions = ReadonlyMap<WireId, number>;

export interface RevealClock {
  /** This frame's wires: new ones start revealing. Returns each revealing wire's fraction. */
  readonly tick: (wires: Circuit["wires"]) => RevealFractions;
  /** Whether a reveal is still running, so the renderer draws another frame. */
  readonly running: () => boolean;
}

const prefersReducedMotion = (): boolean =>
  globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The new-wire reveal's clock: it remembers the wire ids drawn last frame, and a new id is drawn
 * along its route over 250 ms. Skipped under `prefers-reduced-motion`.
 */
export const createRevealClock = (): RevealClock => {
  let reveal: Reveal = NO_REVEAL;
  let lastWires: Circuit["wires"] | undefined = undefined;
  return {
    tick: (wires) => {
      const now = performance.now();
      // Edits replace the wires array, so an unchanged array with nothing running needs no diff.
      if (wires !== lastWires || reveal.started.size > 0) {
        lastWires = wires;
        const ids = wires.map((wire) => wire.id);
        reveal = nextReveal(reveal, { ids, now, animate: !prefersReducedMotion() });
      }
      return new Map([...reveal.started].map(([id, at]) => [id, revealFraction(at, now)]));
    },
    running: () => reveal.started.size > 0,
  };
};
