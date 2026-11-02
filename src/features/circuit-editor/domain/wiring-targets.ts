import { checkConnection, endpointInfo, pinKeys } from "~/features/projects";
import type { ConnectionError, PinKey, PinRef } from "~/features/projects";
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
  /** Nothing can connect; `reason` says why. */
  | { readonly type: "illegal"; readonly reason: ConnectionError };

const illegal = (reason: ConnectionError): Completion => ({ type: "illegal", reason });

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
  result.ok
    ? { type: "connect", from: result.value.from, to: result.value.to }
    : illegal(result.error);

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

/** Which bus end gets a bit, and why the whole pins could not connect. */
interface Fallback {
  readonly bus: "armed" | "target";
  readonly mismatch: ConnectionError;
}

const chooseBit = (scene: Scene, ends: Ends, { bus, mismatch }: Fallback): Completion => {
  const width = sideWidth(scene, ends[bus]);
  const free = Array.from({ length: width }, (_unused, bit) => bit).filter(
    (bit) => connectEnds(scene, tapped(ends, bus, bit)).type === "connect",
  );
  const [only] = free;
  if (only === undefined) {
    return illegal(mismatch);
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
  const mismatch = direct.error;
  if (needsBit(scene, target, armed)) {
    return chooseBit(scene, { armed, target }, { bus: "target", mismatch });
  }
  return needsBit(scene, armed, target)
    ? chooseBit(scene, { armed, target }, { bus: "armed", mismatch })
    : illegal(mismatch);
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

/** Bits of a bus pin that have a wire attached; a whole-bus wire uses every bit. */
export const usedBits = (scene: Scene, instanceId: InstanceId, pin: PinKey): readonly number[] => {
  const width = sideWidth(scene, { instanceId, pin });
  const ends = scene.circuit.wires
    .flatMap(({ from, to }) => [from, to])
    .filter((end) => end.instanceId === instanceId && end.pin === pin);
  const whole = width > 1 && ends.some((end) => end.bit === undefined);
  const bits = whole
    ? Array.from({ length: width }, (_unused, bit) => bit)
    : ends.flatMap((end) => (end.bit === undefined ? [] : [end.bit]));
  return [...new Set(bits)].toSorted((first, second) => first - second);
};
