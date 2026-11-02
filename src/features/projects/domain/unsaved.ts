/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- chips and circuits carry branded ids (mutable object types); none is mutated */
import type { ChipInstance, Chip, Circuit, PinDef, PinRef, Point, Wire } from "./model";

/** `new` has no saved version yet, `changed` has a draft that differs from it, `saved` matches. */
export type UnsavedState = "new" | "changed" | "saved";

const sameList = <Item>(
  left: readonly Item[],
  right: readonly Item[],
  same: (a: Item, b: Item) => boolean,
): boolean =>
  left.length === right.length && left.every((item, index) => same(item, right[index]!));

const samePoint = (left: Point, right: Point): boolean => left.x === right.x && left.y === right.y;

const samePin = (left: PinDef, right: PinDef): boolean =>
  left.id === right.id &&
  left.name === right.name &&
  left.width === right.width &&
  left.direction === right.direction;

/** The one value a kind carries beyond its type: a bus width, a pin or a chip. */
const kindDetail = (kind: ChipInstance["kind"]): number | string | undefined => {
  if ("width" in kind) {
    return kind.width;
  }
  if ("pinId" in kind) {
    return kind.pinId;
  }
  return "chipId" in kind ? kind.chipId : undefined;
};

const sameKind = (left: ChipInstance["kind"], right: ChipInstance["kind"]): boolean =>
  left.type === right.type && kindDetail(left) === kindDetail(right);

const sameInstance = (left: ChipInstance, right: ChipInstance): boolean =>
  left.id === right.id &&
  left.label === right.label &&
  samePoint(left.position, right.position) &&
  sameKind(left.kind, right.kind);

const sameRef = (left: PinRef, right: PinRef): boolean =>
  left.instanceId === right.instanceId && left.pin === right.pin && left.bit === right.bit;

/** Automatic routes are derived, so only a hand-bent wire's waypoints count (D1). */
const sameRoute = (left: Wire, right: Wire): boolean =>
  left.manualWaypoints === right.manualWaypoints &&
  (!left.manualWaypoints || sameList(left.waypoints, right.waypoints, samePoint));

const sameWire = (left: Wire, right: Wire): boolean =>
  left.id === right.id &&
  left.bitWidth === right.bitWidth &&
  left.color === right.color &&
  sameRef(left.from, right.from) &&
  sameRef(left.to, right.to) &&
  sameRoute(left, right);

/**
 * Whether two circuits have equal pins (order included), instances and wires. The
 * waypoints of automatic wires are ignored (D1); the same object matches at once.
 */
export const circuitsMatch = (left: Circuit, right: Circuit): boolean =>
  left === right ||
  (sameList(left.pins, right.pins, samePin) &&
    sameList(left.instances, right.instances, sameInstance) &&
    sameList(left.wires, right.wires, sameWire));

/** `new` without a saved version; `changed` when the draft doesn't match it. */
export const unsavedState = (chip: Chip): UnsavedState => {
  if (chip.saved === undefined) {
    return "new";
  }
  return circuitsMatch(chip.draft, chip.saved) ? "saved" : "changed";
};

/** Whether saving would change anything: the chip is new or its draft differs. */
export const hasUnsavedChanges = (chip: Chip): boolean => unsavedState(chip) !== "saved";
