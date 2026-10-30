import type { ChipInstance, Circuit, PinKey, Wire } from "~/features/projects";
import { groupBy } from "~/shared/group-by";
import type { InstanceId } from "~/shared/ids";

/** Lookups the flattener needs, so resolving a pin never scans a circuit. */
export interface CircuitIndex {
  readonly instances: ReadonlyMap<InstanceId, ChipInstance>;
  /** The wires into each instance pin, keyed by `sinkKey`. */
  readonly sinks: ReadonlyMap<string, readonly Wire[]>;
  /** The piece of each of the circuit's own pins (the first, should a file hold two). */
  readonly pieces: ReadonlyMap<PinKey, InstanceId>;
}

export const sinkKey = (instanceId: InstanceId, pin: PinKey): string =>
  `${instanceId}:${String(pin)}`;

const piecesOf = (circuit: Circuit): ReadonlyMap<PinKey, InstanceId> => {
  const pieces = new Map<PinKey, InstanceId>();
  for (const item of circuit.instances) {
    if (item.kind.type === "pin" && !pieces.has(item.kind.pinId)) {
      pieces.set(item.kind.pinId, item.id);
    }
  }
  return pieces;
};

const build = (circuit: Circuit): CircuitIndex => ({
  instances: new Map(circuit.instances.map((item) => [item.id, item])),
  sinks: groupBy(circuit.wires, (item) => sinkKey(item.to.instanceId, item.to.pin)),
  pieces: piecesOf(circuit),
});

/*
 * Circuits are immutable, so an index stays valid for as long as its circuit is alive. A saved
 * version is one object shared by every instance of its chip, so it is indexed once.
 */
const cache = new WeakMap<Circuit, CircuitIndex>();

export const indexOf = (circuit: Circuit): CircuitIndex => {
  const known = cache.get(circuit);
  if (known !== undefined) {
    return known;
  }
  const index = build(circuit);
  cache.set(circuit, index);
  return index;
};
