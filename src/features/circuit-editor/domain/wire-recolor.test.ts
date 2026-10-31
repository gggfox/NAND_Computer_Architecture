/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { assert, describe, expect, it } from "vitest";

import type { Project, Wire } from "~/features/projects";
import type { ChipId } from "~/shared/ids";
import { newWireId } from "~/shared/ids";

import { PIN_CELL } from "./chip-layout";
import {
  edgesOf,
  expectSpaced,
  NAND_A,
  NAND_OUT,
  nandAt,
  polylineOf,
} from "./routing/routing.fixtures";
import { applied, draftIn, projectOf, wireIn } from "./wire-edits.fixtures";

const [source, upper, lower] = [nandAt(0, 0), nandAt(400, -120), nandAt(400, 120)];

/** Two default wires from one output, routed one after the other, so they share a trunk. */
const trunk = () => {
  const start = projectOf([source, upper, lower], []);
  const wireIds = [newWireId(), newWireId()] as const;
  const project = [upper, lower].reduce<Project>(
    (current, sink, index) =>
      applied(current, {
        type: "connectWire",
        chipId: start.chipId,
        wireId: wireIds[index] ?? newWireId(),
        from: { instanceId: source.id, pin: NAND_OUT },
        to: { instanceId: sink.id, pin: NAND_A },
      }),
    start.project,
  );
  return { project, chipId: start.chipId, wireIds };
};

const polylines = (project: Project, chipId: ChipId, wireIds: readonly Wire["id"][]) => {
  const scene = { project, circuit: draftIn(project, chipId) };
  return wireIds.map((wireId) => polylineOf(scene, wireId));
};

const shared = (first: readonly { x: number; y: number }[], second: typeof first): number => {
  const theirs = edgesOf(second);
  return [...edgesOf(first)].filter((edge) => theirs.has(edge)).length;
};

describe("recolorWires routing", () => {
  it("routes a recoloured branch off its old trunk, which keeps its route", () => {
    const { project, chipId, wireIds } = trunk();
    const [first, second] = polylines(project, chipId, wireIds);
    assert(first !== undefined && second !== undefined);
    expect(shared(first, second)).toBeGreaterThan(1);
    const red = applied(project, {
      type: "recolorWires",
      chipId,
      wireIds: [wireIds[0]],
      color: "red",
    });
    expect(wireIn(red, chipId, wireIds[1])).toBe(wireIn(project, chipId, wireIds[1]));
    const [mine, theirs] = polylines(red, chipId, wireIds);
    const [anchor] = first;
    assert(mine !== undefined && theirs !== undefined && anchor !== undefined);
    expectSpaced(mine, theirs, [anchor, { ...anchor, x: anchor.x + PIN_CELL }]);
  });

  it("wires recoloured alike from one source still share a trunk", () => {
    const { project, chipId, wireIds } = trunk();
    const red = applied(project, {
      type: "recolorWires",
      chipId,
      wireIds: [...wireIds],
      color: "red",
    });
    const [first, second] = polylines(red, chipId, wireIds);
    assert(first !== undefined && second !== undefined);
    expect(shared(first, second)).toBeGreaterThan(1);
  });
});

describe("recolorWires and hand bends", () => {
  it("keeps a recoloured wire's hand bends", () => {
    const { project, chipId, wireIds } = trunk();
    const bent = applied(project, {
      type: "moveWaypoint",
      chipId,
      wireId: wireIds[0],
      waypoints: wireIn(project, chipId, wireIds[0]).waypoints,
    });
    const red = applied(bent, {
      type: "recolorWires",
      chipId,
      wireIds: [wireIds[0]],
      color: "red",
    });
    const stored = wireIn(red, chipId, wireIds[0]);
    expect([stored.color, stored.manualWaypoints]).toEqual(["red", true]);
    expect(stored.waypoints).toBe(wireIn(bent, chipId, wireIds[0]).waypoints);
  });
});

describe("edits that change nothing", () => {
  it("recolouring to the colour a wire has keeps the project", () => {
    const { project, chipId, wireIds } = trunk();
    expect(applied(project, { type: "recolorWires", chipId, wireIds: [...wireIds] })).toBe(project);
  });

  it("re-routing wires onto the routes they have keeps the project", () => {
    const { project, chipId, wireIds } = trunk();
    const tidy = applied(project, { type: "rerouteWires", chipId, wireIds: [...wireIds] });
    expect(applied(tidy, { type: "rerouteWires", chipId, wireIds: [...wireIds] })).toBe(tidy);
  });
});
