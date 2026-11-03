/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { assert, describe, expect, it } from "vitest";

import { newChip, projectWith, replaceChip, wire } from "~/features/projects";
import type { Circuit } from "~/features/projects";

import type { EditorAction } from "./actions";
import { customPiece, draftOf, nandPiece, twoChips } from "./circuit-edits.fixtures";
import { copyOf, pastedFrom } from "./clipboard";
import { chipWith, pasteAll, pastedAll, targetOf } from "./clipboard.fixtures";
import type { Effect } from "./interaction";
import { command, setup } from "./interaction.fixtures";
import { applyAction } from "./reducer";
import { selectInstances } from "./selection";

/** Two NANDs, the first's output wired to the second's `a`, with a hand bend. */
const pairParts = () => {
  const first = nandPiece(0);
  const second = nandPiece(200);
  const link = {
    ...wire({ instanceId: first.id, pin: 2 }, { instanceId: second.id, pin: 0 }),
    waypoints: [{ x: 160, y: 40 }],
    manualWaypoints: true,
  };
  return { instances: [first, second], wires: [link] };
};

const pair = (): Circuit => ({ pins: [], ...pairParts() });

const dispatched = (effects: readonly Effect[]): EditorAction | undefined =>
  effects.flatMap((effect) => (effect.type === "dispatch" ? [effect.action] : [])).at(0);

/** The `pasteItems` action among `effects`; fails the test when there is none. */
const pasteAction = (effects: readonly Effect[]) => {
  const action = dispatched(effects);
  assert(action?.type === "pasteItems");
  return action;
};

/** The demo with only its NAND selected, copied. */
const copiedNand = () => {
  const { context, state, nand } = setup();
  const copied = command({ ...state, selection: selectInstances([nand.id]) }, context, {
    type: "copy",
  });
  return { context, nand, copied };
};

describe("copyOf", () => {
  it("copies the selected pieces, their pin definitions and the wires between them", () => {
    const { circuit, pieceA, nand } = setup();
    const clipboard = copyOf(circuit, selectInstances([pieceA.id, nand.id]), 1);
    expect(clipboard?.instances).toEqual([pieceA, nand]);
    expect(clipboard?.pins.map((pin) => pin.name)).toEqual(["A"]);
    // Only A→a joins two copied pieces.
    expect(clipboard?.wires).toHaveLength(1);
  });

  it("is undefined when nothing is selected", () => {
    const { circuit } = setup();
    expect(copyOf(circuit, selectInstances([]), 1)).toBeUndefined();
  });
});

describe("pastedFrom", () => {
  it("gives the parts fresh ids and moves them", () => {
    const circuit = pair();
    const pasted = pastedAll(circuit, { x: 40, y: 40 });
    expect(pasted.instances.map((item) => item.position)).toEqual([
      { x: 40, y: 40 },
      { x: 240, y: 40 },
    ]);
    const before = new Set(circuit.instances.map((item) => item.id));
    expect(pasted.instances.some((item) => before.has(item.id))).toBe(false);
  });

  it("joins the wires to the new parts, bends moved along", () => {
    const circuit = pair();
    const pasted = pastedAll(circuit, { x: 40, y: 40 });
    const [copyA, copyB] = pasted.instances;
    const [link] = pasted.wires;
    assert(copyA && copyB && link);
    expect(link.id).not.toBe(circuit.wires[0]?.id);
    expect([link.from.instanceId, link.to.instanceId]).toEqual([copyA.id, copyB.id]);
    expect(link.waypoints).toEqual([{ x: 200, y: 80 }]);
  });
});

describe("pasteItems", () => {
  it("adds the parts and wires as one edit", () => {
    const circuit = pair();
    const chip = newChip("P", circuit);
    const result = pasteAll(projectWith("p", [chip]), chip.id, circuit);
    assert(result.ok);
    const after = draftOf(result.value, chip.id);
    expect(after?.instances).toHaveLength(4);
    expect(after?.wires).toHaveLength(2);
  });

  it("refuses a chip that would contain itself", () => {
    const { project, host } = twoChips();
    const saved = replaceChip(project, { ...host, saved: host.draft });
    const circuit: Circuit = { pins: [], instances: [customPiece(host.id)], wires: [] };
    const result = pasteAll(saved, host.id, circuit);
    expect(result).toMatchObject({ ok: false, error: { type: "WouldContainItself" } });
  });

  it("refuses nothing to add", () => {
    const { project, host } = twoChips();
    const result = applyAction(project, {
      type: "pasteItems",
      chipId: host.id,
      instances: [],
      pins: [],
      wires: [],
    });
    expect(result).toMatchObject({ ok: false, error: { type: "NothingToAdd" } });
  });
});

