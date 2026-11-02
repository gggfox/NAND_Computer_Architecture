/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { assert } from "vitest";

import { createDemoProject } from "~/features/projects";
import type { Point } from "~/features/projects";
import { WireIdSchema } from "~/shared/ids";

import { SCREEN_PAD } from "./camera";
import { createLayoutCache } from "./chip-layout";
import type { Gesture, Modifiers, PointerKind } from "./gesture-types";
import { buildIndex } from "./hit-test";
import { interact } from "./interact";
import { initialInteraction } from "./interaction";
import type {
  InteractionCommand,
  InteractionContext,
  InteractionState,
  Interpreted,
  Tool,
} from "./interaction";

/** The id every wire drawn in these tests gets. */
export const WIRE_ID = WireIdSchema.parse("00000000-0000-4000-8000-0000000000aa");

export const NONE: Modifiers = { shift: false, alt: false, ctrlOrMeta: false, space: false };

/** World to screen at the default camera (zoom 1, origin at the screen padding). */
export const screen = (x: number, y: number): Point => ({ x: x + SCREEN_PAD, y: y + SCREEN_PAD });

/**
 * The demo, world units: pieces A (0,0) and B (0,80), 40 x 40; NAND (160,40), 120 x 80, pins
 * a (160,60), b (160,100), out (280,80); OUT (320,40). Wires A→a, B→b, out→OUT.
 */
export const setup = (tool: Tool = "select") => {
  const project = createDemoProject("x");
  const [chip] = project.chips;
  assert(chip !== undefined);
  const circuit = chip.draft;
  const scene = { project, circuit, layout: createLayoutCache() };
  const context: InteractionContext = {
    scene,
    chipId: chip.id,
    viewport: { width: 800, height: 600 },
    index: () => buildIndex(scene),
    newWireId: () => WIRE_ID,
    inputs: new Map(),
  };
  const [pieceA, pieceB, nand, pieceOut] = circuit.instances;
  assert(pieceA && pieceB && nand && pieceOut);
  const state = initialInteraction({ zoom: 1, x: 0, y: 0 }, tool);
  return { context, state, circuit, pieceA, pieceB, nand, pieceOut };
};

export const gesture = (
  state: InteractionState,
  context: InteractionContext,
  input: Gesture,
): Interpreted => interact(state, { type: "gesture", gesture: input }, context);

export const command = (
  state: InteractionState,
  context: InteractionContext,
  input: InteractionCommand,
): Interpreted => interact(state, { type: "command", command: input }, context);

/** Runs gestures in order, collecting every effect. */
export const gestures = (
  state: InteractionState,
  context: InteractionContext,
  inputs: readonly Gesture[],
): Interpreted =>
  inputs.reduce<Interpreted>(
    (acc, input) => {
      const next = gesture(acc.state, context, input);
      return { state: next.state, effects: [...acc.effects, ...next.effects] };
    },
    { state, effects: [] },
  );

export const tap = (point: Point, kind: PointerKind = "mouse", modifiers = NONE): Gesture => ({
  type: "tap",
  point,
  kind,
  modifiers,
});

/** A drag from `origin` to `end`, as the recognizer reports it. */
export const drag = (origin: Point, end: Point, modifiers = NONE): readonly Gesture[] => [
  { type: "dragStart", origin, point: origin, kind: "touch", modifiers, afterLongPress: false },
  { type: "dragMove", point: end },
  { type: "dragEnd", point: end },
];
