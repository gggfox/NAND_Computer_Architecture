/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { PinKey, Point } from "~/features/projects";
import { assertNever } from "~/shared/assert-never";
import type { InstanceId, WireId } from "~/shared/ids";

import { GRID } from "./chip-layout";
import type { Rect } from "./chip-layout";
import { distance, layoutIn, segmentDistance, wireRoute } from "./geometry";
import type { Scene } from "./geometry";

/** The smallest target, in screen pixels (spec §3, WCAG 2.5.8). */
const TARGET_PX = 24;
const HALF = 0.5;
/** Bucket side in world units; a few hundred chips spread over a handful of buckets each. */
const BUCKET_CELLS = 4;
const BUCKET = BUCKET_CELLS * GRID;

type Entry =
  | {
      readonly type: "chip";
      readonly instanceId: InstanceId;
      readonly rect: Rect;
      readonly order: number;
    }
  | {
      readonly type: "pin";
      readonly instanceId: InstanceId;
      readonly pin: PinKey;
      readonly anchor: Point;
      readonly tab: Rect;
    }
  | { readonly type: "wire"; readonly wireId: WireId; readonly from: Point; readonly to: Point }
  | { readonly type: "label"; readonly instanceId: InstanceId; readonly rect: Rect };

/** Every chip, pin and wire segment of a scene, bucketed by where it lies. */
export interface SpatialIndex {
  readonly buckets: ReadonlyMap<string, readonly Entry[]>;
}

export type Hit =
  | {
      readonly type: "pin";
      readonly instanceId: InstanceId;
      readonly pin: PinKey;
      readonly anchor: Point;
    }
  | { readonly type: "chip"; readonly instanceId: InstanceId }
  /** A pin piece's name, outside its body. */
  | { readonly type: "label"; readonly instanceId: InstanceId }
  | { readonly type: "wire"; readonly wireId: WireId }
  | { readonly type: "empty" };

const EMPTY: Hit = { type: "empty" };

const cellOf = (value: number): number => Math.floor(value / BUCKET);

/** The bucket keys a rect touches. */
const keysOf = (rect: Rect): readonly string[] => {
  const keys: string[] = [];
  for (let column = cellOf(rect.x); column <= cellOf(rect.x + rect.width); column += 1) {
    for (let row = cellOf(rect.y); row <= cellOf(rect.y + rect.height); row += 1) {
      keys.push(`${String(column)}:${String(row)}`);
    }
  }
  return keys;
};

const segmentBox = (from: Point, to: Point): Rect => ({
  x: Math.min(from.x, to.x),
  y: Math.min(from.y, to.y),
  width: Math.abs(to.x - from.x),
  height: Math.abs(to.y - from.y),
});

const boxOf = (entry: Entry): Rect => {
  switch (entry.type) {
    case "chip":
    case "label": {
      return entry.rect;
    }
    case "pin": {
      return entry.tab;
    }
    case "wire": {
      return segmentBox(entry.from, entry.to);
    }
    default: {
      return assertNever(entry);
    }
  }
};

const chipEntries = (scene: Scene): readonly Entry[] =>
  scene.circuit.instances.flatMap((instance, order) => {
    const layout = layoutIn(scene, instance);
    const instanceId = instance.id;
    return [
      { type: "chip", instanceId, rect: layout.rect, order } as const,
      ...layout.pins.map(
        (pin) =>
          ({ type: "pin", instanceId, pin: pin.key, anchor: pin.anchor, tab: pin.tab }) as const,
      ),
      ...(layout.name === undefined
        ? []
        : [{ type: "label", instanceId, rect: layout.name } as const]),
    ];
  });

/** Each consecutive pair of points on a route. */
const segmentsOf = (route: readonly Point[]): readonly (readonly [Point, Point])[] => {
  const segments: (readonly [Point, Point])[] = [];
  let previous: Point | undefined = undefined;
  for (const point of route) {
    if (previous !== undefined) {
      segments.push([previous, point]);
    }
    previous = point;
  }
  return segments;
};

const wireEntries = (scene: Scene): readonly Entry[] =>
  scene.circuit.wires.flatMap((wire) =>
    segmentsOf(wireRoute(scene, wire)).map(
      ([from, to]) => ({ type: "wire", wireId: wire.id, from, to }) as const,
    ),
  );

/** Indexes the scene as drawn: a drag preview's `positions` and the layout cache apply. */
export const buildIndex = (scene: Scene): SpatialIndex => {
  const buckets = new Map<string, Entry[]>();
  for (const entry of [...wireEntries(scene), ...chipEntries(scene)]) {
    for (const key of keysOf(boxOf(entry))) {
      const bucket = buckets.get(key);
      if (bucket === undefined) {
        buckets.set(key, [entry]);
      } else {
        bucket.push(entry);
      }
    }
  }
  return { buckets };
};

/** The entries in every bucket a rect touches, each once. */
const entriesIn = (index: SpatialIndex, rect: Rect): readonly Entry[] => [
  ...new Set(keysOf(rect).flatMap((key) => index.buckets.get(key) ?? [])),
];

