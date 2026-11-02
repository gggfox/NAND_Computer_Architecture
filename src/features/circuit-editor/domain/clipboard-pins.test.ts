/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { assert, describe, expect, it } from "vitest";

import { newChip, projectWith } from "~/features/projects";
import { newWireId } from "~/shared/ids";

import { draftOf, nandPiece } from "./circuit-edits.fixtures";
import { copyOf, pastedFrom } from "./clipboard";
import { chipWith, pastedAll, targetOf } from "./clipboard.fixtures";
import { setup } from "./interaction.fixtures";
import { applyAction } from "./reducer";
import { selectInstances } from "./selection";

describe("pasting pins", () => {
  it("gives a pasted pin a fresh definition and the next free name", () => {
    const { circuit, pieceA } = setup();
    const clipboard = copyOf(circuit, selectInstances([pieceA.id]), 1);
    assert(clipboard !== undefined);
    const pasted = pastedFrom(clipboard, { delta: { x: 0, y: 0 }, target: circuit, newWireId });
    const [pin] = pasted.pins;
    assert(pin !== undefined);
    expect(pin).toMatchObject({ name: "C", direction: "input", width: 1 });
    expect(pin.id).not.toBe(clipboard.pins[0]?.id);
    expect(pasted.instances[0]?.kind).toEqual({ type: "pin", pinId: pin.id });
  });

  it("keeps the name where it is free, as after a cut", () => {
    const { circuit, pieceA } = setup();
    const clipboard = copyOf(circuit, selectInstances([pieceA.id]), 0);
    assert(clipboard !== undefined);
    const target = { ...circuit, pins: circuit.pins.filter((pin) => pin.name !== "A") };
    const pasted = pastedFrom(clipboard, { delta: { x: 0, y: 0 }, target, newWireId });
    expect(pasted.pins.map((pin) => pin.name)).toEqual(["A"]);
  });

  it("adds the pin to the chip's pins", () => {
    const { circuit, pieceA } = setup();
    const chip = newChip("P", circuit);
    const pasted = pastedAll({ ...circuit, instances: [pieceA] }, { x: 0, y: 400 });
    const result = applyAction(projectWith("p", [chip]), {
      type: "pasteItems",
      chipId: chip.id,
      ...pasted,
    });
    assert(result.ok);
    expect(draftOf(result.value, chip.id)?.pins.map((pin) => pin.name)).toEqual([
      "A",
      "B",
      "C",
      "OUT",
    ]);
  });
});

describe("pasteItems pin refusals", () => {
  it("refuses a pin piece without its definition, and a definition without its piece", () => {
    const { circuit, pieceA } = setup();
    const { project, chipId } = chipWith(circuit);
    const pasted = pastedAll({ ...circuit, instances: [pieceA] }, { x: 0, y: 400 });
    const refused = { ok: false, error: { type: "PinNotFound" } };
    const paste = { type: "pasteItems", chipId, wires: [] } as const;
    expect(applyAction(project, { ...paste, instances: pasted.instances, pins: [] })).toMatchObject(
      refused,
    );
    const both = { instances: [nandPiece(0)], pins: pasted.pins };
    expect(applyAction(project, { ...paste, ...both })).toMatchObject(refused);
  });

  it("a pin piece copied without its definition keeps its pin, and the paste refuses it", () => {
    const { circuit, pieceA } = setup();
    const { project, chipId } = chipWith(circuit);
    const clipboard = { instances: [pieceA], pins: [], wires: [], offset: 1 };
    const pasted = pastedFrom(clipboard, targetOf(circuit, { x: 0, y: 400 }));
    expect(pasted.instances[0]?.kind).toEqual(pieceA.kind);
    expect(applyAction(project, { type: "pasteItems", chipId, ...pasted })).toMatchObject({
      ok: false,
      error: { type: "PinNotFound" },
    });
  });

  it("refuses a pin already in the chip", () => {
    const { circuit } = setup();
    const { project, chipId } = chipWith(circuit);
    const [pinA] = circuit.pins;
    assert(pinA !== undefined);
    // A second piece for pin A, with A's own definition.
    const instances = [{ ...nandPiece(0), kind: { type: "pin", pinId: pinA.id } } as const];
    expect(
      applyAction(project, { type: "pasteItems", chipId, instances, pins: [pinA], wires: [] }),
    ).toMatchObject({ ok: false, error: { type: "DuplicatePin" } });
  });
});
