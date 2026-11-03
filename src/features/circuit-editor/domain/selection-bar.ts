import type { InteractionState } from "./interaction";

/** The bar shows for a selected chip, and only while nothing else has the canvas's attention. */
export const barVisible = (state: InteractionState): boolean =>
  state.selection.instances.size > 0 &&
  state.drag === undefined &&
  state.armed === undefined &&
  state.placing === undefined &&
  state.menu === undefined &&
  state.renaming === undefined &&
  state.arraying === undefined &&
  state.bitPick === undefined;
