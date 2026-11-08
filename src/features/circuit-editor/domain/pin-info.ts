import type { BitWidth, PinKey, PinRef, Wire } from "~/features/projects";
import type { InstanceId } from "~/shared/ids";

import { layoutIn } from "./geometry";
import type { Scene } from "./geometry";
import { pinValue } from "./signals";
import type { KnownLevels } from "./signals";
import { usedBits } from "./wiring-targets";

/** One wire end across from the pin: the part's title and its pin's label (`.n` for a bit tap). */
interface PinConnection {
  /** The wire's id. Two parts of the same chip can show the same `chip` and `pin`. */
  readonly key: string;
  readonly chip: string;
  readonly pin: string;
}

/** What the pin card shows (spec §5.1). */
export interface PinInfo {
  /** The pin's label: `a`, or `d[4]` for a bus. */
  readonly name: string;
  readonly width: BitWidth;
  readonly value?: number;
  /** `1`, or `0101 = 5` for a bus (most significant bit first); `?` until the engine reports. */
  readonly valueText: string;
  readonly connections: readonly PinConnection[];
  /** Bits of a bus pin with a wire tapped on them, ascending; empty for a 1-bit pin. */
  readonly usedBits: readonly number[];
}

/** `d0, d2`: the bits as the pin card lists them. */
export const bitsText = (bits: readonly number[]): string =>
  bits.map((bit) => `d${String(bit)}`).join(", ");

const UNKNOWN = "?";
const BINARY = 2;

const valueText = (value: number | undefined, width: BitWidth): string => {
  if (value === undefined) {
    return UNKNOWN;
  }
  return width === 1
    ? String(value)
    : `${value.toString(BINARY).padStart(width, "0")} = ${String(value)}`;
};

const describeEnd = (scene: Scene, end: PinRef): Omit<PinConnection, "key"> | undefined => {
  const instance = scene.circuit.instances.find((item) => item.id === end.instanceId);
  if (instance === undefined) {
    return undefined;
  }
  const layout = layoutIn(scene, instance);
  const label = layout.pins.find((item) => item.key === end.pin)?.label ?? String(end.pin);
  return { chip: layout.title, pin: end.bit === undefined ? label : `${label}.${String(end.bit)}` };
};

const isAt = (end: PinRef, instanceId: InstanceId, pin: PinKey): boolean =>
  end.instanceId === instanceId && end.pin === pin;

/** The end of `wire` across from the pin, or `undefined` when the wire does not touch it. */
const otherEnd = (wire: Wire, instanceId: InstanceId, pin: PinKey): PinRef | undefined => {
  if (isAt(wire.from, instanceId, pin)) {
    return wire.to;
  }
  return isAt(wire.to, instanceId, pin) ? wire.from : undefined;
};

/** The pin's card, or `undefined` when the instance or pin does not exist. */
export const pinInfo = (
  scene: Scene,
  known: KnownLevels,
  [instanceId, pin]: readonly [InstanceId, PinKey],
): PinInfo | undefined => {
  const instance = scene.circuit.instances.find((item) => item.id === instanceId);
  const layout = instance && layoutIn(scene, instance).pins.find((item) => item.key === pin);
  if (layout === undefined) {
    return undefined;
  }
  const value = pinValue(known, instanceId, pin);
  const connections = scene.circuit.wires.flatMap((wire) => {
    const other = otherEnd(wire, instanceId, pin);
    const described = other && describeEnd(scene, other);
    return described === undefined ? [] : [{ key: wire.id, ...described }];
  });
  return {
    name: layout.label,
    width: layout.width,
    ...(value === undefined ? {} : { value }),
    valueText: valueText(value, layout.width),
    connections,
    usedBits: usedBits(scene, instanceId, pin),
  };
};
