import type { GhostsView } from "../adapters/draw-ghosts";
import type { InteractionState } from "../domain/interaction";

/** The suggested wires to draw, with the focused one marked; nothing when none are suggested. */
export const ghostsOf = ({ suggestions, wireColor }: InteractionState): GhostsView => {
  if (suggestions === undefined) {
    return {};
  }
  return {
    ghosts: suggestions.ghosts.map(({ route }, index) => ({
      route,
      focused: index === suggestions.focus,
    })),
    ...(wireColor === undefined ? {} : { ghostColor: wireColor }),
  };
};
