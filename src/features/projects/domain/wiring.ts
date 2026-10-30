/* oxlint-disable typescript/prefer-readonly-parameter-types -- projects, circuits and pin refs carry branded ids (mutable object types); none is mutated */
import type { InstanceId, WireId } from "~/shared/ids";
import { err, ok } from "~/shared/result";
import type { Result } from "~/shared/result";

import type { BitWidth, Circuit, PinKey, PinRef, Project, Wire } from "./model";
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

const resolve = (
  project: Project,
  circuit: Circuit,
  ref: PinRef,
): Result<Resolved, ConnectionError> => {
  const instance = circuit.instances.find((item) => item.id === ref.instanceId);
  const info = instance && endpointInfo(project, circuit, instance, ref.pin);
  return info === undefined
    ? err({ type: "InvalidEndpoint", instanceId: ref.instanceId, pin: ref.pin })
    : ok({ ref, info });
};

const checkBit = ({ ref, info }: Resolved): ConnectionError | undefined => {
  if (ref.bit === undefined) {
    return undefined;
  }
  return info.width > 1 && ref.bit < info.width
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
  project: Project,
  circuit: Circuit,
  [first, second]: readonly [PinRef, PinRef],
): Result<readonly [Resolved, Resolved], ConnectionError> => {
  const left = resolve(project, circuit, first);
  const right = resolve(project, circuit, second);
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

/** Validates joining two pins; the result's `from` is always the source end. */
// oxlint-disable-next-line eslint/max-params -- project, circuit, both ends and the ignored wire are the specified interface
export const checkConnection = (
  project: Project,
  circuit: Circuit,
  first: PinRef,
  second: PinRef,
  ignoreWireId?: WireId,
): Result<Connection, ConnectionError> => {
  const ends = resolveBoth(project, circuit, [first, second]);
  const oriented = ends.ok ? orient(...ends.value) : ends;
  if (!oriented.ok) {
    return oriented;
  }
  const [source, sink] = oriented.value;
  const width = checkEnds(source, sink);
  if (!width.ok) {
    return width;
  }
  return drivenAlready(circuit, sink.ref, ignoreWireId)
    ? err({ type: "InputAlreadyDriven", instanceId: sink.ref.instanceId })
    : ok({ from: source.ref, to: sink.ref, bitWidth: width.value });
};

const refsEqual = (first: PinRef, second: PinRef): boolean =>
  first.instanceId === second.instanceId && first.pin === second.pin && first.bit === second.bit;

const matches = (stored: Wire, connection: Connection): boolean =>
  refsEqual(connection.from, stored.from) &&
  refsEqual(connection.to, stored.to) &&
  connection.bitWidth === stored.bitWidth;

/** The first stored wire that no longer passes `checkConnection` as stored. */
export const findInvalidWire = (project: Project, circuit: Circuit): Wire | undefined =>
  circuit.wires.find((item) => {
    const result = checkConnection(project, circuit, item.from, item.to, item.id);
    return !result.ok || !matches(item, result.value);
  });
