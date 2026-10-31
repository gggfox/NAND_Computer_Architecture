/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { expect } from "vitest";

import { EMPTY_CIRCUIT, newChip, piece, projectWith, wire } from "~/features/projects";
import type { ChipInstance, Circuit, PinKey, Point, Wire } from "~/features/projects";

import { createLayoutCache, PIN_CELL } from "../chip-layout";
import { layoutIn, wireRoute } from "../geometry";
import type { Scene } from "../geometry";

export const NAND_A = 0;
export const NAND_B = 1;
export const NAND_OUT = 2;

export const nandAt = (x: number, y: number): ChipInstance => piece({ type: "nand" }, { x, y });

/** A wire from `from`'s pin to `to`'s pin. */
export const link = (from: readonly [ChipInstance, PinKey], to: readonly [ChipInstance, PinKey]) =>
  wire({ instanceId: from[0].id, pin: from[1] }, { instanceId: to[0].id, pin: to[1] });

/** A scene whose open chip holds `instances` and `wires`, with a layout cache. */
export const sceneOf = (instances: readonly ChipInstance[], wires: readonly Wire[]): Scene => {
  const circuit: Circuit = { ...EMPTY_CIRCUIT, instances, wires };
  return {
    project: projectWith("routing", [newChip("c", circuit)]),
    circuit,
    layout: createLayoutCache(),
  };
};

export const withCircuit = (scene: Scene, circuit: Circuit): Scene => ({ ...scene, circuit });

/** A wire's drawn polyline in `scene`, by id. */
export const polylineOf = (scene: Scene, wireId: Wire["id"]): readonly Point[] => {
  const found = scene.circuit.wires.find((item) => item.id === wireId);
  return found === undefined ? [] : wireRoute(scene, found);
};

const steps = (from: Point, to: Point): readonly Point[] => {
  const count = Math.round((Math.abs(to.x - from.x) + Math.abs(to.y - from.y)) / PIN_CELL);
  return Array.from({ length: count + 1 }, (_unused, index) => ({
    x: from.x + Math.sign(to.x - from.x) * index * PIN_CELL,
    y: from.y + Math.sign(to.y - from.y) * index * PIN_CELL,
  }));
};

/** Every lattice node a polyline visits, in order (corners once). */
const nodesOf = (polyline: readonly Point[]): readonly Point[] =>
  polyline
    .slice(1)
    .reduce<Point[]>(
      (nodes, point, index) => [...nodes, ...steps(polyline[index] ?? point, point).slice(1)],
      polyline.slice(0, 1),
    );

const key = (point: Point): string => `${String(point.x)},${String(point.y)}`;

/** Every lattice edge a polyline uses, as an order-free key. */
export const edgesOf = (polyline: readonly Point[]): ReadonlySet<string> => {
  const nodes = nodesOf(polyline);
  return new Set(
    nodes.slice(1).map((node, index) => {
      const pair = [key(nodes[index] ?? node), key(node)].toSorted();
      return pair.join("|");
    }),
  );
};

type Role = "straight-x" | "straight-y" | "stop";

/** How a polyline passes each node it visits: straight across, straight down, or turning/ending. */
export const rolesOf = (polyline: readonly Point[]): ReadonlyMap<string, Role> => {
  const nodes = nodesOf(polyline);
  const roles = new Map<string, Role>();
  nodes.forEach((node, index) => {
    const before = nodes[index - 1];
    const after = nodes[index + 1];
    if (before === undefined || after === undefined) {
      roles.set(key(node), "stop");
      return;
    }
    const across: Role = before.y === after.y ? "straight-x" : "stop";
    roles.set(key(node), before.x === after.x ? "straight-y" : across);
  });
  return roles;
};

/**
 * Different signals: no shared lattice edge, and shared nodes are right-angle crossings. Nodes in
 * `exempt` (and edges between them) may be shared, such as a stub both wires leave a pin by.
 */
