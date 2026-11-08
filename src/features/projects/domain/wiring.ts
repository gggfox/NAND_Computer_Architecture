/* oxlint-disable typescript/prefer-readonly-parameter-types -- projects, circuits and pin refs carry branded ids (mutable object types); none is mutated */
import { groupBy } from "~/shared/group-by";
import type { InstanceId, WireId } from "~/shared/ids";
import { err, ok } from "~/shared/result";
import type { Result } from "~/shared/result";

import type { BitWidth, ChipInstance, Circuit, PinKey, PinRef, Project, Wire } from "./model";
import { endpointInfo } from "./pins";
import type { EndpointInfo } from "./pins";

export type ConnectionError =
  | { readonly type: "InvalidEndpoint"; readonly instanceId: InstanceId; readonly pin: PinKey }
  | { readonly type: "BitOutOfRange"; readonly bit: number; readonly width: number }
  | { readonly type: "WidthMismatch"; readonly from: number; readonly to: number }
  | { readonly type: "OutputToOutput" }
  | { readonly type: "InputToInput" }
  | { readonly type: "InputAlreadyDriven"; readonly instanceId: InstanceId };

export interface Connection {
  readonly from: PinRef;
  readonly to: PinRef;
  readonly bitWidth: BitWidth;
}

interface Resolved {
  readonly ref: PinRef;
  readonly info: EndpointInfo;
}

/** Finds a placed instance by id; `findInvalidWire` passes an indexed one. */
type Lookup = (instanceId: InstanceId) => ChipInstance | undefined;

interface Scope {
  readonly project: Project;
  readonly circuit: Circuit;
  readonly lookup: Lookup;
}

const scanLookup =
  (circuit: Circuit): Lookup =>
  (instanceId) =>
    circuit.instances.find((item) => item.id === instanceId);

const resolve = (
  { project, circuit, lookup }: Scope,
  ref: PinRef,
): Result<Resolved, ConnectionError> => {
  const instance = lookup(ref.instanceId);
  const info = instance && endpointInfo(project, circuit, instance, ref.pin);
  return info === undefined
    ? err({ type: "InvalidEndpoint", instanceId: ref.instanceId, pin: ref.pin })
    : ok({ ref, info });
};

const checkBit = ({ ref, info }: Resolved): ConnectionError | undefined => {
  if (ref.bit === undefined) {
    return undefined;
  }
  return info.width > 1 && Number.isInteger(ref.bit) && ref.bit >= 0 && ref.bit < info.width
    ? undefined
    : { type: "BitOutOfRange", bit: ref.bit, width: info.width };
};

/** A tap counts as one bit. */
const effectiveWidth = ({ ref, info }: Resolved): BitWidth =>
  ref.bit === undefined ? info.width : 1;

const overlaps = (first: PinRef, second: PinRef): boolean =>
  first.bit === undefined || second.bit === undefined || first.bit === second.bit;

const drivenAlready = (circuit: Circuit, sink: PinRef, ignoreWireId: WireId | undefined): boolean =>
  circuit.wires.some(
    (item) =>
      item.id !== ignoreWireId &&
      item.to.instanceId === sink.instanceId &&
      item.to.pin === sink.pin &&
      overlaps(item.to, sink),
  );

const resolveBoth = (
  scope: Scope,
  [first, second]: readonly [PinRef, PinRef],
): Result<readonly [Resolved, Resolved], ConnectionError> => {
  const left = resolve(scope, first);
  const right = resolve(scope, second);
  if (!left.ok) {
    return left;
  }
  if (!right.ok) {
    return right;
  }
  const badBit = checkBit(left.value) ?? checkBit(right.value);
  return badBit === undefined ? ok([left.value, right.value] as const) : err(badBit);
};

/** `[source, sink]`, or the role clash. */
const orient = (
  left: Resolved,
  right: Resolved,
): Result<readonly [Resolved, Resolved], ConnectionError> => {
  if (left.info.role === right.info.role) {
    return err({ type: left.info.role === "source" ? "OutputToOutput" : "InputToInput" });
  }
  return ok(left.info.role === "source" ? ([left, right] as const) : ([right, left] as const));
};

const checkEnds = (source: Resolved, sink: Resolved): Result<BitWidth, ConnectionError> => {
  const from = effectiveWidth(source);
  const to = effectiveWidth(sink);
  return from === to ? ok(from) : err({ type: "WidthMismatch", from, to });
};

/** Every check but "is the sink already driven". */
const connectionOf = (
  scope: Scope,
  ends: readonly [PinRef, PinRef],
): Result<Connection, ConnectionError> => {
  const resolved = resolveBoth(scope, ends);
  const oriented = resolved.ok ? orient(...resolved.value) : resolved;
  if (!oriented.ok) {
    return oriented;
  }
  const [source, sink] = oriented.value;
  const width = checkEnds(source, sink);
  return width.ok ? ok({ from: source.ref, to: sink.ref, bitWidth: width.value }) : width;
};

/** Validates joining two pins; the result's `from` is always the source end. */
// oxlint-disable-next-line eslint/max-params -- project, circuit, both ends and the ignored wire are the specified interface
export const checkConnection = (
  project: Project,
  circuit: Circuit,
  first: PinRef,
  second: PinRef,
  ignoreWireId?: WireId,
): Result<Connection, ConnectionError> => {
  const connection = connectionOf({ project, circuit, lookup: scanLookup(circuit) }, [
    first,
    second,
  ]);
  if (!connection.ok) {
    return connection;
  }
  const sink = connection.value.to;
  return drivenAlready(circuit, sink, ignoreWireId)
    ? err({ type: "InputAlreadyDriven", instanceId: sink.instanceId })
    : connection;
};

const refsEqual = (first: PinRef, second: PinRef): boolean =>
  first.instanceId === second.instanceId && first.pin === second.pin && first.bit === second.bit;

const matches = (stored: Wire, connection: Connection): boolean =>
  refsEqual(connection.from, stored.from) &&
  refsEqual(connection.to, stored.to) &&
  connection.bitWidth === stored.bitWidth;

const sinkKey = (ref: PinRef): string => `${ref.instanceId}:${String(ref.pin)}`;

/** True when another wire in `sinks` joins a sink bit that `item` also joins. */
const hasRival = (sinks: ReadonlyMap<string, readonly Wire[]>, item: Wire): boolean =>
  (sinks.get(sinkKey(item.to)) ?? []).some(
    (other) => other.id !== item.id && overlaps(other.to, item.to),
  );

/** The first wire that joins a sink bit another wire also joins, or `undefined`. */
export const findDoublyDrivenWire = (circuit: Circuit): Wire | undefined => {
  const sinks = groupBy(circuit.wires, (item) => sinkKey(item.to));
  return circuit.wires.find((item) => hasRival(sinks, item));
};

/**
 * The first stored wire that no longer passes `checkConnection` as stored. Linear in the circuit:
 * instances are looked up by id and the single-driver check only compares wires into the same pin.
 */
export const findInvalidWire = (project: Project, circuit: Circuit): Wire | undefined => {
  const instances = new Map(circuit.instances.map((item) => [item.id, item]));
  const scope: Scope = { project, circuit, lookup: (instanceId) => instances.get(instanceId) };
  const sinks = groupBy(circuit.wires, (item) => sinkKey(item.to));
  return circuit.wires.find((item) => {
    const result = connectionOf(scope, [item.from, item.to]);
    return !result.ok || !matches(item, result.value) || hasRival(sinks, item);
  });
};
