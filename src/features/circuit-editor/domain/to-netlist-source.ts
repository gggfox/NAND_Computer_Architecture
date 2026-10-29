import type { ChipInstance, Circuit } from "~/features/projects";
import type { NetlistSource, SignalRef } from "~/features/simulation";
import type { InstanceId } from "~/shared/ids";
import { err, ok } from "~/shared/result";
import type { Result } from "~/shared/result";

export type NetlistSourceError =
  | { readonly type: "UnsupportedPart"; readonly instanceId: InstanceId }
  | { readonly type: "UnconnectedPin"; readonly instanceId: InstanceId; readonly pin: number };

type Outcome<T> = Result<T, NetlistSourceError>;

const SUPPORTED = new Set(["input", "nand", "output"]);
const NAND_PIN_A = 0;
const NAND_PIN_B = 1;
const SINGLE_PIN = 0;
const NOT_FOUND = -1;

const builtinOf = (instance: ChipInstance): string =>
  instance.kind.type === "builtin" ? instance.kind.builtin : "custom";

const ofKind = (circuit: Circuit, builtin: string): readonly ChipInstance[] =>
  circuit.instances.filter((item) => builtinOf(item) === builtin);

type Resolver = (instanceId: InstanceId, pin: number) => Outcome<SignalRef>;

const indexOfId = (parts: readonly ChipInstance[], id: InstanceId | undefined): number =>
  parts.findIndex((item) => item.id === id);

const createResolver =
  (circuit: Circuit, inputs: readonly ChipInstance[], nands: readonly ChipInstance[]): Resolver =>
  (instanceId, pin) => {
    const wire = circuit.wires.find(
      (candidate) => candidate.to.instanceId === instanceId && candidate.to.pin === pin,
    );
    const inputIndex = indexOfId(inputs, wire?.from.instanceId);
    if (inputIndex !== NOT_FOUND) {
      return ok({ kind: "input", index: inputIndex });
    }
    const nandIndex = indexOfId(nands, wire?.from.instanceId);
    if (nandIndex !== NOT_FOUND) {
      return ok({ kind: "nand", index: nandIndex });
    }
    return err({ type: "UnconnectedPin", instanceId, pin });
  };

/** Maps every item, stopping at the first failure. */
const mapAll = <T, U>(
  items: readonly T[],
  each: (item: T) => Outcome<U>,
): Outcome<readonly U[]> => {
  const values: U[] = [];
  for (const item of items) {
    const outcome = each(item);
    if (!outcome.ok) {
      return outcome;
    }
    values.push(outcome.value);
  }
  return ok(values);
};

const resolveNand = (
  resolve: Resolver,
  nand: ChipInstance,
): Outcome<NetlistSource["nands"][number]> => {
  const a = resolve(nand.id, NAND_PIN_A);
  const b = resolve(nand.id, NAND_PIN_B);
  if (!a.ok) {
    return a;
  }
  return b.ok ? ok({ a: a.value, b: b.value }) : b;
};

const build = (circuit: Circuit): Outcome<NetlistSource> => {
  const inputs = ofKind(circuit, "input");
  const nands = ofKind(circuit, "nand");
  const resolve = createResolver(circuit, inputs, nands);
  const nandRefs = mapAll(nands, (nand) => resolveNand(resolve, nand));
  if (!nandRefs.ok) {
    return nandRefs;
  }
  const outputRefs = mapAll(ofKind(circuit, "output"), (output) => resolve(output.id, SINGLE_PIN));
  if (!outputRefs.ok) {
    return outputRefs;
  }
  return ok({ inputCount: inputs.length, nands: nandRefs.value, outputs: outputRefs.value });
};

/**
 * Pin mapping: a wire's `to.pin` 0 is a NAND's input `a` and 1 is input `b`;
 * `input`/`output` parts have the single pin 0. Each instance has one output
 * signal, so a wire's `from.pin` only identifies the source instance.
 * Inputs, NANDs and outputs are indexed by their order in `circuit.instances`.
 */
export const toNetlistSource = (circuit: Circuit): Outcome<NetlistSource> => {
  const unsupported = circuit.instances.find((item) => !SUPPORTED.has(builtinOf(item)));
  return unsupported === undefined
    ? build(circuit)
    : err({ type: "UnsupportedPart", instanceId: unsupported.id });
};
