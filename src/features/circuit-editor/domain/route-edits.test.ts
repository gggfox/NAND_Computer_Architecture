/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { describe, expect, it } from "vitest";

import { newChip, piece, pinDef, pinPiece, projectWith } from "~/features/projects";
import type { Chip, Wire } from "~/features/projects";
import { newInstanceId } from "~/shared/ids";

import { routeUnrouted } from "./route-edits";
import { link, NAND_A, NAND_OUT, nandAt } from "./routing/routing.fixtures";
import { applied, draftIn, projectOf, wireIn } from "./wire-edits.fixtures";

const [from, to] = [nandAt(0, 0), nandAt(480, 0)];
const middle = piece({ type: "nand" }, { x: 240, y: 0 });
/** Straight from `from` to `to`: through `middle` when it is there. */
const straight = (): Wire => link([from, NAND_OUT], [to, NAND_A]);

describe("placeChip routing", () => {
  it("placeChip re-routes wires under the new chip", () => {
    const wire = straight();
    const { project, chipId } = projectOf([from, to], [wire]);
    const placed = applied(project, { type: "placeChip", chipId, instance: middle });
    expect(wireIn(placed, chipId, wire.id).waypoints.length).toBeGreaterThan(0);
  });

  it("placeChip leaves the wires alone when nothing is blocked", () => {
    const wire = straight();
    const { project, chipId } = projectOf([from, to], [wire]);
    const placed = applied(project, {
      type: "placeChip",
      chipId,
      instance: piece({ type: "nand" }, { x: 240, y: 400 }),
    });
    expect(draftIn(placed, chipId).wires[0]).toBe(wire);
  });
});

describe("pin edits routing", () => {
  it("addPin and setPinWidth re-route blocked wires", () => {
    const wire = straight();
    const { project, chipId } = projectOf([from, to, middle], [wire]);
    const pin = pinDef("C", "input");
    const added = applied(project, {
      type: "addPin",
      chipId,
      pin,
      instanceId: newInstanceId(),
      position: { x: -400, y: 400 },
    });
    expect(wireIn(added, chipId, wire.id).waypoints.length).toBeGreaterThan(0);
    const blocked = straight();
    const circuit = {
      pins: [pin],
      instances: [from, to, middle, pinPiece(pin, { x: -400, y: 400 })],
      wires: [blocked],
    };
    const host = newChip("host", circuit);
    const resized = applied(projectWith("p", [host]), {
      type: "setPinWidth",
      chipId: host.id,
      pinId: pin.id,
      width: 4,
    });
    expect(wireIn(resized, host.id, blocked.id).waypoints.length).toBeGreaterThan(0);
  });
});

const childPins = [pinDef("I", "input"), pinDef("J", "input"), pinDef("O", "output")];

describe("saveChip routing", () => {
  it("re-routes blocked wires in every draft that places the saved chip, and only there", () => {
    const child = newChip("child", { pins: childPins, instances: [], wires: [] }, { saved: true });
    const instance = piece({ type: "custom", chipId: child.id }, { x: 240, y: 0 });
    const wire = straight();
    const parent = newChip("parent", { pins: [], instances: [from, to, instance], wires: [wire] });
    const bystander = newChip("other", { pins: [], instances: [from, to, middle], wires: [wire] });
    const project = projectWith("p", [child, parent, bystander]);
    const saved = applied(project, { type: "saveChip", chipId: child.id });
    expect(wireIn(saved, parent.id, wire.id).waypoints.length).toBeGreaterThan(0);
    expect(saved.chips.find((chip: Chip) => chip.id === bystander.id)).toBe(bystander);
  });
});

const unroutedChips = [nandAt(0, 0), nandAt(400, 120), nandAt(0, 400), nandAt(400, 420)] as const;

describe("routeUnrouted", () => {
  it("routes unrouted wires and keeps everything else, down to the project", () => {
    const [source, sink, left, right] = unroutedChips;
    const level = link([left, NAND_OUT], [right, NAND_A]);
    const bent = link([source, NAND_OUT], [sink, NAND_A]);
    const { project, chipId } = projectOf(unroutedChips, [bent, level]);
    const routed = routeUnrouted(project);
    expect(wireIn(routed, chipId, bent.id).waypoints.length).toBeGreaterThan(0);
    expect(wireIn(routed, chipId, level.id)).toBe(level);
    expect(routeUnrouted(routed)).toBe(routed);
    const empty = projectOf(unroutedChips, []).project;
    expect(routeUnrouted(empty)).toBe(empty);
  });
});
