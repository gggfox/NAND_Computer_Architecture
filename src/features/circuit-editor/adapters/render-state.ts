import type { Circuit, Point, Project } from "~/features/projects";
import type { InstanceId } from "~/shared/ids";

import type { Camera } from "../domain/camera";
import type { KnownLevels } from "../domain/signals";
import type { OverlayView } from "./draw-overlays";

/** Everything the renderer reads for one frame. */
export interface RenderState extends KnownLevels {
  /** The interaction layer: selection, hover, marquee, wiring, and the drag preview's positions. */
  readonly overlay?: OverlayView & { readonly positions?: ReadonlyMap<InstanceId, Point> };
  readonly project: Project;
  readonly circuit: Circuit;
  readonly view: Camera;
}
