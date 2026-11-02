import { describe, expect, it } from "vitest";

import { newChip, piece, pinDef, pinPiece, projectWith, wire } from "~/features/projects";
import type { Chip, Circuit, PinDef, Project } from "~/features/projects";
import { newChipId } from "~/shared/ids";
import type { ChipId } from "~/shared/ids";

import { savePreview } from "./save-preview";

const pinsOf = () => [pinDef("A", "input"), pinDef("B", "input"), pinDef("OUT", "output")] as const;

/** A child chip whose saved version is `pins`; its draft is the saved circuit with `edit` applied. */
const childWith = (pins: readonly PinDef[], edit: (saved: Circuit) => Circuit): Chip => {
  const saved: Circuit = { pins, instances: pins.map((def) => pinPiece(def)), wires: [] };
  return { ...newChip("Half adder", saved, { saved: true }), draft: edit(saved) };
};

/** A parent that places `childId` and wires `wired` pins of that instance, in saved and draft. */
const parentOf = (name: string, childId: ChipId, wired: readonly PinDef[]): Chip => {
  const placed = piece({ type: "custom", chipId: childId });
  const nand = piece({ type: "nand" });
  const circuit: Circuit = {
    pins: [],
    instances: [placed, nand],
    wires: wired.map((def) =>
      wire({ instanceId: placed.id, pin: def.id }, { instanceId: nand.id, pin: 0 }),
    ),
  };
  return newChip(name, circuit, { saved: true });
};

const without = (pins: readonly PinDef[], name: string): readonly PinDef[] =>
  pins.filter((def) => def.name !== name);

const setup = (edit: (pins: readonly PinDef[]) => readonly PinDef[]) => {
  const pins = pinsOf();
  const child = childWith(pins, (saved) => ({ ...saved, pins: edit(saved.pins) }));
  const parent = parentOf("Full adder", child.id, [pins[0], pins[1]]);
  return { pins, child, parent, project: projectWith("p", [child, parent]) };
};

const consequences = (project: Project, chipId: ChipId) => {
  const result = savePreview(project, chipId);
  return result.ok ? result.value.consequences : result;
};

describe("savePreview breaks nothing", () => {
  it("is empty for a rename, an added pin, a reorder and an inside edit", () => {
    const renamed = setup((pins) => pins.map((def) => ({ ...def, name: `${def.name}2` })));
    expect(consequences(renamed.project, renamed.child.id)).toEqual([]);
    const added = setup((pins) => [...pins, pinDef("C", "input")]);
    expect(consequences(added.project, added.child.id)).toEqual([]);
    const reordered = setup((pins) => pins.toReversed());
    expect(consequences(reordered.project, reordered.child.id)).toEqual([]);
    const inside = setup((pins) => pins);
    const edited = {
      ...inside.child,
      draft: { ...inside.child.draft, instances: [piece({ type: "nand" })] },
    };
    expect(consequences(projectWith("p", [edited, inside.parent]), edited.id)).toEqual([]);
  });

  it("is empty when the removed pin is wired by no parent", () => {
    const { project, child } = setup((pins) => without(pins, "OUT"));
    expect(consequences(project, child.id)).toEqual([]);
  });
});

describe("savePreview breaks wires", () => {
  it("names the removed pin, then the parent that loses a wire", () => {
    const { project, child } = setup((pins) => without(pins, "B"));
    expect(consequences(project, child.id)).toEqual([
      { type: "pinRemoved", name: "B" },
      { type: "wiresRemoved", chipName: "Full adder", count: 1 },
    ]);
  });

  it("names a resized pin with its old and new width", () => {
    const { project, child } = setup((pins) =>
      pins.map((def) => (def.name === "A" ? { ...def, width: 4 as const } : def)),
    );
    expect(consequences(project, child.id)).toEqual([
      { type: "pinWidthChanged", name: "A", from: 1, to: 4 },
      { type: "wiresRemoved", chipName: "Full adder", count: 1 },
    ]);
  });

  it("counts a wire dropped in both a parent's draft and its saved version once", () => {
    const { project, child } = setup((pins) => without(pins, "B"));
    const [, parent] = project.chips;
    expect(parent?.draft).toBe(parent?.saved);
    expect(consequences(project, child.id)).toContainEqual({
      type: "wiresRemoved",
      chipName: "Full adder",
      count: 1,
    });
  });
});

describe("savePreview over several causes and parents", () => {
  it("lists removed pins before resized ones, then one line per parent in chip order", () => {
    const { pins, project: base, child, parent } = setup((all) => without(all, "B"));
    const resized = {
      ...child,
      draft: {
        ...child.draft,
        pins: child.draft.pins.map((def) =>
          def.name === "A" ? { ...def, width: 4 as const } : def,
        ),
      },
    };
    const second = parentOf("Adder", child.id, [pins[0], pins[1]]);
    const project = { ...base, chips: [resized, parent, second] };
    expect(consequences(project, child.id)).toEqual([
      { type: "pinRemoved", name: "B" },
      { type: "pinWidthChanged", name: "A", from: 1, to: 4 },
      { type: "wiresRemoved", chipName: "Full adder", count: 2 },
      { type: "wiresRemoved", chipName: "Adder", count: 2 },
    ]);
  });
});

describe("savePreview errors", () => {
  it("refuses a save that makes the chip contain itself", () => {
    const { project, child } = setup((pins) => pins);
    const looped = {
      ...child,
      draft: { ...child.draft, instances: [piece({ type: "custom", chipId: child.id })] },
    };
    expect(
      consequences({ ...project, chips: [looped, ...project.chips.slice(1)] }, child.id),
    ).toEqual({ ok: false, error: { type: "WouldContainItself", chipId: child.id } });
  });

  it("reports an unknown chip", () => {
    const { project } = setup((pins) => pins);
    const chipId = newChipId();
    expect(savePreview(project, chipId)).toEqual({
      ok: false,
      error: { type: "ChipNotFound", chipId },
    });
  });

  it("leaves the project it was given unchanged", () => {
    const { project, child } = setup((pins) => without(pins, "B"));
    const snapshot = structuredClone(project);
    savePreview(project, child.id);
    expect(project).toEqual(snapshot);
  });
});
