import type { PinKey } from "~/features/projects";
import type { NetlistSource, SignalRef } from "~/features/simulation";
import type { InstanceId } from "~/shared/ids";

import { pinLevelKey } from "./signals";
import type { Level } from "./signals";
import type { Flattened } from "./to-netlist-source";

/** Where one probed pin's bits sit in the engine's outputs: bit 0 at `indices[0]`. */
export interface ProbeSlot {
  readonly instanceId: InstanceId;
  readonly pin: PinKey;
  readonly indices: readonly number[];
}

/** What the engine loads: the netlist with every probed signal appended to its outputs once. */
export interface ProbedNetlist {
  readonly source: NetlistSource;
  readonly slots: readonly ProbeSlot[];
}

const refKey = (ref: SignalRef): string =>
  ref.kind === "clock" ? "clock" : `${ref.kind}:${String(ref.index)}`;

/**
 * Appends each distinct probed signal to the netlist's outputs, after the open chip's own outputs,
 * so the engine reports probes the same way it reports outputs. A signal is reported once, however
 * many pins carry it.
 */
export const withProbes = ({ source, probes }: Flattened): ProbedNetlist => {
  const outputs = [...source.outputs];
  // Seeded with the outputs themselves, so probing an output's own signal reuses its slot.
  const positions = new Map<string, number>();
  for (const [index, ref] of outputs.entries()) {
    if (!positions.has(refKey(ref))) {
      positions.set(refKey(ref), index);
    }
  }
  const indexOf = (ref: SignalRef): number => {
    const key = refKey(ref);
    const known = positions.get(key);
    if (known !== undefined) {
      return known;
    }
    positions.set(key, outputs.length);
    outputs.push(ref);
    return outputs.length - 1;
  };
  const slots = probes.map((probe) => ({
    instanceId: probe.instanceId,
    pin: probe.pin,
    indices: probe.bits.map((ref) => indexOf(ref)),
  }));
  return { source: { ...source, outputs }, slots };
};

/** Each probed pin's value, keyed by `pinLevelKey`; a missing bit reads as 0. */
export const probeLevels = (
  slots: readonly ProbeSlot[],
  bits: readonly Level[],
): ReadonlyMap<string, number> =>
  new Map(
    slots.map((slot) => [
      pinLevelKey(slot.instanceId, slot.pin),
      slot.indices.reduce<number>((sum, index, bit) => sum | ((bits[index] ?? 0) << bit), 0),
    ]),
  );
