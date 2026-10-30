import type { BitWidth, Circuit, PinDirection } from "~/features/projects";
import type { PinId } from "~/shared/ids";

import type { Level } from "./signals";

/** Where one pin's bits sit in the engine's input or output list: bit 0 at `offset`. */
export interface IoSlot {
  readonly pinId: PinId;
  readonly width: BitWidth;
  readonly offset: number;
}

export interface IoLayout {
  readonly inputs: readonly IoSlot[];
  readonly outputs: readonly IoSlot[];
}

const slotsOf = (circuit: Circuit, direction: PinDirection): readonly IoSlot[] => {
  const slots: IoSlot[] = [];
  let offset = 0;
  for (const pin of circuit.pins) {
    if (pin.direction === direction) {
      slots.push({ pinId: pin.id, width: pin.width, offset });
      offset += pin.width;
    }
  }
  return slots;
};

/** Slots follow the Pins-panel order (`circuit.pins`) within each direction. */
export const ioLayout = (circuit: Circuit): IoLayout => ({
  inputs: slotsOf(circuit, "input"),
  outputs: slotsOf(circuit, "output"),
});

const bitsOf = (value: number, width: BitWidth): readonly Level[] =>
  Array.from({ length: width }, (_unused, bit) => (((value >> bit) & 1) === 1 ? 1 : 0));

/** Spreads each input value over its slot, bit 0 first; a missing value is 0. */
export const packInputs = (
  layout: IoLayout,
  values: ReadonlyMap<PinId, number>,
): readonly Level[] =>
  layout.inputs.flatMap((slot) => bitsOf(values.get(slot.pinId) ?? 0, slot.width));

const valueAt = (slot: IoSlot, bits: readonly Level[]): number =>
  bits
    .slice(slot.offset, slot.offset + slot.width)
    .reduce<number>((sum, level, bit) => sum | (level << bit), 0);

/** Rebuilds each output value from its slot's bits; a missing bit reads as 0. */
export const unpackOutputs = (
  layout: IoLayout,
  bits: readonly Level[],
): ReadonlyMap<PinId, number> =>
  new Map(layout.outputs.map((slot) => [slot.pinId, valueAt(slot, bits)]));
