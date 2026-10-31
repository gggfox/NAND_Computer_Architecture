import { assert, describe, expect, it } from "vitest";

import { newInstanceId } from "~/shared/ids";

import type { InteractionState } from "./interaction";
import { command, setup } from "./interaction.fixtures";
import { addInstances, selectInstances, selectWire, toggleWire } from "./selection";

const next = { type: "nextWire", backwards: false } as const;
const previous = { type: "nextWire", backwards: true } as const;

/** The demo's wires, in circuit order: A → a, B → b, out → OUT. */
const demo = () => {
  const base = setup();
  const [intoA, intoB, intoOut] = base.circuit.wires;
  assert(intoA && intoB && intoOut);
  return { ...base, intoA, intoB, intoOut };
};

const selectedWires = (state: InteractionState) => [...state.selection.wires];

describe("n and Shift+N", () => {
  it("select the focused chip's first wire, alone, and name it", () => {
    const { context, state, nand, intoA } = demo();
    const focused = { ...state, focus: nand.id, selection: selectInstances([nand.id]) };
    const first = command(focused, context, next);
    expect(selectedWires(first.state)).toEqual([intoA.id]);
    expect(first.state.selection.instances.size).toBe(0);
    expect(first.state.focus).toBe(nand.id);
    expect(first.effects).toEqual([
      { type: "announce", announcement: { type: "wireSelected", wireId: intoA.id } },
    ]);
  });

  it("step through the chip's wires in circuit order, wrapping both ways", () => {
    const { context, state, nand, intoA, intoB, intoOut } = demo();
    const first = command({ ...state, focus: nand.id }, context, next).state;
    const second = command(first, context, next).state;
    expect(selectedWires(second)).toEqual([intoB.id]);
    const third = command(second, context, next).state;
    expect(selectedWires(third)).toEqual([intoOut.id]);
    expect(selectedWires(command(third, context, next).state)).toEqual([intoA.id]);
    expect(selectedWires(command(first, context, previous).state)).toEqual([intoOut.id]);
  });

  it("Shift+N from no wire starts at the last one", () => {
    const { context, state, nand, intoOut } = demo();
    const result = command({ ...state, focus: nand.id }, context, previous);
    expect(selectedWires(result.state)).toEqual([intoOut.id]);
  });

  it("only count the wires touching the chip", () => {
    const { context, state, pieceB, intoB } = demo();
    const focused = { ...state, focus: pieceB.id };
    const once = command(focused, context, next).state;
    expect(selectedWires(once)).toEqual([intoB.id]);
    expect(selectedWires(command(once, context, next).state)).toEqual([intoB.id]);
  });
});

describe("n without a focused chip", () => {
  it("with no chip focused, step through the selected wire's source chip", () => {
    const { context, state, intoOut, intoA, intoB } = demo();
    // The out → OUT wire comes from the NAND, so the next wire after it wraps to A → a.
    const fromWire = command({ ...state, selection: selectWire(intoOut.id) }, context, next);
    expect(selectedWires(fromWire.state)).toEqual([intoA.id]);
    const back = command({ ...state, selection: selectWire(intoA.id) }, context, previous);
    expect(selectedWires(back.state)).toEqual([intoA.id]);
    const fromB = command({ ...state, selection: selectWire(intoB.id) }, context, next).state;
    expect(selectedWires(fromB)).toEqual([intoB.id]);
  });

  it("do nothing without a chip to step around", () => {
    const { context, state, nand, intoA, intoB } = demo();
    expect(command(state, context, next).state).toBe(state);
    const twoWires: InteractionState = {
      ...state,
      selection: toggleWire(selectWire(intoA.id), intoB.id),
    };
    expect(command(twoWires, context, next).state).toBe(twoWires);
    const mixed = { ...state, selection: addInstances(selectWire(intoA.id), [nand.id]) };
    expect(command(mixed, context, next).state).toBe(mixed);
    const gone = { ...state, focus: newInstanceId() };
    expect(command(gone, context, next).state).toBe(gone);
  });

  it("start over from the first wire when the selection is not one of the chip's wires", () => {
    const { context, state, nand, pieceB, intoA, intoB } = demo();
    const elsewhere = { ...state, focus: pieceB.id, selection: selectWire(intoA.id) };
    expect(selectedWires(command(elsewhere, context, next).state)).toEqual([intoB.id]);
    const mixed = {
      ...state,
      focus: nand.id,
      selection: addInstances(selectWire(intoB.id), [nand.id]),
    };
    expect(selectedWires(command(mixed, context, next).state)).toEqual([intoA.id]);
  });
});
