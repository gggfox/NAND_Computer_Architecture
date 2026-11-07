import type { WireTarget } from "~/features/circuit-editor";
import type { PinRef } from "~/features/projects";

/** How many bits the dialog must choose from on each end. A value of 1 means: ask for no bit. */
export interface BitAsk {
  readonly from: number;
  readonly target: number;
}

/** The bit chosen for each end. A bit that is not asked for is not used. */
export interface BitChoice {
  readonly from: number;
  readonly target: number;
}

/**
 * Which end needs a bit. The target asks when `wireTargets` says so (`bits` above 1). The source
 * asks when it is a bus and the target is one bit. A bus wired to a bus of the same width needs none.
 */
export const bitAsk = (fromWidth: number, target: WireTarget): BitAsk => ({
  from: fromWidth > 1 && target.width === 1 ? fromWidth : 1,
  target: target.bits,
});

const withBit = (ref: PinRef, asked: number, bit: number): PinRef =>
  asked > 1 ? { ...ref, bit } : ref;

/** The pin the dialog opened on: its reference and its width. */
export interface Source {
  readonly ref: PinRef;
  readonly width: number;
}

/** The two pin references for `connectPins`. A bus end carries its bit, or the command refuses. */
export const refsOf = (
  source: Source,
  target: WireTarget,
  choice: BitChoice,
): { readonly from: PinRef; readonly to: PinRef } => {
  const ask = bitAsk(source.width, target);
  return {
    from: withBit(source.ref, ask.from, choice.from),
    to: withBit(target.ref, ask.target, choice.target),
  };
};

/** A stable key for a target in the list. */
export const targetKey = ({ ref }: WireTarget): string => `${ref.instanceId}:${String(ref.pin)}`;

/** The targets whose name contains the query, without regard to case. */
export const matching = (targets: readonly WireTarget[], query: string): readonly WireTarget[] => {
  const needle = query.trim().toLowerCase();
  return needle === ""
    ? targets
    : targets.filter(({ label }) => label.toLowerCase().includes(needle));
};
