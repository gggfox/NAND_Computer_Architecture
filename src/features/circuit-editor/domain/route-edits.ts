/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { findChip } from "~/features/projects";
import type {
  Chip,
  ChipInstance,
  Circuit,
  PinRef,
  Point,
  Project,
  Wire,
} from "~/features/projects";
import type { ChipId, InstanceId, WireId } from "~/shared/ids";

import { pinPosition } from "./geometry";
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
const newlyBlocked = (
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

/** How far a wire end's anchor moved; `undefined` when it did not (or has no anchor to move). */
type Shift = Point | undefined;

const shiftOf = (before: Point | undefined, after: Point | undefined): Shift =>
  before === undefined || after === undefined || (before.x === after.x && before.y === after.y)
    ? undefined
    : { x: after.x - before.x, y: after.y - before.y };

/**
 * A wire after its end anchors shift, or `undefined` when it must be routed again (ADR 44). An
 * automatic wire with a moved end re-routes, as do hand bends with one end moved or with ends
 * moved apart; hand bends whose two ends move by the same delta move with them.
 */
const carried = (wire: Wire, from: Shift, to: Shift): Wire | undefined => {
  if (from === undefined && to === undefined) {
    return wire;
  }
  if (!wire.manualWaypoints || from === undefined || to === undefined) {
    return undefined;
  }
  if (from.x !== to.x || from.y !== to.y) {
    return undefined;
  }
  return {
    ...wire,
    waypoints: wire.waypoints.map((point) => ({ x: point.x + from.x, y: point.y + from.y })),
  };
};

type Anchors = (end: PinRef) => Point | undefined;

const anchorsIn = (scene: Scene): Anchors => {
  const instances = new Map<InstanceId, ChipInstance>(
    scene.circuit.instances.map((item) => [item.id, item]),
  );
  return (end) => {
    const instance = instances.get(end.instanceId);
    return instance && pinPosition(scene, instance, end.pin);
  };
};

const diagonal = (anchor: Point | undefined, waypoint: Point | undefined): boolean =>
  anchor !== undefined &&
  waypoint !== undefined &&
  anchor.x !== waypoint.x &&
  anchor.y !== waypoint.y;

/**
 * The hand-bent wires whose stub, from a pin's anchor now to its nearest waypoint, is neither
 * horizontal nor vertical: an anchor moved across it since the bends were made. A diagonal stub is
 * never a valid route; a stub that is still straight keeps its bends, even if its anchor moved.
 */
export const brokenStubs = (scene: Scene): ReadonlySet<WireId> => {
  const anchor = anchorsIn(scene);
  const broken = scene.circuit.wires.filter(
    (wire) =>
      wire.manualWaypoints &&
      (diagonal(anchor(wire.from), wire.waypoints[0]) ||
        diagonal(anchor(wire.to), wire.waypoints.at(-1))),
  );
  return new Set(broken.map((wire) => wire.id));
};

/**
 * The after-draft with every wire on `instanceIds` whose end anchor moved `carried`, and the ids of
 * the wires that must be routed again.
 */
const carriedAll = (change: Required<Change>, instanceIds: ReadonlySet<InstanceId>) => {
  const [before, after] = [anchorsIn(change.before), anchorsIn(change.after)];
  const shift = (end: PinRef): Shift =>
    instanceIds.has(end.instanceId) ? shiftOf(before(end), after(end)) : undefined;
  const stale = new Set<WireId>();
  const wires = change.after.circuit.wires.map((wire) => {
    const kept = carried(wire, shift(wire.from), shift(wire.to));
    if (kept === undefined) {
      stale.add(wire.id);
    }
    return kept ?? wire;
  });
  const moved = wires.some((wire, index) => wire !== change.after.circuit.wires[index]);
  return { circuit: moved ? { ...change.after.circuit, wires } : change.after.circuit, stale };
};

/**
 * After `instanceIds` moved or changed shape: wires whose end anchors moved are carried or routed
 * again, and automatic wires those instances newly block are routed again, as one edit.
 */
export const reshaped = (
  change: Required<Change>,
  instanceIds: ReadonlySet<InstanceId>,
): Circuit => {
  const { circuit, stale } = carriedAll(change, instanceIds);
  const after = { ...change.after, circuit };
  const blocked = newlyBlocked({ before: change.before, after }, instanceIds);
  return settled(after, new Set([...stale, ...blocked]));
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

type DraftEdit = (project: Project, draft: Circuit) => Circuit;

/**
 * What a draft's layouts read from the project besides the draft: the names of the custom chips
 * it places (a name sets a chip's width). Saved versions are the same in every snapshot, since a
 * save rewrites them all, but a rename is an undo step, so names can differ across a history.
 */
const namesKey = (project: Project, draft: Circuit): string => {
  const placed = new Set(
    draft.instances.flatMap((item) => (item.kind.type === "custom" ? [item.kind.chipId] : [])),
  );
  return JSON.stringify(
    project.chips.filter((chip) => placed.has(chip.id)).map((chip) => chip.name),
  );
};

/**
 * A memo for one pass over a history: snapshots share drafts, so a draft object whose placed
 * chips have the same names is edited once, and every snapshot holding it gets the same result.
 */
const createDraftMemo = () => {
  const seen = new Map<Circuit, Map<string, Circuit>>();
  return (project: Project, draft: Circuit, edit: () => Circuit): Circuit => {
    const key = namesKey(project, draft);
    const byNames = seen.get(draft) ?? new Map<string, Circuit>();
    seen.set(draft, byNames);
    const known = byNames.get(key) ?? edit();
    byNames.set(key, known);
    return known;
  };
};

/**
 * A project mapper for one pass over a history (see `createDraftMemo`). Use a new one per pass,
 * since the result also depends on the project around the draft.
 */
const perPass = (edit: DraftEdit) => (): ((project: Project) => Project) => {
  const memo = createDraftMemo();
  return (project) =>
    mapDrafts(project, ({ draft }) => memo(project, draft, () => edit(project, draft)));
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
 * After `chipId` changed shape between `before` and `after` (a save or a rename), routes the wires
 * its instances moved or newly block, in every draft that places it.
 */
const reshapedPlacements = (
  { before, after }: { readonly before: Project; readonly after: Project },
  chip: Chip,
  chipId: ChipId,
): Circuit => {
  const placed = placementsOf(chip.draft, chipId);
  if (placed.size === 0) {
    return chip.draft;
  }
  const earlier = findChip(before, chip.id)?.draft ?? chip.draft;
  return reshaped(
    {
      before: { project: before, circuit: earlier },
      after: { project: after, circuit: chip.draft },
    },
    placed,
  );
};

/** `after` with every draft placing `chipId` re-routed for its new shape (see `reshaped`). */
export const rerouteReshaped = (before: Project, after: Project, chipId: ChipId): Project =>
  mapDrafts(after, (chip) => reshapedPlacements({ before, after }, chip, chipId));

/**
 * After saving `chipId`, its new shape may move pins or cover wires in the drafts that place it.
 * Takes each snapshot before and after the save. One per pass over a history: a draft object is
 * handled once per set of placed chip names, so snapshots keep sharing it.
 */
export const createRerouteAfterSave = (
  chipId: ChipId,
): ((before: Project, after: Project) => Project) => {
  const memo = createDraftMemo();
  return (before, after) =>
    mapDrafts(after, (chip) =>
      memo(after, chip.draft, () => reshapedPlacements({ before, after }, chip, chipId)),
    );
};