/** The entries within `reach` of a point; exported so tests can check that lookups stay local. */
export const candidatesNear = (
  index: SpatialIndex,
  point: Point,
  reach: number,
): readonly Entry[] =>
  entriesIn(index, {
    x: point.x - reach,
    y: point.y - reach,
    width: reach + reach,
    height: reach + reach,
  });

const contains = (rect: Rect, point: Point): boolean =>
  point.x >= rect.x &&
  point.x <= rect.x + rect.width &&
  point.y >= rect.y &&
  point.y <= rect.y + rect.height;

const overlaps = (first: Rect, second: Rect): boolean =>
  first.x <= second.x + second.width &&
  second.x <= first.x + first.width &&
  first.y <= second.y + second.height &&
  second.y <= first.y + first.height;

type PinEntry = Extract<Entry, { type: "pin" }>;

const isPin = (entry: Entry): entry is PinEntry => entry.type === "pin";

/**
 * The pin nearest `point` that is within `reach` (world units) of its anchor or inside its drawn
 * tab, among those `accept` allows (Phase 3 passes wiring legality); `undefined` when none is.
 */
export const nearestPin = (
  index: SpatialIndex,
  point: Point,
  {
    reach,
    accept = () => true,
  }: { readonly reach: number; readonly accept?: (hit: Hit & { type: "pin" }) => boolean },
): (Hit & { type: "pin" }) | undefined => {
  let best: { readonly hit: Hit & { type: "pin" }; readonly distance: number } | undefined =
    undefined;
  for (const entry of candidatesNear(index, point, reach).filter((item) => isPin(item))) {
    const away = distance(point, entry.anchor);
    const hit = {
      type: "pin",
      instanceId: entry.instanceId,
      pin: entry.pin,
      anchor: entry.anchor,
    } as const;
    if (
      (away <= reach || contains(entry.tab, point)) &&
      accept(hit) &&
      (best === undefined || away < best.distance)
    ) {
      best = { hit, distance: away };
    }
  }
  return best?.hit;
};

/** The topmost chip (last in canvas order) whose body holds the point. */
const chipAt = (entries: readonly Entry[], point: Point): Hit | undefined => {
  const chips = entries.filter(
    (entry): entry is Extract<Entry, { type: "chip" }> =>
      entry.type === "chip" && contains(entry.rect, point),
  );
  const [top] = chips.toSorted((first, second) => second.order - first.order);
  return top && { type: "chip", instanceId: top.instanceId };
};

/** Within `reach` of the rect's centre on each axis, or inside it: a target at least 24 px across. */
const inTarget = (rect: Rect, point: Point, reach: number): boolean =>
  Math.abs(point.x - (rect.x + rect.width * HALF)) <= Math.max(reach, rect.width * HALF) &&
  Math.abs(point.y - (rect.y + rect.height * HALF)) <= Math.max(reach, rect.height * HALF);

/** A pin piece's name under the point. */
const labelAt = (entries: readonly Entry[], point: Point, reach: number): Hit | undefined => {
  const label = entries.find(
    (entry) => entry.type === "label" && inTarget(entry.rect, point, reach),
  );
  return label?.type === "label" ? { type: "label", instanceId: label.instanceId } : undefined;
};

/** The wire with a segment nearest the point, within `reach`. */
const wireAt = (entries: readonly Entry[], point: Point, reach: number): Hit | undefined => {
  const [near] = entries
    .filter((entry): entry is Extract<Entry, { type: "wire" }> => entry.type === "wire")
    .map((entry) => ({ wireId: entry.wireId, away: segmentDistance(point, entry.from, entry.to) }))
    .filter((item) => item.away <= reach)
    .toSorted((first, second) => first.away - second.away);
  return near && { type: "wire", wireId: near.wireId };
};

/**
 * What a press at `point` (world units) means at `zoom` (spec §5.1, §7): a pin beats a chip body,
 * a chip body beats a pin piece's name, the name beats a wire, and a wire beats empty canvas.
 * Pins, names and wires reach half a target (12 screen px) at any zoom, so every target is at
 * least 24 px across.
 */
export const hitTest = (index: SpatialIndex, point: Point, zoom: number): Hit => {
  const reach = (TARGET_PX * HALF) / zoom;
  const pin = nearestPin(index, point, { reach });
  if (pin !== undefined) {
    return pin;
  }
  const entries = candidatesNear(index, point, reach);
  return (
    chipAt(entries, point) ??
    labelAt(entries, point, reach) ??
    wireAt(entries, point, reach) ??
    EMPTY
  );
};

/** The chips whose bodies touch `rect`, for box and lasso selection to filter further. */
export const chipsIn = (
  index: SpatialIndex,
  rect: Rect,
): readonly { readonly instanceId: InstanceId; readonly rect: Rect }[] => {
  const seen = new Map<InstanceId, Rect>();
  for (const entry of entriesIn(index, rect)) {
    if (entry.type === "chip" && overlaps(entry.rect, rect)) {
      seen.set(entry.instanceId, entry.rect);
    }
  }
  return [...seen].map(([instanceId, chipRect]) => ({ instanceId, rect: chipRect }));
};
