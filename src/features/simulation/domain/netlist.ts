import { err, ok } from "~/shared/result";
import type { Result } from "~/shared/result";

export type SignalRef =
  | { readonly kind: "input"; readonly index: number }
  | { readonly kind: "nand"; readonly index: number };

/** The engine's own input format; it knows nothing about projects or chips. */
export interface NetlistSource {
  readonly inputCount: number;
  readonly nands: readonly { readonly a: SignalRef; readonly b: SignalRef }[];
  readonly outputs: readonly SignalRef[];
}

/** Signal index layout is `[inputs..., nand outputs...]`. */
export interface Netlist {
  readonly inputCount: number;
  readonly nandCount: number;
  readonly nandA: Int32Array;
  readonly nandB: Int32Array;
  readonly outputs: Int32Array;
}

export interface CompileError {
  readonly type: "SignalOutOfRange";
  readonly ref: SignalRef;
}

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
    return inRange(ref.index, nandCount) ? inputCount + ref.index : NOT_FOUND;
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

export const compileNetlist = (src: NetlistSource): Result<Netlist, CompileError> => {
  const nandCount = src.nands.length;
  const indexOf = signalIndexer(src.inputCount, nandCount);
  const nandA = resolveAll(
    src.nands.map((nand) => nand.a),
    indexOf,
  );
  if (!nandA.ok) {
    return outOfRange(nandA.error);
  }
  const nandB = resolveAll(
    src.nands.map((nand) => nand.b),
    indexOf,
  );
  if (!nandB.ok) {
    return outOfRange(nandB.error);
  }
  const outputs = resolveAll(src.outputs, indexOf);
  return outputs.ok
    ? ok({
        inputCount: src.inputCount,
        nandCount,
        nandA: nandA.value,
        nandB: nandB.value,
        outputs: outputs.value,
      })
    : outOfRange(outputs.error);
};
