/* oxlint-disable typescript/prefer-readonly-parameter-types -- test fixtures carry branded ids (mutable object types); none is mutated */
import { describe, expect, test } from "vitest";

import { newChipId } from "~/shared/ids";
import type { ChipId, InstanceId } from "~/shared/ids";

import { EMPTY_CIRCUIT, newChip, piece, pinDef, pinPiece, projectWith, wire } from "./builders";
import { findChip, replaceChip } from "./chips";
import type { Chip, Circuit, PinDef, Project } from "./model";
import { applySavedVersion, planSave } from "./save-cascade";
import type { SavePlan } from "./save-cascade";

const at = (instanceId: InstanceId, pin: PinDef["id"] | number) => ({ instanceId, pin });

/** A chip whose saved version and draft are distinct objects with the same pieces and wire ids. */
const savedAndDraft = (name: string, circuit: Circuit): Chip => ({
  ...newChip(name, circuit, { saved: true }),
  draft: { ...circuit, instances: [...circuit.instances, piece({ type: "nand" })] },
});

/** Wraps `child` (pins a, b in and y out) in a chip with matching pins. */
const wrapper = (name: string, child: Chip, childPins: readonly [PinDef, PinDef, PinDef]) => {
  const [inA, inB, outY] = [pinDef("a", "input"), pinDef("b", "input"), pinDef("y", "output")];
  const pieces = [pinPiece(inA), pinPiece(inB), pinPiece(outY)] as const;
  const instance = piece({ type: "custom", chipId: child.id });
  const wires = {
    wa: wire(at(pieces[0].id, 0), at(instance.id, childPins[0].id)),
    wb: wire(at(pieces[1].id, 0), at(instance.id, childPins[1].id)),
    wy: wire(at(instance.id, childPins[2].id), at(pieces[2].id, 0)),
  };
  const chip = savedAndDraft(name, {
    pins: [inA, inB, outY],
    instances: [...pieces, instance],
    wires: Object.values(wires),
  });
  return { chip, pins: [inA, inB, outY] as const, pieces, instance, wires };
};

const nested = () => {
  const pins = [pinDef("a", "input"), pinDef("b", "input"), pinDef("y", "output")] as const;
  const draft: Circuit = { pins, instances: pins.map((def) => pinPiece(def)), wires: [] };
  const leaf = newChip("X", draft, { saved: true });
  const parent = wrapper("P", leaf, pins);
  const grandparent = wrapper("G", parent.chip, parent.pins);
  const project = projectWith("p", [leaf, parent.chip, grandparent.chip]);
  const variant = (edit: (circuit: Circuit) => Circuit): Project => ({
    ...project,
    chips: project.chips.map((chip) =>
      chip.id === leaf.id ? { ...chip, draft: edit(chip.draft) } : chip,
    ),
  });
  return { leaf, pins, parent, grandparent, project, variant };
};

const chipOf = (project: Project, chipId: ChipId): Chip => {
  const chip = findChip(project, chipId);
  expect(chip).toBeDefined();
  return chip ?? newChip("missing");
};

const wireIds = (circuit: Circuit | undefined) => circuit?.wires.map((item) => item.id);

/** Wire ids of a chip's saved version, then of its draft. */
const versionWireIds = (chip: Chip) => [wireIds(chip.saved), wireIds(chip.draft)];

const placing = (chip: Chip): Circuit => ({
  pins: [],
  instances: [piece({ type: "custom", chipId: chip.id })],
  wires: [],
});

const withoutPin = (pinId: PinDef["id"]) => (circuit: Circuit) => ({
  pins: circuit.pins.filter((pin) => pin.id !== pinId),
  instances: circuit.instances.filter(
    (item) => item.kind.type !== "pin" || item.kind.pinId !== pinId,
  ),
  wires: circuit.wires,
});

const mapPin = (pinId: PinDef["id"], change: (pin: PinDef) => PinDef) => (circuit: Circuit) => ({
  ...circuit,
  pins: circuit.pins.map((pin) => (pin.id === pinId ? change(pin) : pin)),
});

/** The plan for saving `chipId`; fails the test when planning fails. */
const planned = (project: Project, chipId: ChipId): SavePlan => {
  const plan = planSave(project, chipId);
  expect(plan.ok).toBe(true);
  return plan.ok ? plan.value : { project, effects: [] };
};

