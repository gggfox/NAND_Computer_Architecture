import type { Chip, Circuit, Point, Project, Wire } from "~/features/projects";
import type { ChipId, WireId } from "~/shared/ids";

import type { Scene } from "./geometry";
import { blockedWires, rerouted, unroutedWires } from "./routing/route";

const samePoints = (first: readonly Point[], second: readonly Point[]): boolean =>
  first.length === second.length &&
  first.every((point, index) => point.x === second[index]?.x && point.y === second[index]?.y);

const sameRoute = (before: Wire, after: Wire): boolean =>
  before.manualWaypoints === after.manualWaypoints && samePoints(before.waypoints, after.waypoints);

/**
 * `rerouted`, but a wire whose route comes out the same stays the same object, and the circuit
 * stays the same object when no route changed, so routing never churns what it did not move.
 */
export const settled = (scene: Scene, wireIds: ReadonlySet<WireId>): Circuit => {
  const { circuit } = scene;
  if (wireIds.size === 0) {
    return circuit;
  }
  const next = rerouted(scene, wireIds);
  const wires = next.wires.map((wire, index) => {
    const before = circuit.wires[index];
    return before !== undefined && sameRoute(before, wire) ? before : wire;
  });
  return wires.every((wire, index) => wire === circuit.wires[index]) ? circuit : { ...next, wires };
};

/** Re-routes the automatic wires that now run through a chip in `circuit`, a draft of `project`. */
export const blockedRerouted = (project: Project, circuit: Circuit): Circuit => {
  const scene: Scene = { project, circuit };
  return settled(scene, blockedWires(scene));
};

/** Maps each chip's draft, keeping chips (and the project) whose draft came back unchanged. */
const mapDrafts = (project: Project, edit: (chip: Chip) => Circuit): Project => {
  const chips = project.chips.map((chip) => {
    const draft = edit(chip);
    return draft === chip.draft ? chip : { ...chip, draft };
  });
  return chips.every((chip, index) => chip === project.chips[index])
    ? project
    : { ...project, chips };
};

/**
 * Drafts already through `routeUnrouted`, by draft object. Snapshots share drafts, so mapping a
 * whole history routes each draft once; a routed draft maps to itself.
 */
const routedDrafts = new WeakMap<Circuit, Circuit>();

const routedDraft = (project: Project, draft: Circuit): Circuit => {
  const known = routedDrafts.get(draft);
  if (known !== undefined) {
    return known;
  }
  const routed = settled({ project, circuit: draft }, unroutedWires(draft));
  routedDrafts.set(draft, routed);
  routedDrafts.set(routed, routed);
  return routed;
};

/**
 * Routes every draft's automatic wires that have no waypoints (files from before the router).
 * A straight route is also stored as no waypoints; it routes to the same and stays as it was.
 */
export const routeUnrouted = (project: Project): Project =>
  mapDrafts(project, (chip) => routedDraft(project, chip.draft));

const places = (circuit: Circuit, chipId: ChipId): boolean =>
  circuit.instances.some((item) => item.kind.type === "custom" && item.kind.chipId === chipId);

/** After saving `chipId`, its new shape may cover wires in the drafts that place it. */
export const rerouteAfterSave = (project: Project, chipId: ChipId): Project =>
  mapDrafts(project, (chip) =>
    places(chip.draft, chipId) ? blockedRerouted(project, chip.draft) : chip.draft,
  );
