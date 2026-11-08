import { err, ok } from "~/shared/result";
import type { Result } from "~/shared/result";

export type SignalRef =
  | { readonly kind: "input"; readonly index: number }
  | { readonly kind: "clock" }
  | { readonly kind: "nand"; readonly index: number };

/** The engine's own input format; it knows nothing about projects or chips. */
export interface NetlistSource {
  readonly inputCount: number;
  readonly nands: readonly { readonly a: SignalRef; readonly b: SignalRef }[];
  readonly outputs: readonly SignalRef[];
}

/** Signal index layout is `[inputs..., clock, nand outputs...]`. */
export interface Netlist {
  readonly inputCount: number;
  readonly nandCount: number;
  readonly nandA: Int32Array;
  readonly nandB: Int32Array;
  readonly outputs: Int32Array;
}

export type CompileError =
  | { readonly type: "SignalOutOfRange"; readonly ref: SignalRef }
  | { readonly type: "InvalidInputCount"; readonly inputCount: number };

const NOT_FOUND = -1;

const inRange = (index: number, count: number): boolean =>
  Number.isInteger(index) && index >= 0 && index < count;

/** Maps a ref to its signal index, or NOT_FOUND when it points outside the netlist. */
const signalIndexer =
  (inputCount: number, nandCount: number) =>
  (ref: SignalRef): number => {
    if (ref.kind === "input") {
      return inRange(ref.index, inputCount) ? ref.index : NOT_FOUND;
    }
    if (ref.kind === "clock") {
      return inputCount;
    }
    return inRange(ref.index, nandCount) ? inputCount + 1 + ref.index : NOT_FOUND;
  };

/** Resolves every ref into a typed array; returns the first out-of-range ref instead, if any. */
const resolveAll = (
  refs: readonly SignalRef[],
  indexOf: (ref: SignalRef) => number,
): Result<Int32Array, SignalRef> => {
  const target = new Int32Array(refs.length);
  const bad = refs.find((ref, position) => {
    target[position] = indexOf(ref);
    return target[position] === NOT_FOUND;
  });
  return bad === undefined ? ok(target) : err(bad);
};

const outOfRange = (ref: SignalRef): Result<never, CompileError> =>
  err({ type: "SignalOutOfRange", ref });

/** Resolves the NAND inputs and the outputs of a netlist whose `inputCount` is already valid. */
const resolveSignals = (
  src: NetlistSource,
  indexOf: (ref: SignalRef) => number,
): Result<Pick<Netlist, "nandA" | "nandB" | "outputs">, SignalRef> => {
  const nandA = resolveAll(
    src.nands.map((nand) => nand.a),
    indexOf,
  );
  const nandB = resolveAll(
    src.nands.map((nand) => nand.b),
    indexOf,
  );
  const outputs = resolveAll(src.outputs, indexOf);
  if (!nandA.ok) {
    return nandA;
  }
  if (!nandB.ok) {
    return nandB;
  }
  return outputs.ok
    ? ok({ nandA: nandA.value, nandB: nandB.value, outputs: outputs.value })
    : outputs;
};

export const compileNetlist = (src: NetlistSource): Result<Netlist, CompileError> => {
  if (!Number.isInteger(src.inputCount) || src.inputCount < 0) {
    return err({ type: "InvalidInputCount", inputCount: src.inputCount });
  }
  const nandCount = src.nands.length;
  const resolved = resolveSignals(src, signalIndexer(src.inputCount, nandCount));
  return resolved.ok
    ? ok({ inputCount: src.inputCount, nandCount, ...resolved.value })
    : outOfRange(resolved.error);
};