/** A project that also holds `chips`. */
const adding = (project: Project, ...chips: readonly Chip[]): Project => ({
  ...project,
  chips: [...project.chips, ...chips],
});

test("saving promotes the draft", () => {
  const { leaf, variant } = nested();
  const project = variant((circuit) => ({
    ...circuit,
    instances: [...circuit.instances, piece({ type: "nand" })],
  }));
  const plan = planned(project, leaf.id);
  const saved = chipOf(plan.project, leaf.id);
  expect(saved.saved).toEqual(saved.draft);
  expect(saved.saved).toBe(chipOf(project, leaf.id).draft);
  expect(plan.effects).toEqual([]);
});

describe("planSave nested", () => {
  test("a removed pin drops its wires in the parent's saved version and draft", () => {
    const { leaf, pins, parent, variant } = nested();
    const plan = planned(variant(withoutPin(pins[1].id)), leaf.id);
    const kept = [parent.wires.wa.id, parent.wires.wy.id];
    expect(versionWireIds(chipOf(plan.project, parent.chip.id))).toEqual([kept, kept]);
    expect(plan.effects).toEqual([
      { type: "PinRemoved", pinId: pins[1].id, name: "b" },
      { type: "WiresRemoved", chipId: parent.chip.id, count: 1 },
    ]);
  });

  test("a width change drops wires to that pin", () => {
    const { leaf, pins, parent, variant } = nested();
    const plan = planned(variant(mapPin(pins[1].id, (pin) => ({ ...pin, width: 4 }))), leaf.id);
    const kept = [parent.wires.wa.id, parent.wires.wy.id];
    expect(versionWireIds(chipOf(plan.project, parent.chip.id))).toEqual([kept, kept]);
    expect(plan.effects).toEqual([
      { type: "PinWidthChanged", pinId: pins[1].id, name: "b", from: 1, to: 4 },
      { type: "WiresRemoved", chipId: parent.chip.id, count: 1 },
    ]);
  });

  test("a renamed pin keeps every wire", () => {
    const { leaf, pins, parent, variant } = nested();
    const plan = planned(variant(mapPin(pins[0].id, (pin) => ({ ...pin, name: "in" }))), leaf.id);
    expect(chipOf(plan.project, parent.chip.id)).toBe(parent.chip);
    expect(plan.effects).toEqual([{ type: "PinRenamed", pinId: pins[0].id, from: "a", to: "in" }]);
  });

  test("an added pin is listed and left unconnected", () => {
    const { leaf, parent, variant } = nested();
    const extra = pinDef("c", "input");
    const edit = (circuit: Circuit): Circuit => ({
      ...circuit,
      pins: [...circuit.pins, extra],
      instances: [...circuit.instances, pinPiece(extra)],
    });
    const plan = planned(variant(edit), leaf.id);
    expect(chipOf(plan.project, parent.chip.id)).toBe(parent.chip);
    expect(plan.effects).toEqual([{ type: "PinAdded", pinId: extra.id, name: "c" }]);
  });

  test("grandparents keep their wiring", () => {
    const { leaf, pins, grandparent, variant } = nested();
    const plan = planned(variant(withoutPin(pins[1].id)), leaf.id);
    expect(chipOf(plan.project, grandparent.chip.id)).toBe(grandparent.chip);
  });
});

describe("save effects", () => {
  test("pin changes in old order, then additions, then parents in project order", () => {
    const { leaf, pins, parent, variant } = nested();
    const second = wrapper("Q", leaf, pins);
    const extra = pinDef("c", "input");
    const edit = (circuit: Circuit): Circuit => ({
      pins: [{ ...pins[0], name: "in", width: 8 }, extra, pins[2]],
      instances: [...withoutPin(pins[1].id)(circuit).instances, pinPiece(extra)],
      wires: [],
    });
    const plan = planned(adding(variant(edit), second.chip), leaf.id);
    expect(plan.effects).toEqual([
      { type: "PinRenamed", pinId: pins[0].id, from: "a", to: "in" },
      { type: "PinWidthChanged", pinId: pins[0].id, name: "in", from: 1, to: 8 },
      { type: "PinRemoved", pinId: pins[1].id, name: "b" },
      { type: "PinAdded", pinId: extra.id, name: "c" },
      { type: "WiresRemoved", chipId: parent.chip.id, count: 2 },
      { type: "WiresRemoved", chipId: second.chip.id, count: 2 },
    ]);
  });

  test("a wire counts once across versions, and draft-only wires count too", () => {
    const { leaf, pins, parent, variant } = nested();
    // A second wire on the removed pin, present only in the parent's draft.
    const draftOnly = wire(at(parent.pieces[0].id, 0), at(parent.instance.id, pins[1].id));
    const extended = replaceChip(variant(withoutPin(pins[1].id)), {
      ...parent.chip,
      draft: { ...parent.chip.draft, wires: [...parent.chip.draft.wires, draftOnly] },
    });
    expect(planned(extended, leaf.id).effects.at(-1)).toEqual({
      type: "WiresRemoved",
      chipId: parent.chip.id,
      count: 2,
    });
  });
});