describe("pasteItems refusals", () => {
  it("refuses parts or wires already in the chip", () => {
    const parts = pairParts();
    const circuit: Circuit = { pins: [], ...parts };
    const { project, chipId } = chipWith(circuit);
    const again = { type: "pasteItems", chipId, pins: [], wires: [] } as const;
    expect(applyAction(project, { ...again, instances: parts.instances })).toMatchObject({
      ok: false,
      error: { type: "DuplicateInstance" },
    });
    const { instances } = pastedAll(circuit, { x: 0, y: 400 });
    expect(applyAction(project, { ...again, instances, wires: circuit.wires })).toMatchObject({
      ok: false,
      error: { type: "DuplicateWire" },
    });
  });

  it("refuses a wire to a part it does not add", () => {
    const parts = pairParts();
    const circuit: Circuit = { pins: [], ...parts };
    const { project, chipId } = chipWith(circuit);
    const [first] = parts.instances;
    assert(first !== undefined);
    // A wire whose other end was not copied keeps its old end, and the paste refuses it.
    const clipboard = { instances: [first], pins: [], wires: circuit.wires, offset: 1 };
    const pasted = pastedFrom(clipboard, targetOf(circuit, { x: 0, y: 400 }));
    expect(applyAction(project, { type: "pasteItems", chipId, ...pasted })).toMatchObject({
      ok: false,
      error: { type: "WireNotFound" },
    });
  });
});

describe("copy and paste commands", () => {
  it("copy changes nothing and announces", () => {
    const { copied } = copiedNand();
    expect(dispatched(copied.effects)).toBeUndefined();
    expect(copied.effects).toContainEqual({
      type: "announce",
      announcement: { type: "clipboard", did: "copy", count: 1 },
    });
  });

  it("paste lands a step away and selects the copy", () => {
    const { context, nand, copied } = copiedNand();
    const pasted = command(copied.state, context, { type: "paste" });
    const [copy] = pasteAction(pasted.effects).instances;
    assert(copy !== undefined);
    expect(copy.position).toEqual({ x: nand.position.x + 40, y: nand.position.y + 40 });
    expect([...pasted.state.selection.instances]).toEqual([copy.id]);
    expect(pasted.state.clipboard?.offset).toBe(2);
  });

  it("pastes onto the middle of the view when the spot is off screen", () => {
    const { context, copied } = copiedNand();
    const away = { ...copied.state, camera: { zoom: 1, x: -5000, y: -5000 } };
    const [copy] = pasteAction(command(away, context, { type: "paste" }).effects).instances;
    assert(copy !== undefined);
    expect(copy.position.x).toBeLessThan(-4000);
    expect(copy.position.y).toBeLessThan(-4000);
  });

  it("pastes the wires between the parts, selected with them", () => {
    const { context: demo, state } = setup();
    const circuit = pair();
    const context = { ...demo, scene: { ...demo.scene, circuit } };
    const all = selectInstances(circuit.instances.map((item) => item.id));
    const copied = command({ ...state, selection: all }, context, { type: "copy" });
    const pasted = command(copied.state, context, { type: "paste" });
    expect(pasteAction(pasted.effects).wires).toHaveLength(1);
    expect(pasted.state.selection.wires.size).toBe(1);
  });

  it("does nothing with nothing to copy or paste", () => {
    const { context, state } = setup();
    expect(command(state, context, { type: "copy" })).toEqual({ state, effects: [] });
    expect(command(state, context, { type: "cut" })).toEqual({ state, effects: [] });
    expect(command(state, context, { type: "paste" })).toEqual({ state, effects: [] });
  });
});

describe("cut command", () => {
  it("removes what it copied, pin pieces included", () => {
    const { context, state, pieceA, nand } = setup();
    const cut = command({ ...state, selection: selectInstances([pieceA.id, nand.id]) }, context, {
      type: "cut",
    });
    expect(dispatched(cut.effects)).toEqual({
      type: "removeItems",
      chipId: context.chipId,
      instanceIds: [pieceA.id, nand.id],
      wireIds: [],
    });
    expect(cut.state.selection.instances.size).toBe(0);
  });

  it("the first paste after a cut puts the parts back in place", () => {
    const { context, state, nand } = setup();
    const cut = command({ ...state, selection: selectInstances([nand.id]) }, context, {
      type: "cut",
    });
    const pasted = command(cut.state, context, { type: "paste" });
    expect(pasteAction(pasted.effects).instances[0]?.position).toEqual(nand.position);
  });
});
