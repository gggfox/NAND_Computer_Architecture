import { checkConnection } from "~/features/projects";
import type { Wire } from "~/features/projects";
import { newWireId } from "~/shared/ids";

import type { Scene } from "./geometry";
import { wireRoute } from "./geometry";
import { settled } from "./route-edits";
import type { Proposal } from "./suggest-wires";
import type { Ghost } from "./suggestion-types";

/**
 * Up to this many ghosts are routed like real wires; above it routing (roughly quadratic) would
 * not fit a 16 ms frame, so ghosts are drawn as elbows (D9). Measured in the Status of the plan.
 */
export const GHOST_ROUTE_CAP = 64;

/** Each proposal oriented by `checkConnection` against the ones before it, as `connectWires` does. */
const draftWires = (scene: Scene, proposals: readonly Proposal[]): readonly Wire[] => {
  const wires: Wire[] = [];
  const draft = { ...scene.circuit, wires: [...scene.circuit.wires] };
  for (const { from, to } of proposals) {
    const connection = checkConnection(scene.project, draft, from, to);
    if (connection.ok) {
      const wire: Wire = {
        id: newWireId(),
        ...connection.value,
        waypoints: [],
        manualWaypoints: false,
      };
      wires.push(wire);
      draft.wires.push(wire);
    }
  }
  return wires;
};

/**
 * Each proposal with the route a real wire would take, all routed at once over a draft (D9).
 * The draft's wires get fresh random ids, so they can't clash with a real one; they are never
 * dispatched.
 */
export const ghostsOf = (scene: Scene, proposals: readonly Proposal[]): readonly Ghost[] => {
  const wires = draftWires(scene, proposals);
  const drafted = {
    ...scene,
    circuit: { ...scene.circuit, wires: [...scene.circuit.wires, ...wires] },
  };
  const ids = new Set(wires.map((wire) => wire.id));
  const routed =
    wires.length <= GHOST_ROUTE_CAP ? { ...drafted, circuit: settled(drafted, ids) } : drafted;
  return routed.circuit.wires
    .filter((wire) => ids.has(wire.id))
    .map((wire) => ({ from: wire.from, to: wire.to, route: wireRoute(routed, wire) }));
};