describe("cascade parents", () => {
  test("a draft-only parent drops wires in its draft", () => {
    const { leaf, pins, parent, variant } = nested();
    const { saved: _saved, ...draftOnly } = parent.chip;
    const edited = variant(withoutPin(pins[1].id));
    const plan = planned(replaceChip(edited, draftOnly), leaf.id);
    const updated = chipOf(plan.project, parent.chip.id);
    expect(updated.saved).toBeUndefined();
    expect(wireIds(updated.draft)).toEqual([parent.wires.wa.id, parent.wires.wy.id]);
  });

  test("a parent with no wires on the changed pins is left alone with no effect", () => {
    const { leaf, pins, variant } = nested();
    const unwired = newChip("U", placing(leaf), { saved: true });
    const edited = variant(withoutPin(pins[1].id));
    const plan = planned(adding(edited, unwired), leaf.id);
    expect(chipOf(plan.project, unwired.id)).toBe(unwired);
    expect(plan.effects.filter((effect) => effect.type === "WiresRemoved")).toHaveLength(1);
  });
});

describe("first save", () => {
  test("first save of a draft-only chip lists PinAdded only and touches no chip but itself", () => {
    const { project } = nested();
    const [input, output] = [pinDef("in", "input"), pinDef("out", "output")];
    const fresh = newChip("fresh", {
      pins: [input, output],
      instances: [pinPiece(input), pinPiece(output)],
      wires: [],
    });
    const plan = planned(adding(project, fresh), fresh.id);
    expect(plan.effects).toEqual([
      { type: "PinAdded", pinId: input.id, name: "in" },
      { type: "PinAdded", pinId: output.id, name: "out" },
    ]);
    project.chips.forEach((chip, index) => {
      expect(plan.project.chips[index]).toBe(chip);
    });
    expect(chipOf(plan.project, fresh.id).saved).toBe(fresh.draft);
  });
});

describe("planSave self-containment", () => {
  test("saving a draft that would contain itself is WouldContainItself", () => {
    const inner = newChip("Y", EMPTY_CIRCUIT, { saved: true });
    const outer = newChip("X", placing(inner), { saved: true });
    const looping: Chip = { ...inner, draft: placing(outer) };
    expect(planSave(projectWith("p", [looping, outer]), looping.id)).toEqual({
      ok: false,
      error: { type: "WouldContainItself", chipId: outer.id },
    });
  });

  test("a draft that places its own chip is WouldContainItself", () => {
    const chip = newChip("self");
    const looping: Chip = { ...chip, draft: placing(chip) };
    expect(planSave(projectWith("p", [looping]), chip.id)).toEqual({
      ok: false,
      error: { type: "WouldContainItself", chipId: chip.id },
    });
  });
});

describe("planSave and applySavedVersion", () => {
  test("unknown chip is ChipNotFound", () => {
    const missing = newChipId();
    expect(planSave(nested().project, missing)).toEqual({
      ok: false,
      error: { type: "ChipNotFound", chipId: missing },
    });
  });

  test("planSave's project equals applySavedVersion with the draft", () => {
    const { leaf, pins, variant } = nested();
    const project = variant(withoutPin(pins[1].id));
    const { draft } = chipOf(project, leaf.id);
    expect(planned(project, leaf.id).project).toEqual(applySavedVersion(project, leaf.id, draft));
  });

  test("applySavedVersion on a missing chip returns the project unchanged", () => {
    const { project } = nested();
    expect(applySavedVersion(project, newChipId(), EMPTY_CIRCUIT)).toBe(project);
  });
});
