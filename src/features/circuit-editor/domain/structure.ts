/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { ChipInstance, PinRef, Wire, WireColor } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import type { ChipId, InstanceId, PinId, WireId } from "~/shared/ids";

import { chipLabel } from "./chip-label";
import { createLayoutCache } from "./chip-layout";
import { layoutIn, partOf, pinPosition } from "./geometry";
import type { Scene } from "./geometry";
import { readingOrder } from "./pin-selection";

/** One pin of a part, as the structure view lists it. */
export interface PinEntry {
  readonly ref: PinRef;
  /** The pin's label: `a`, or `d[4]` for a bus. */
  readonly name: string;
  /** The pin's own side of its part. An input piece has an output pin. */
  readonly direction: "input" | "output";
  readonly width: number;
  /** The pin and part across each wire on this pin, in wire order. A bit tap names its bit. */
  readonly connections: readonly string[];
}

export interface PartEntry {
  readonly instanceId: InstanceId;
  readonly label: string;
  readonly kind: "input" | "output" | "nand" | "custom" | "other";
  readonly pinId?: PinId;
  readonly custom?: ChipId;
  readonly pins: readonly PinEntry[];
}

export interface WireEntry {
  readonly wireId: WireId;
  readonly from: PinRef;
  readonly to: PinRef;
  readonly label: string;
  readonly color?: WireColor;
}

export interface Structure {
  readonly parts: readonly PartEntry[];
  readonly wires: readonly WireEntry[];
}

/** The names that wire text needs, found once per call. */
interface Names {
  /** Part labels, as the circuit summary shows them. */
  readonly parts: ReadonlyMap<InstanceId, string>;
  /** Pin labels by pin key. */
  readonly pins: ReadonlyMap<string, string>;
}

const pinKeyOf = ({ instanceId, pin }: PinRef): string => `${instanceId}/${String(pin)}`;

/** "{pin} of {chip}" for a wire end, as the canvas says it. A bit tap adds its bit: `d[4] bit 2`. */
const endText = (names: Names, end: PinRef): string => {
  const pin = names.pins.get(pinKeyOf(end)) ?? String(end.pin);
  return m.canvas_wire_end({
    pin: end.bit === undefined ? pin : `${pin} ${m.structure_bit({ bit: end.bit })}`,
    chip: names.parts.get(end.instanceId) ?? "",
  });
};

/** The part's label: "Input A", "Output OUT", any other part numbered. */
const labelOf = (scene: Scene, instance: ChipInstance): string => {
  const name = chipLabel(scene, instance.id);
  if (instance.kind.type !== "pin") {
    return name;
  }
  return partOf(scene.circuit, instance) === "input"
    ? m.input_named({ name })
    : m.output_named({ name });
};

const kindOf = (scene: Scene, instance: ChipInstance): PartEntry["kind"] => {
  const part = partOf(scene.circuit, instance);
  return part === "clock" || part === "split" || part === "merge" ? "other" : part;
};

const identityOf = (instance: ChipInstance): Pick<PartEntry, "pinId" | "custom"> => {
  const { kind } = instance;
  if (kind.type === "pin") {
    return { pinId: kind.pinId };
  }
  return kind.type === "custom" ? { custom: kind.chipId } : {};
};

/** Wires by the reading order of their sink: top to bottom, left to right, then wire order. */
const wiresInOrder = (scene: Scene): readonly Wire[] => {
  const { instances, wires } = scene.circuit;
  const byId = new Map(instances.map((item) => [item.id, item]));
  return wires
    .map((wire, order) => {
      const sink = byId.get(wire.to.instanceId);
      // A wire with no sink pin sorts first; the schema keeps this from happening.
      const anchor = (sink && pinPosition(scene, sink, wire.to.pin)) ?? { x: 0, y: 0 };
      return { wire, anchor, order };
    })
    .toSorted(readingOrder)
    .map(({ wire }) => wire);
};

const namesOf = (scene: Scene): Names => {
  const { instances } = scene.circuit;
  return {
    parts: new Map(instances.map((item) => [item.id, labelOf(scene, item)])),
    pins: new Map(
      instances.flatMap((item) =>
        layoutIn(scene, item).pins.map(
          (pin) => [pinKeyOf({ instanceId: item.id, pin: pin.key }), pin.label] as const,
        ),
      ),
    ),
  };
};

/** The text across each wire, by pin. A pin keeps the wire order. */
const connectionsOf = (names: Names, wires: readonly Wire[]): ReadonlyMap<string, string[]> => {
  const result = new Map<string, string[]>();
  const add = (at: PinRef, across: PinRef): void => {
    const key = pinKeyOf({ instanceId: at.instanceId, pin: at.pin });
    result.set(key, [...(result.get(key) ?? []), endText(names, across)]);
  };
  for (const { from, to } of wires) {
    add(from, to);
    add(to, from);
  }
  return result;
};

const wireEntry = (names: Names, wire: Wire): WireEntry => ({
  wireId: wire.id,
  from: wire.from,
  to: wire.to,
  label: m.canvas_wire_selected({
    from: endText(names, wire.from),
    to: endText(names, wire.to),
  }),
  ...(wire.color === undefined ? {} : { color: wire.color }),
});

interface Context {
  readonly scene: Scene;
  readonly names: Names;
  readonly connections: ReadonlyMap<string, readonly string[]>;
}

const partEntry = ({ scene, names, connections }: Context, instance: ChipInstance): PartEntry => ({
  instanceId: instance.id,
  label: names.parts.get(instance.id) ?? "",
  kind: kindOf(scene, instance),
  ...identityOf(instance),
  pins: layoutIn(scene, instance).pins.map((pin) => {
    const ref = { instanceId: instance.id, pin: pin.key };
    return {
      ref,
      name: pin.label,
      direction: pin.side === "left" ? "input" : "output",
      width: pin.width,
      connections: connections.get(pinKeyOf(ref)) ?? [],
    };
  }),
});

/**
 * The circuit as parts with their pins and as wires (Phase 6). Parts keep canvas order. Wires
 * keep the reading order of their sink. Names come from the same code as the announcements.
 * The scene is only read.
 */
export const structureOf = (source: Scene): Structure => {
  const scene: Scene = { ...source, layout: source.layout ?? createLayoutCache() };
  const names = namesOf(scene);
  const wires = wiresInOrder(scene);
  const connections = connectionsOf(names, wires);
  return {
    parts: scene.circuit.instances.map((item) => partEntry({ scene, names, connections }, item)),
    wires: wires.map((wire) => wireEntry(names, wire)),
  };
};
