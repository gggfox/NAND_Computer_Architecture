/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { ChipInstance, Circuit, PinRef, Point, Wire } from "~/features/projects";
import type { InstanceId, WireId } from "~/shared/ids";
import { err, ok } from "~/shared/result";
import type { Result } from "~/shared/result";

import { PIN_CELL } from "../chip-layout";
import { layoutIn, wireRoute } from "../geometry";
import type { Scene } from "../geometry";
import { buildLattice, nodeAt } from "./lattice";
import type { Box, CellRoute, Lattice, Stub } from "./lattice";
import { boxOf, cellBox, entersAny, normalised, toCell, withoutStubs } from "./polyline";
import { createScratch } from "./scratch";
import type { Scratch } from "./scratch";
import { search } from "./search";
import type { SearchFailure } from "./search";

export interface RouteError {
  readonly type: "NoRoute";
  readonly wireId: WireId;
}

/** The search window is the ends' box padded by this many cells, doubled on each failed try. */
const PADDING = 8;
const TRIES = 3;
const WIDER = 2;
const RIGHT = 0;
const LEFT = 2;
const LAST = -1;

const colorOf = (wire: Wire): string =>
  "color" in wire && typeof wire.color === "string" ? wire.color : "default";

/** Wires of one signal (source pin, bit and colour) may share edges; other signals may not. */
export const signalOf = (wire: Wire): string => {
  const { instanceId, pin, bit } = wire.from;
  const bitName = bit === undefined ? "*" : String(bit);
  return `${instanceId}:${String(pin)}:${bitName}:${colorOf(wire)}`;
};

interface Context {
  readonly scene: Scene;
  readonly instances: ReadonlyMap<InstanceId, ChipInstance>;
  /** Every chip's rect in cells; the lattice blocks these cells. */
  readonly rects: readonly Box[];
  readonly signals: Map<string, number>;
  /** The routes the wire being routed must keep clear of, by wire. */
  readonly routes: Map<WireId, CellRoute>;
  readonly scratch: Scratch;
}

const signalNumber = (context: Context, wire: Wire): number => {
  const name = signalOf(wire);
  const known = context.signals.get(name);
  if (known !== undefined) {
    return known;
  }
  context.signals.set(name, context.signals.size);
  return context.signals.size - 1;
};

const cellRouteOf = (context: Context, wire: Wire): CellRoute => {
  const points = normalised(wireRoute(context.scene, wire).map((point) => toCell(point)));
  return { signal: signalNumber(context, wire), points, box: boxOf(points) };
};

const contextOf = (scene: Scene, others: readonly Wire[]): Context => {
  const { instances } = scene.circuit;
  const context: Context = {
    scene,
    instances: new Map(instances.map((item) => [item.id, item])),
    rects: instances.map((item) => cellBox(layoutIn(scene, item).rect)),
    signals: new Map(),
    routes: new Map(),
    scratch: createScratch(),
  };
  for (const other of others) {
    context.routes.set(other.id, cellRouteOf(context, other));
  }
  return context;
};

/** A pin's anchor in cells and the heading its stub leaves in: right exits +x, left exits −x. */
const stubOf = (context: Context, ref: PinRef): Stub | undefined => {
  const instance = context.instances.get(ref.instanceId);
  const pin =
    instance && layoutIn(context.scene, instance).pins.find((item) => item.key === ref.pin);
  return pin && { anchor: toCell(pin.anchor), heading: pin.side === "right" ? RIGHT : LEFT };
};

const windowOf = (ends: readonly [Stub, Stub], padding: number): Box => {
  const box = boxOf(ends.map((end) => end.anchor));
  return {
    minX: box.minX - padding,
    minY: box.minY - padding,
    maxX: box.maxX + padding,
    maxY: box.maxY + padding,
  };
};

/** Interior bends of a node path, in world units. */
const waypointsOf = (lattice: Lattice, path: readonly number[]): readonly Point[] =>
  normalised(
    path.map((node) => ({
      x: ((node % lattice.width) + lattice.box.minX) * PIN_CELL,
      y: (Math.floor(node / lattice.width) + lattice.box.minY) * PIN_CELL,
    })),
  ).slice(1, LAST);

interface Attempt {
  readonly ends: readonly [Stub, Stub];
  readonly signal: number;
  readonly relaxed: boolean;
  readonly scratch: Scratch;
}

