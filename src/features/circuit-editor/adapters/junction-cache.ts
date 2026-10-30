import type { Point } from "~/features/projects";

import { wireRoute } from "../domain/geometry";
import { junctions } from "../domain/junctions";
import { signalOf } from "../domain/routing/route";
import type { Frame } from "./frame";

type Route = readonly Point[];

/** Junction dots by signal; signals without a dot are absent. */
export type Dots = ReadonlyMap<string, readonly Point[]>;

const dotsOf = (routes: ReadonlyMap<string, readonly Route[]>): Dots => {
  const dots = new Map<string, readonly Point[]>();
  for (const [signal, signalRoutes] of routes) {
    const found = junctions(new Map([[signal, signalRoutes]]));
    if (found.length > 0) {
      dots.set(signal, found);
    }
  }
  return dots;
};

/** Every wire's route in the frame's circuit, by signal. */
const allRoutes = (frame: Frame): ReadonlyMap<string, readonly Route[]> => {
  const routes = new Map<string, Route[]>();
  for (const wire of frame.circuit.wires) {
    const signal = signalOf(wire);
    const route = wireRoute(frame, wire);
    const known = routes.get(signal);
    if (known === undefined) {
      routes.set(signal, [route]);
    } else {
      known.push(route);
    }
  }
  return routes;
};

interface Entry {
  readonly project: Frame["project"];
  readonly circuit: Frame["circuit"];
  readonly dots: Dots;
}

/** The last still circuit's dots: pan, zoom and level changes reuse them. */
const memo: { entry?: Entry } = {};

/**
 * The junction dots for a frame. A whole, still frame reuses the dots of the whole circuit,
 * computed once per edit (routes depend only on the project and the open circuit). A drag frame
 * draws in parts with moving routes, so it computes the dots of `partRoutes` (its own wires).
 */
export const junctionDots = (
  frame: Frame,
  partRoutes: ReadonlyMap<string, readonly Route[]>,
): Dots => {
  const still = frame.part === undefined && (frame.positions?.size ?? 0) === 0;
  if (!still) {
    return dotsOf(partRoutes);
  }
  const { project, circuit } = frame;
  const known = memo.entry;
  if (known?.project === project && known.circuit === circuit) {
    return known.dots;
  }
  const dots = dotsOf(allRoutes(frame));
  memo.entry = { project, circuit, dots };
  return dots;
};
