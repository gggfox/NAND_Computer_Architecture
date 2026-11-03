/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { ChipInstance, Point } from "~/features/projects";

import { boundsOf } from "./camera";
import { layoutIn } from "./geometry";
import type { Rect, Scene } from "./geometry";

const NO_DELTA: Point = { x: 0, y: 0 };

/** The smallest rect holding `instances` as laid out in `scene` and moved by `delta`; `undefined` when empty. */
export const piecesBounds = (
  scene: Scene,
  instances: readonly ChipInstance[],
  delta: Point = NO_DELTA,
): Rect | undefined =>
  boundsOf(
    instances.map((item) => {
      const { rect } = layoutIn(scene, item);
      return { ...rect, x: rect.x + delta.x, y: rect.y + delta.y };
    }),
  );
