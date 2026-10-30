import { findChip } from "~/features/projects";
import type { Chip, Circuit, Point, Project, Wire } from "~/features/projects";
import type { ChipId, InstanceId, WireId } from "~/shared/ids";

import type { Scene } from "./geometry";
import { blockersOf, rerouted, unroutedWires } from "./routing/route";

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

/** A draft before and after an edit; with no `before`, every block counts as new. */
interface Change {
  readonly before?: Scene;
  readonly after: Scene;
}

/**
 * The automatic wires that one of `instanceIds` (placed, moved or resized by the edit) blocks after
 * the edit but did not block before it. Wires blocked by other chips, or only by an instance that
 * already blocked them, were not affected by the edit, so they stay put.
 */
export const newlyBlocked = (
  change: Change,
  instanceIds: ReadonlySet<InstanceId>,
): ReadonlySet<WireId> => {
  const now = blockersOf(change.after, instanceIds);
  const was: ReadonlyMap<WireId, ReadonlySet<InstanceId>> = change.before === undefined
    ? new Map()
    : blockersOf(change.before, instanceIds);
  const fresh = [...now].filter(([wireId, by]) => {
    const earlier = was.get(wireId);
    return [...by].some((instanceId) => earlier?.has(instanceId) !== true);
  });
  return new Set(fresh.map(([wireId]) => wireId));
};

/** Re-routes the `newlyBlocked` wires of the edited draft. */
export const blockedRerouted = (change: Change, instanceIds: ReadonlySet<InstanceId>): Circuit =>
  settled(change.after, newlyBlocked(change, instanceIds));

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

type DraftEdit = (project: Project, draft: Circuit) => Circuit;

/**
 * A project mapper for one pass over a history: snapshots share drafts, so each draft object is
 * edited once and every snapshot holding it gets the same result. Use a new one per pass, since
 * the result also depends on the project around the draft.
 */
const perPass = (edit: DraftEdit) => (): ((project: Project) => Project) => {
  const seen = new Map<Circuit, Circuit>();
  return (project) =>
    mapDrafts(project, ({ draft }) => {
      const known = seen.get(draft) ?? edit(project, draft);
      seen.set(draft, known);
      return known;
    });
};

/**
 * Routes every draft's automatic wires that have no waypoints (files from before the router).
 * A straight route is also stored as no waypoints; it routes to the same and stays as it was.
 */
export const createRouteUnrouted = perPass((project, draft) =>
  settled({ project, circuit: draft }, unroutedWires(draft)),
);

/** The instances of `chipId` placed in `circuit`. */
const placementsOf = (circuit: Circuit, chipId: ChipId): ReadonlySet<InstanceId> =>
  new Set(
    circuit.instances
      .filter((item) => item.kind.type === "custom" && item.kind.chipId === chipId)
      .map((item) => item.id),
  );

/**
 * After saving `chipId`, its new shape may cover wires in the drafts that place it. Takes each
 * snapshot before and after the save, so only wires the new shape newly blocks are re-routed. One
 * per pass over a history: each draft object is handled once, so snapshots keep sharing it.
 */
export const createRerouteAfterSave = (
  chipId: ChipId,
): ((before: Project, after: Project) => Project) => {
  const seen = new Map<Circuit, Circuit>();
  const reroute = (before: Project, after: Project, chip: Chip): Circuit => {
    const placed = placementsOf(chip.draft, chipId);
    if (placed.size === 0) {
      return chip.draft;
    }
    const earlier = findChip(before, chip.id)?.draft ?? chip.draft;
    return blockedRerouted(
      {
        before: { project: before, circuit: earlier },
        after: { project: after, circuit: chip.draft },
      },
      placed,
    );
  };
  return (before, after) =>
    mapDrafts(after, (chip) => {
      const known = seen.get(chip.draft) ?? reroute(before, after, chip);
      seen.set(chip.draft, known);
      return known;
    });
};
