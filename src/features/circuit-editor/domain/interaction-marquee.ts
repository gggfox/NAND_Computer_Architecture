/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Point } from "~/features/projects";

import { chipsIn } from "./hit-test";
import { selected } from "./interaction";
import type { Drag, InteractionContext, InteractionState, Interpreted } from "./interaction";
import { addInstances, inBox, inLasso, selectInstances, withInnerWires } from "./selection";

type Rect = Parameters<typeof chipsIn>[1];
type Marquee = Extract<Drag, { kind: "marquee" }>;

/** A lasso's points so far, or a box from its first corner to `world`. */
export const marqueePoints = (drag: Marquee, world: Point): readonly Point[] =>
  drag.shape === "lasso" ? [...drag.points, world] : [...drag.points.slice(0, 1), world];

const boundsOfPoints = (points: readonly Point[]): Rect => {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const [x, y] = [Math.min(...xs), Math.min(...ys)];
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
};

/** A marquee ended: what it holds is selected, with the wires between. */
export const endMarquee = (
  state: InteractionState,
  drag: Marquee,
  context: InteractionContext,
): Interpreted => {
  const bounds = boundsOfPoints(drag.points);
  const chips = chipsIn(context.index(), bounds);
  const ids = drag.shape === "box" ? inBox(chips, bounds) : inLasso(chips, drag.points);
  const base = drag.additive ? addInstances(state.selection, ids) : selectInstances(ids);
  return selected(state, withInnerWires(context.scene.circuit, base));
};
