import { assertNever } from "~/shared/assert-never";
import type { InstanceId, WireId } from "~/shared/ids";

import type { Scene } from "./geometry";
import type { Armed, BitPick, InteractionState, Menu } from "./interaction";
import { prune } from "./selection";
import { legalTargets } from "./wiring-targets";

const stillThere = <Overlay extends { readonly instanceId: InstanceId }>(
  overlay: Overlay | undefined,
  ids: ReadonlySet<InstanceId>,
): Overlay | undefined =>
  overlay !== undefined && ids.has(overlay.instanceId) ? overlay : undefined;

interface Present {
  readonly instances: ReadonlySet<InstanceId>;
  readonly wires: ReadonlySet<WireId>;
}

const menuThere = (menu: Menu | undefined, present: Present): boolean => {
  switch (menu?.kind) {
    case "chip": {
      return present.instances.has(menu.instanceId);
    }
    case "wire": {
      return present.wires.has(menu.wireId);
    }
    case "canvas": {
      return true;
    }
    case undefined: {
      return false;
    }
    default: {
      return assertNever(menu);
    }
  }
};

/** The armed pin with its legal targets recomputed, or nothing when its chip is gone. */
const rearmed = (armed: Armed | undefined, scene: Scene): Partial<InteractionState> =>
  armed === undefined || !scene.circuit.instances.some((item) => item.id === armed.end.instanceId)
    ? {}
    : { armed: { ...armed, legal: legalTargets(scene, armed.end) } };

const pickThere = (pick: BitPick | undefined, present: Present): boolean =>
  pick !== undefined &&
  present.instances.has(pick.armed.instanceId) &&
  present.instances.has(pick.target.instanceId);

/** A wire being drawn from a chip that is gone ends with it, as does a gone wire's bend drag. */
const dragAfter = (state: InteractionState, present: Present): Partial<InteractionState> => {
  const { drag } = state;
  return drag === undefined ||
    (drag.kind === "wire" && !present.instances.has(drag.from.instanceId)) ||
    (drag.kind === "segment" && !present.wires.has(drag.wireId))
    ? {}
    : { drag };
};

/** The wiring overlays that outlive an edit, undo or redo. */
const wiringAfter = (state: InteractionState, scene: Scene, present: Present) => {
  const { armed, bitPick, bends } = state;
  return {
    ...rearmed(armed, scene),
    ...(pickThere(bitPick, present) ? { bitPick } : {}),
    ...(bends !== undefined && present.wires.has(bends) ? { bends } : {}),
  };
};

/**
 * After an edit, undo or redo: forget selected, focused, armed and overlaid things that are gone,
 * and recompute the armed pin's legal targets for the new circuit.
 */
export const afterHistory = (state: InteractionState, scene: Scene): InteractionState => {
  const { circuit } = scene;
  const present: Present = {
    instances: new Set(circuit.instances.map((item) => item.id)),
    wires: new Set(circuit.wires.map((item) => item.id)),
  };
  const {
    focus,
    menu,
    card,
    hover: _hover,
    armed: _armed,
    bitPick: _pick,
    bends: _bends,
    drag: _drag,
    ...rest
  } = state;
  return {
    ...rest,
    selection: prune(state.selection, circuit),
    ...(focus !== undefined && present.instances.has(focus) ? { focus } : {}),
    ...(menuThere(menu, present) ? { menu } : {}),
    ...(stillThere(card, present.instances) === undefined ? {} : { card }),
    ...wiringAfter(state, scene, present),
    ...dragAfter(state, present),
  };
};
