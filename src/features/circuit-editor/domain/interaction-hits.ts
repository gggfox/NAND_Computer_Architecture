import type { Point } from "~/features/projects";
import type { InstanceId } from "~/shared/ids";

import { screenToWorld } from "./camera";
import { hitTest } from "./hit-test";
import type { Hit } from "./hit-test";
import type { InteractionContext, InteractionState } from "./interaction";

export const toWorld = (state: InteractionState, screen: Point): Point =>
  screenToWorld(state.camera, screen);

export const hitAt = (state: InteractionState, context: InteractionContext, screen: Point): Hit =>
  hitTest(context.index(), toWorld(state, screen), state.camera.zoom);

/** The chip a hit belongs to: a pin counts as its chip. */
export const chipOf = (hit: Hit): InstanceId | undefined =>
  hit.type === "pin" || hit.type === "chip" ? hit.instanceId : undefined;
