import { describe, expect, it } from "vitest";

import { interact } from "./interact";
import { command, setup } from "./interaction.fixtures";
import { EMPTY_SELECTION, selectInstances } from "./selection";

const picking = () => {
  const rig = setup();
  const pins = { ...EMPTY_SELECTION, pins: [{ instanceId: rig.nand.id, pin: 0 }] };
  return { ...rig, pins };
};

describe("Pick pins and the selection", () => {
  it("delete with only pins selected changes nothing and dispatches nothing", () => {
    const { context, state, pins } = picking();
    const chosen = { ...state, selection: pins, pinPick: true as const };
    const result = command(chosen, context, { type: "deleteSelection" });
    expect(result.state).toEqual(chosen);
    expect(result.effects).toEqual([]);
  });

  it("delete and cut turn Pick pins off with the selection", () => {
    const { context, state, nand } = picking();
    const chosen = { ...state, selection: selectInstances([nand.id]), pinPick: true as const };
    expect(command(chosen, context, { type: "deleteSelection" }).state.pinPick).toBeUndefined();
    expect(command(chosen, context, { type: "cut" }).state.pinPick).toBeUndefined();
  });

  it("undo that removes the selected chips turns Pick pins off, and keeps it otherwise", () => {
    const { context, state, nand, pieceA } = picking();
    const chosen = {
      ...state,
      selection: selectInstances([nand.id, pieceA.id]),
      pinPick: true as const,
    };
    const without = {
      ...context.scene,
      circuit: {
        ...context.scene.circuit,
        instances: context.scene.circuit.instances.filter(
          (item) => item.id !== nand.id && item.id !== pieceA.id,
        ),
      },
    };
    const gone = interact(chosen, { type: "historyChanged" }, { ...context, scene: without });
    expect(gone.state.pinPick).toBeUndefined();
    expect(interact(chosen, { type: "historyChanged" }, context).state.pinPick).toBe(true);
  });
});