/** One search from the start; when it fails short of a verdict, one from the goal for the verdict. */
const attempt = (lattice: Lattice, { ends, ...rest }: Attempt) => {
  const [from, to] = ends;
  const start = nodeAt(lattice, from.anchor);
  const goal = nodeAt(lattice, to.anchor);
  const found = search({ ...rest, lattice, start, startHeading: from.heading, goal });
  if (found.ok || found.error === "Walled") {
    return found.ok ? ok(waypointsOf(lattice, found.value)) : found;
  }
  // Costs are symmetric, so the goal side fails too; if it is walled in, no wider window helps.
  const back = search({ ...rest, lattice, start: goal, startHeading: to.heading, goal: start });
  return back.ok ? found : back;
};

/** The lattices of one wire's windows, built on first use and shared by both passes. */
type Lattices = (tries: number) => Lattice;

const latticesFor = (context: Context, ends: readonly [Stub, Stub]): Lattices => {
  const built: Lattice[] = [];
  return (tries) => {
    const known = built[tries];
    if (known !== undefined) {
      return known;
    }
    const box = windowOf(ends, PADDING * WIDER ** tries);
    const lattice = buildLattice({
      box,
      rects: context.rects,
      routes: context.routes.values(),
      stubs: ends,
    });
    built[tries] = lattice;
    return lattice;
  };
};

/**
 * Searches windows padded by 8, 16 and 32 cells, widening only while the search reached the
 * window's border. The relaxed pass (other signals' edges allowed at a penalty) does the same.
 */
const widening = (
  lattices: Lattices,
  request: Attempt,
): Result<readonly Point[], SearchFailure> => {
  let result: Result<readonly Point[], SearchFailure> = err("Window");
  for (let tries = 0; tries < TRIES && !result.ok && result.error === "Window"; tries += 1) {
    result = attempt(lattices(tries), request);
  }
  return result;
};

const routeEnds = (context: Context, ends: readonly [Stub, Stub], signal: number) => {
  const lattices = latticesFor(context, ends);
  const { scratch } = context;
  const strict = widening(lattices, { ends, signal, relaxed: false, scratch });
  return strict.ok ? strict : widening(lattices, { ends, signal, relaxed: true, scratch });
};

const routeIn = (context: Context, wire: Wire): Result<readonly Point[], RouteError> => {
  const from = stubOf(context, wire.from);
  const to = stubOf(context, wire.to);
  const found = from && to && routeEnds(context, [from, to], signalNumber(context, wire));
  return found?.ok === true ? ok(found.value) : err({ type: "NoRoute", wireId: wire.id });
};

/** Interior bends only: the full polyline is [startAnchor, ...waypoints, endAnchor]. */
export const routeWire = (
  scene: Scene,
  wire: Wire,
  others: readonly Wire[],
): Result<readonly Point[], RouteError> =>
  routeIn(
    contextOf(
      scene,
      others.filter((other) => other.id !== wire.id),
    ),
    wire,
  );

/**
 * Routes `wireIds` one by one (circuit order), each around every other wire's current route;
 * NoRoute keeps waypoints []. Sets manualWaypoints false. Other wires are untouched.
 */
export const rerouted = (scene: Scene, wireIds: ReadonlySet<WireId>): Circuit => {
  const context = contextOf(scene, scene.circuit.wires);
  const wires = scene.circuit.wires.map((wire) => {
    if (!wireIds.has(wire.id)) {
      return wire;
    }
    context.routes.delete(wire.id);
    const result = routeIn(context, wire);
    const next: Wire = {
      ...wire,
      waypoints: result.ok ? result.value : [],
      manualWaypoints: false,
    };
    context.routes.set(wire.id, cellRouteOf(context, next));
    return next;
  });
  return { ...scene.circuit, wires };
};

/** Automatic wires whose current route enters an inflated chip rect (other than their own stubs). */
export const blockedWires = (scene: Scene): ReadonlySet<WireId> => {
  const rects = scene.circuit.instances.map((item) => layoutIn(scene, item).rect);
  const blocked = scene.circuit.wires.filter(
    (wire) => !wire.manualWaypoints && entersAny(withoutStubs(wireRoute(scene, wire)), rects),
  );
  return new Set(blocked.map((wire) => wire.id));
};

/** Automatic wires with no waypoints. */
export const unroutedWires = (circuit: Circuit): ReadonlySet<WireId> =>
  new Set(
    circuit.wires
      .filter((wire) => !wire.manualWaypoints && wire.waypoints.length === 0)
      .map((wire) => wire.id),
  );
