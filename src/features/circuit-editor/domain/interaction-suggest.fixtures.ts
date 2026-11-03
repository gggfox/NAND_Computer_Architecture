/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { assert } from "vitest";

import type { Point } from "~/features/projects";
import { newWireId } from "~/shared/ids";

import { worldToScreen } from "./camera";
import { pinPosition } from "./geometry";
import { buildIndex } from "./hit-test";
import { initialInteraction } from "./interaction";
import type { InteractionContext, InteractionState, Interpreted } from "./interaction";
import { command } from "./interaction.fixtures";
import type { Ghost } from "./selection";
import { registerFileScene } from "./suggest-wires.fixtures";

const HALF = 0.5;

/** The register file as a canvas context (nothing wired), and a state with the camera at the origin. */
export const fileContext = () => {
  const file = registerFileScene();
  const [chip] = file.scene.project.chips;
  assert(chip !== undefined);
  const context: InteractionContext = {
    scene: file.scene,
    chipId: chip.id,
    viewport: { width: 800, height: 600 },
    index: () => buildIndex(file.scene),
    newWireId,
    inputs: new Map(),
  };
  const state = initialInteraction({ zoom: 1, x: 0, y: 0 }, "select");
  return { ...file, context, state };
};

/** The register file with its 20 ghosts showing. */
export const suggested = () => {
  const base = fileContext();
  const result = command(base.state, base.context, { type: "suggestWires" });
  assert(result.state.suggestions !== undefined);
  return { ...base, state: result.state, ghosts: result.state.suggestions.ghosts };
};

/** The dispatches among an interpretation's effects. */
export const dispatches = (result: Interpreted) =>
  result.effects.filter((effect) => effect.type === "dispatch");

/** Where a ghost's middle vertex is on the screen at the origin camera. */
export const middleOf = (state: InteractionState, ghost: Ghost): Point => {
  const middle = ghost.route[Math.floor(ghost.route.length * HALF)];
  assert(middle !== undefined);
  return worldToScreen(state.camera, middle);
};

/** Where a ghost's `to` pin is on the screen at the origin camera. */
export const endOf = (
  context: InteractionContext,
  state: InteractionState,
  ghost: Ghost,
): Point => {
  const instance = context.scene.circuit.instances.find((item) => item.id === ghost.to.instanceId);
  const anchor = instance && pinPosition(context.scene, instance, ghost.to.pin);
  assert(anchor !== undefined);
  return worldToScreen(state.camera, anchor);
};
