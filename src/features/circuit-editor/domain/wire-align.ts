/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Point, Wire } from "~/features/projects";
import type { InstanceId } from "~/shared/ids";

import { PIN_CELL } from "./chip-layout";
import { pinPosition } from "./geometry";
import type { Scene } from "./geometry";

/**
 * The vertical nudges a drop may take. Chips snap to the grid, but pins sit on half-grid rows (a
 * NAND's output is half a grid lower than a pin piece's pin), so half a grid up or down is
 * sometimes the only way to make a wire straight.
 */
const NUDGES: readonly number[] = [-PIN_CELL, PIN_CELL];

type Positions = ReadonlyMap<InstanceId, Point>;

/** A wire end's pin y, with the dragged chips drawn at `positions`. */
const endY = (scene: Scene, end: Wire["from"]): number | undefined => {
  const instance = scene.circuit.instances.find((item) => item.id === end.instanceId);
  return instance === undefined ? undefined : pinPosition(scene, instance, end.pin)?.y;
};

const isStraight = (scene: Scene, wire: Wire): boolean => {
  const from = endY(scene, wire.from);
  return from !== undefined && from === endY(scene, wire.to);
};

const nudged = (positions: Positions, dy: number): Positions =>
  new Map([...positions].map(([id, point]) => [id, { x: point.x, y: point.y + dy }]));

const straightCount = (scene: Scene, positions: Positions, wires: readonly Wire[]): number => {
  const view: Scene = { ...scene, positions };
  return wires.filter((wire) => isStraight(view, wire)).length;
};

/**
 * Moves the dragged chips half a grid up or down when that makes more of the wires between them
 * and the chips that stay put run straight across. Otherwise, a tie included, it keeps
 * `positions` as they are.
 */
export const alignToWires = (scene: Scene, positions: Positions): Positions => {
  const crossing = scene.circuit.wires.filter(
    (wire) => positions.has(wire.from.instanceId) !== positions.has(wire.to.instanceId),
  );
  if (crossing.length === 0) {
    return positions;
  }
  let best = { positions, straight: straightCount(scene, positions, crossing) };
  for (const dy of NUDGES) {
    const candidate = nudged(positions, dy);
    const straight = straightCount(scene, candidate, crossing);
    if (straight > best.straight) {
      best = { positions: candidate, straight };
    }
  }
  return best.positions;
};
