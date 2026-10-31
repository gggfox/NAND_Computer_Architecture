/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { describe, expect, it } from "vitest";

import { newChip, piece, pinDef, pinPiece, projectWith } from "~/features/projects";
import type { Circuit, PinDef, Project } from "~/features/projects";
import type { ChipId, WireId } from "~/shared/ids";
import { newInstanceId } from "~/shared/ids";

import { createRerouteAfterSave, createRouteUnrouted } from "./route-edits";
import { chips, crossing, farBlocked, savingProject } from "./route-edits.fixtures";
import {
  entersChips,
  link,
  NAND_A,
  NAND_OUT,
  nandAt,
  polylineOf,
} from "./routing/routing.fixtures";
import { applied, draftIn, projectOf, wireIn } from "./wire-edits.fixtures";

/** Whether the wire's drawn route in the chip's draft enters a chip. */
const blocked = (project: Project, chipId: ChipId, wireId: WireId): boolean => {
  const scene = { project, circuit: draftIn(project, chipId) };
  return entersChips(scene, polylineOf(scene, wireId));
};

describe("placeChip routing", () => {
  it("placeChip re-routes wires under the new chip", () => {
    const [wire, far] = [crossing(), farBlocked()];
    const { project, chipId } = projectOf(chips, [wire, far]);
    expect([blocked(project, chipId, wire.id), blocked(project, chipId, far.id)]).toEqual([
      false,
      true,
    ]);
    const instance = piece({ type: "nand" }, { x: 240, y: 0 });
    const placed = applied(project, { type: "placeChip", chipId, instance });
    expect(blocked(placed, chipId, wire.id)).toBe(false);
    expect(wireIn(placed, chipId, wire.id).waypoints.length).toBeGreaterThan(0);
  });

  it("a wire blocked before the edit, far from it, keeps its identity", () => {
    const [wire, far] = [crossing(), farBlocked()];
    const { project, chipId } = projectOf(chips, [wire, far]);
    const instance = piece({ type: "nand" }, { x: 240, y: 0 });
    const placed = applied(project, { type: "placeChip", chipId, instance });
    expect(wireIn(placed, chipId, far.id)).toBe(far);
  });
});

/** A chip with pin `pin`'s piece at `at`, the far chips and both wires. */
const withPiece = (pin: PinDef, at: { readonly x: number; readonly y: number }) => {
  const [wire, far] = [crossing(), farBlocked()];
  const circuit: Circuit = {
    pins: [pin],
    instances: [...chips, pinPiece(pin, at)],
    wires: [wire, far],
  };
  const host = newChip("host", circuit);
  return { project: projectWith("p", [host]), chipId: host.id, wire, far };
};

describe("pin edits routing", () => {
  it("addPin and setPinWidth re-route blocked wires", () => {
    const { project, chipId, wire, far } = withPiece(pinDef("C", "input"), { x: -400, y: -400 });
    const added = applied(project, {
      type: "addPin",
      chipId,
      pin: pinDef("D", "input"),
      instanceId: newInstanceId(),
      position: { x: 200, y: 20 },
    });
    expect(blocked(added, chipId, wire.id)).toBe(false);
    expect(wireIn(added, chipId, wire.id)).not.toBe(wire);
    expect(wireIn(added, chipId, far.id)).toBe(far);
  });

  it("setPinWidth re-routes the wires its taller piece now covers", () => {
    const pin = pinDef("C", "input");
    const { project, chipId, wire, far } = withPiece(pin, { x: 200, y: -40 });
    expect(blocked(project, chipId, wire.id)).toBe(false);
    const resized = applied(project, { type: "setPinWidth", chipId, pinId: pin.id, width: 16 });
    expect(blocked(resized, chipId, wire.id)).toBe(false);
    expect(wireIn(resized, chipId, wire.id)).not.toBe(wire);
    expect(wireIn(resized, chipId, far.id)).toBe(far);
  });
});

describe("saveChip routing", () => {
  it("re-routes blocked wires in every draft that places the saved chip", () => {
    const { project, child, parent, bystander, wire, far } = savingProject();
    expect(blocked(project, parent.id, wire.id)).toBe(false);
    const saved = createRerouteAfterSave(child.id)(
      project,
      applied(project, { type: "saveChip", chipId: child.id }),
    );
    expect(blocked(saved, parent.id, wire.id)).toBe(false);
    expect(wireIn(saved, parent.id, wire.id)).not.toBe(wire);
    expect(wireIn(saved, parent.id, far.id)).toBe(far);
    expect(saved.chips.find((chip) => chip.id === bystander.id)).toBe(bystander);
  });

  it("treats a draft missing from the snapshot before the save as all new", () => {
    const { project, child, parent, wire } = savingProject();
    const after = applied(project, { type: "saveChip", chipId: child.id });
    const before = { ...project, chips: project.chips.filter((chip) => chip.id !== parent.id) };
    const saved = createRerouteAfterSave(child.id)(before, after);
    expect(wireIn(saved, parent.id, wire.id)).not.toBe(wire);
  });
});

const unroutedChips = [nandAt(0, 0), nandAt(400, 120), nandAt(0, 400), nandAt(400, 420)] as const;

describe("createRouteUnrouted", () => {
  it("routes unrouted wires and keeps everything else, down to the project", () => {
    const [source, sink, left, right] = unroutedChips;
    const level = link([left, NAND_OUT], [right, NAND_A]);
    const bent = link([source, NAND_OUT], [sink, NAND_A]);
    const { project, chipId } = projectOf(unroutedChips, [bent, level]);
    const routed = createRouteUnrouted()(project);
    expect(wireIn(routed, chipId, bent.id).waypoints.length).toBeGreaterThan(0);
    expect(wireIn(routed, chipId, level.id)).toBe(level);
    expect(createRouteUnrouted()(routed)).toBe(routed);
    const empty = projectOf(unroutedChips, []).project;
    expect(createRouteUnrouted()(empty)).toBe(empty);
  });

  it("routes a draft shared by several snapshots once, so they keep sharing it", () => {
    const [source, sink] = unroutedChips;
    const { project, chipId } = projectOf(unroutedChips, [
      link([source, NAND_OUT], [sink, NAND_A]),
    ]);
    const renamed = { ...project, name: "renamed" };
    const route = createRouteUnrouted();
    expect(draftIn(route(project), chipId)).toBe(draftIn(route(renamed), chipId));
  });
});
