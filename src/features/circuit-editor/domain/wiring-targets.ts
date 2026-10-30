import { checkConnection, endpointInfo, pinKeys } from "~/features/projects";
import type { Circuit, PinKey, PinRef } from "~/features/projects";
import type { InstanceId } from "~/shared/ids";

import type { Scene } from "./geometry";
import { pinLevelKey } from "./signals";

/** What tapping a target pin does while another pin is armed. */
export type Completion =
  | { readonly type: "connect"; readonly from: PinRef; readonly to: PinRef }
  | {
      readonly type: "pickBit";
      /** Which end is the bus the bit goes on. */
      readonly bus: "armed" | "target";
      readonly bits: readonly number[];
    }
  | { readonly type: "illegal" };

const ILLEGAL: Completion = { type: "illegal" };

/** The pin's width as a wire sees it (a tapped bit counts as 1); NaN for a pin that is not there. */
const sideWidth = (scene: Scene, ref: PinRef): number => {
  const [width] = scene.circuit.instances
    .filter((item) => item.id === ref.instanceId)
    .map((item) => endpointInfo(scene.project, scene.circuit, item, ref.pin)?.width);
  return ref.bit === undefined ? Number(width) : 1;
};

/** A bus end still needs a bit when it has none and the other end is a single bit. */
const needsBit = (scene: Scene, bus: PinRef, other: PinRef): boolean =>
  bus.bit === undefined && sideWidth(scene, other) === 1 && sideWidth(scene, bus) > 1;

const connectOf = (result: ReturnType<typeof checkConnection>): Completion =>
  result.ok ? { type: "connect", from: result.value.from, to: result.value.to } : ILLEGAL;

interface Ends {
  readonly armed: PinRef;
  readonly target: PinRef;
}

/** The ends with `bit` chosen on the bus one. */
const tapped = ({ armed, target }: Ends, bus: "armed" | "target", bit: number): Ends => ({
  armed: bus === "armed" ? { ...armed, bit } : armed,
  target: bus === "target" ? { ...target, bit } : target,
});

const connectEnds = (scene: Scene, { armed, target }: Ends): Completion =>
  connectOf(checkConnection(scene.project, scene.circuit, armed, target));

const chooseBit = (scene: Scene, ends: Ends, bus: "armed" | "target"): Completion => {
  const width = sideWidth(scene, ends[bus]);
  const free = Array.from({ length: width }, (_unused, bit) => bit).filter(
    (bit) => connectEnds(scene, tapped(ends, bus, bit)).type === "connect",
  );
  const [only] = free;
  if (only === undefined) {
    return ILLEGAL;
  }
  return free.length > 1
    ? { type: "pickBit", bus, bits: free }
    : connectEnds(scene, tapped(ends, bus, only));
};

/** What tapping `target` while `armed` does. */
export const completionFor = (scene: Scene, armed: PinRef, target: PinRef): Completion => {
  const direct = checkConnection(scene.project, scene.circuit, armed, target);
  if (direct.ok || direct.error.type !== "WidthMismatch") {
    return connectOf(direct);
  }
  if (needsBit(scene, target, armed)) {
    return chooseBit(scene, { armed, target }, "target");
  }
  return needsBit(scene, armed, target) ? chooseBit(scene, { armed, target }, "armed") : ILLEGAL;
};

/** `pinLevelKey` of every pin that can take a wire from `armed` (some bit choice may be needed). */
export const legalTargets = (scene: Scene, armed: PinRef): ReadonlySet<string> => {
  const keys = new Set<string>();
  for (const instance of scene.circuit.instances) {
    for (const pin of pinKeys(scene.project, instance)) {
      if (completionFor(scene, armed, { instanceId: instance.id, pin }).type !== "illegal") {
        keys.add(pinLevelKey(instance.id, pin));
      }
    }
  }
  return keys;
};

/** Bits of a bus pin that have a wire attached (spec §5.10: the pin card shows them). */
export const usedBits = (
  circuit: Circuit,
  instanceId: InstanceId,
  pin: PinKey,
): readonly number[] => {
  const bits = new Set<number>();
  for (const { from, to } of circuit.wires) {
    for (const end of [from, to]) {
      if (end.instanceId === instanceId && end.pin === pin && end.bit !== undefined) {
        bits.add(end.bit);
      }
    }
  }
  return [...bits].toSorted((first, second) => first - second);
};
