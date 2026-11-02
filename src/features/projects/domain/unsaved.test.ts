/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- test fixtures carry branded ids (mutable object types); none is mutated */
import { describe, expect, test } from "vitest";

import { newPinId } from "~/shared/ids";

import { newChip, piece, pinDef, pinPiece, wire } from "./builders";
import type { Chip, Circuit, Wire } from "./model";
import { circuitsMatch, hasUnsavedChanges, unsavedState } from "./unsaved";

const inA = pinDef("a", "input");
const inB = pinDef("b", "input");
const outY = pinDef("y", "output");
const nand = piece({ type: "nand" }, { x: 2, y: 3 });
const pieces = [pinPiece(inA), pinPiece(inB), pinPiece(outY)] as const;
const link: Wire = wire({ instanceId: pieces[0].id, pin: inA.id }, { instanceId: nand.id, pin: 0 });

const base: Circuit = {
  pins: [inA, inB, outY],
  instances: [...pieces, nand],
  wires: [link],
};

const changed = (draft: Circuit): Chip => ({
  ...newChip("Chip", base, { saved: true }),
  draft,
});

const changes: readonly (readonly [string, Circuit])[] = [
  ["a renamed pin", { ...base, pins: [{ ...inA, name: "z" }, inB, outY] }],
  ["pins swapped in order", { ...base, pins: [inB, inA, outY] }],
  ["a pin width", { ...base, pins: [{ ...inA, width: 4 }, inB, outY] }],
  ["a pin direction", { ...base, pins: [{ ...inA, direction: "output" }, inB, outY] }],
  ["a pin id", { ...base, pins: [{ ...inA, id: newPinId() }, inB, outY] }],
  [
    "an instance moved one cell",
    { ...base, instances: [...pieces, { ...nand, position: { x: 3, y: 3 } }] },
  ],
  [
    "an instance moved vertically",
    { ...base, instances: [...pieces, { ...nand, position: { x: 2, y: 4 } }] },
  ],
  ["an added instance", { ...base, instances: [...base.instances, piece({ type: "clock" })] }],
  ["instances reordered", { ...base, instances: [nand, ...pieces] }],
  ["an instance label", { ...base, instances: [...pieces, { ...nand, label: "G1" }] }],
  [
    "an instance kind type",
    { ...base, instances: [...pieces, { ...nand, kind: { type: "clock" } }] },
  ],
  [
    "a split width",
    {
      ...base,
      instances: [...pieces, { ...nand, kind: { type: "split", width: 4 } }],
    },
  ],
  [
    "a pin piece's pin",
    {
      ...base,
      instances: [
        { ...pieces[0], kind: { type: "pin", pinId: inB.id } },
        ...base.instances.slice(1),
      ],
    },
  ],
  [
    "a custom chip id",
    {
      ...base,
      instances: [...pieces, { ...nand, kind: { type: "custom", chipId: newChip("Other").id } }],
    },
  ],
  ["a removed wire", { ...base, wires: [] }],
  ["a wire's to", { ...base, wires: [{ ...link, to: { ...link.to, pin: 1 } }] }],
  ["a wire's from", { ...base, wires: [{ ...link, from: { ...link.from, pin: inB.id } }] }],
  ["a wire's bit", { ...base, wires: [{ ...link, to: { ...link.to, bit: 2 } }] }],
  [
    "a wire's instance",
    { ...base, wires: [{ ...link, to: { ...link.to, instanceId: pieces[1].id } }] },
  ],
  ["a wire's bit width", { ...base, wires: [{ ...link, bitWidth: 4 }] }],
  ["a wire's colour", { ...base, wires: [{ ...link, color: "red" }] }],
  [
    "a hand-bent wire's waypoints",
    {
      ...base,
      wires: [{ ...link, manualWaypoints: true, waypoints: [{ x: 1, y: 1 }] }],
    },
  ],
];

const bent = (waypoints: Wire["waypoints"]): Circuit => ({
  ...base,
  wires: [{ ...link, manualWaypoints: true, waypoints }],
});

describe("unsavedState", () => {
  test("a chip without a saved version is new", () => {
    const chip = newChip("Chip", base);
    expect(unsavedState(chip)).toBe("new");
    expect(hasUnsavedChanges(chip)).toBe(true);
  });

  test("the same circuit object is saved, without walking it", () => {
    const chip = newChip("Chip", base, { saved: true });
    expect(unsavedState(chip)).toBe("saved");
    expect(hasUnsavedChanges(chip)).toBe(false);
    expect(circuitsMatch(base, base)).toBe(true);
  });

  test("a structurally equal copy is saved", () => {
    const copy = structuredClone(base);
    expect(unsavedState(changed(copy))).toBe("saved");
  });

  test.each(changes)("%s makes it changed", (_name, draft) => {
    expect(unsavedState(changed(draft))).toBe("changed");
  });
});

describe("unsavedState routes", () => {
  test("hand-bent waypoints that differ in count or position change it", () => {
    const chip = { ...changed(bent([{ x: 1, y: 1 }])), saved: bent([{ x: 1, y: 1 }]) };
    expect(unsavedState(chip)).toBe("saved");
    expect(unsavedState({ ...chip, draft: bent([{ x: 1, y: 2 }]) })).toBe("changed");
    expect(unsavedState({ ...chip, draft: bent([{ x: 2, y: 1 }]) })).toBe("changed");
    expect(
      unsavedState({
        ...chip,
        draft: bent([
          { x: 1, y: 1 },
          { x: 2, y: 2 },
        ]),
      }),
    ).toBe("changed");
  });

  test("an automatic wire with different waypoints stays saved (D1)", () => {
    const rerouted: Circuit = {
      ...base,
      wires: [{ ...link, waypoints: [{ x: 9, y: 9 }] }],
    };
    expect(unsavedState(changed(rerouted))).toBe("saved");
  });

  test("switching a wire between automatic and hand-bent is changed", () => {
    expect(unsavedState(changed({ ...base, wires: [{ ...link, manualWaypoints: true }] }))).toBe(
      "changed",
    );
  });
});
