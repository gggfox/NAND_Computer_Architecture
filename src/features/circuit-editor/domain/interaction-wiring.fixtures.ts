/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { assert } from "vitest";

import { piece } from "~/features/projects";
import type { ChipInstance, Point } from "~/features/projects";

import { layoutIn } from "./geometry";
import type { Scene } from "./geometry";
import { buildIndex } from "./hit-test";
import type { Effect, InteractionContext } from "./interaction";
import { screen, setup } from "./interaction.fixtures";

/**
 * The demo without its A → a wire, so A's output can reach the NAND's free input `a`, plus a
 * 4-bit split at (480, 200) whose bus input asks for a bit.
 */
const at = (point: Point): Point => screen(point.x, point.y);

/** The 4-bit split's bus input: its key and where it is on screen. */
const busInOf = (scene: Scene, split: ChipInstance) => {
  const layout = layoutIn(scene, split);
  const busIn = layout.pins.find((pin) => pin.anchor.x === layout.rect.x);
  assert(busIn !== undefined);
  return { key: busIn.key, screen: at(busIn.anchor) };
};

export const wiring = () => {
  const base = setup();
  const split = piece({ type: "split", width: 4 }, { x: 480, y: 200 });
  const [removed, ...wires] = base.circuit.wires;
  assert(removed !== undefined);
  const circuit = { ...base.circuit, instances: [...base.circuit.instances, split], wires };
  const scene = { ...base.context.scene, circuit };
  const context: InteractionContext = { ...base.context, scene, index: () => buildIndex(scene) };
  return { ...base, context, circuit, split, busIn: busInOf(scene, split) };
};

/** Screen points on the demo: A's output, the NAND's input `a`, output and body, empty canvas. */
export const PIN_A_OUT = at({ x: 40, y: 20 });
export const NAND_A = at({ x: 160, y: 60 });
export const NAND_OUT = at({ x: 280, y: 80 });
export const NAND_BODY = at({ x: 220, y: 80 });
export const EMPTY = at({ x: 600, y: 400 });

/** The edits among `effects`. */
export const dispatched = (effects: readonly Effect[]) =>
  effects.flatMap((effect) => (effect.type === "dispatch" ? [effect.action] : []));
