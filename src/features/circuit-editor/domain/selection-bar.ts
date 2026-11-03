import type { InteractionState } from "./interaction";

const MIN_CHIPS = 2;

/**
 * The bar shows for selected chips or pins (D9), and only while nothing else has the canvas's
 * attention. It also hides while ghosts show (D14), so it never overlaps the suggestions bar.
 */
export const barVisible = (state: InteractionState): boolean =>
  (state.selection.instances.size > 0 || state.selection.pins.length > 0) &&
  state.drag === undefined &&
  state.armed === undefined &&
  state.placing === undefined &&
  state.menu === undefined &&
  state.renaming === undefined &&
  state.arraying === undefined &&
  state.bitPick === undefined &&
  state.suggestions === undefined;

/** Duplicate, Array… and Delete act on chips, so they show only with chips selected. */
export const barChipActions = (state: InteractionState): boolean =>
  state.selection.instances.size > 0;

/** Whether a pinned card offers "on all selected chips" (D3): its chip is one of two or more. */
export const offersSelectOnAll = (state: InteractionState): boolean =>
  state.card?.pinned === true &&
  state.selection.instances.size >= MIN_CHIPS &&
  state.selection.instances.has(state.card.instanceId);

/** The suggestions bar shows while ghosts do, unless a menu, dialog or drag has the canvas's attention. */
export const suggestionsBarVisible = (state: InteractionState): boolean =>
  (state.suggestions?.ghosts.length ?? 0) > 0 &&
  state.drag === undefined &&
  state.menu === undefined &&
  state.renaming === undefined &&
  state.arraying === undefined &&
  state.help === undefined &&
  state.bitPick === undefined;