export const expectSpaced = (
  first: readonly Point[],
  second: readonly Point[],
  exempt: readonly Point[] = [],
) => {
  const skip = new Set(exempt.map((point) => key(point)));
  const edges = edgesOf(second);
  const ownEdge = (edge: string) => edge.split("|").every((end) => skip.has(end));
  expect([...edgesOf(first)].filter((edge) => edges.has(edge) && !ownEdge(edge))).toEqual([]);
  const roles = rolesOf(second);
  for (const [node, role] of rolesOf(first)) {
    const other = roles.get(node);
    if (other !== undefined && !skip.has(node)) {
      expect(role === "stop" || other === "stop" || role === other).toBe(false);
    }
  }
};

/** Whether the polyline (less a one-cell stub at each end) enters any chip rect grown by a cell. */
export const entersChips = (scene: Scene, polyline: readonly Point[]): boolean => {
  const nodes = nodesOf(polyline).slice(1, -1);
  const rects = scene.circuit.instances.map((item) => layoutIn(scene, item).rect);
  return nodes.some((node) =>
    rects.some(
      (rect) =>
        node.x > rect.x - PIN_CELL &&
        node.x < rect.x + rect.width + PIN_CELL &&
        node.y > rect.y - PIN_CELL &&
        node.y < rect.y + rect.height + PIN_CELL,
    ),
  );
};

export const COLUMNS = 20;
const PAIR = 2;
const PITCH = { x: 200, y: 120 } as const;

/**
 * `count` NANDs on a 20-column grid, the shape of `e2e/fixtures/300-chips.json`: each pair
 * cross-coupled through `a`, and each NAND's `b` fed by the NAND two before it (wrapping).
 */
export const gridScene = (count: number): Scene => {
  const instances = Array.from({ length: count }, (_unused, index) =>
    nandAt((index % COLUMNS) * PITCH.x, Math.floor(index / COLUMNS) * PITCH.y),
  );
  const at = (index: number): ChipInstance => instances[(index + count) % count] ?? nandAt(0, 0);
  const wires = instances.flatMap((_item, index) => [
    link([at(index % PAIR === 0 ? index + 1 : index - 1), NAND_OUT], [at(index), NAND_A]),
    link([at(index - PAIR), NAND_OUT], [at(index), NAND_B]),
  ]);
  return sceneOf(instances, wires);
};

const LAST = -1;
const BEFORE_LAST = -2;

const sideOf = (scene: Scene, end: Wire["from"]) => {
  const instance = scene.circuit.instances.find((item) => item.id === end.instanceId);
  return instance && layoutIn(scene, instance).pins.find((pin) => pin.key === end.pin)?.side;
};

/** Which way the stub at `anchor` heads, towards `next`. */
const headingOf = (anchor: Point | undefined, next: Point | undefined): string => {
  if (anchor === undefined || next === undefined || anchor.y !== next.y) {
    return "none";
  }
  return next.x > anchor.x ? "right" : "left";
};

/** The wire's drawn route is orthogonal, leaves each pin outward and enters no chip. */
export const expectClean = (scene: Scene, wireId: Wire["id"]) => {
  const found = scene.circuit.wires.find((item) => item.id === wireId);
  const polyline = polylineOf(scene, wireId);
  expect(found).toBeDefined();
  expect(polyline.length).toBeGreaterThan(1);
  const diagonal = polyline
    .slice(1)
    .filter((point, index) => point.x !== polyline[index]?.x && point.y !== polyline[index]?.y);
  expect(diagonal).toEqual([]);
  if (found !== undefined) {
    expect(headingOf(polyline[0], polyline[1])).toBe(sideOf(scene, found.from));
    expect(headingOf(polyline.at(LAST), polyline.at(BEFORE_LAST))).toBe(sideOf(scene, found.to));
  }
  expect(entersChips(scene, polyline)).toBe(false);
};
