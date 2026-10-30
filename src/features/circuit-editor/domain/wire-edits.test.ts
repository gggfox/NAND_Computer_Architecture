/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { assert, describe, expect, it } from "vitest";

import { newWireId } from "~/shared/ids";

import { applyAction } from "./reducer";
import { routeWire } from "./routing/route";
import {
  link,
  NAND_A,
  NAND_B,
  NAND_OUT,
  nandAt,
  polylineOf,
  sceneOf,
} from "./routing/routing.fixtures";
import { applied, draftIn, projectOf, wireIn } from "./wire-edits.fixtures";

const [source, sink] = [nandAt(0, 0), nandAt(400, 120)];

describe("connectWire routing", () => {
  it("connectWire routes the new wire and stores its colour", () => {
    const { project, chipId } = projectOf([source, sink], []);
    const wireId = newWireId();
    const connected = applied(project, {
      type: "connectWire",
      chipId,
      wireId,
      from: { instanceId: source.id, pin: NAND_OUT },
      to: { instanceId: sink.id, pin: NAND_A },
      color: "teal",
    });
    const stored = wireIn(connected, chipId, wireId);
    const expected = routeWire(sceneOf([source, sink], [stored]), stored, []);
    assert(expected.ok);
    expect(stored.waypoints.length).toBeGreaterThan(0);
    expect(stored.waypoints).toEqual(expected.value);
    expect(stored.color).toBe("teal");
    expect(stored.manualWaypoints).toBe(false);
  });

  it("connectWire leaves the colour out when none is given", () => {
    const { project, chipId } = projectOf([source, sink], []);
    const wireId = newWireId();
    const connected = applied(project, {
      type: "connectWire",
      chipId,
      wireId,
      from: { instanceId: source.id, pin: NAND_OUT },
      to: { instanceId: sink.id, pin: NAND_A },
    });
    expect(Object.hasOwn(wireIn(connected, chipId, wireId), "color")).toBe(false);
  });
});

describe("connectWire without a route", () => {
  it("connectWire succeeds with empty waypoints when unroutable", () => {
    const far = nandAt(480, 0);
    const probe = link([source, NAND_OUT], [far, NAND_A]);
    const [anchor] = polylineOf(sceneOf([source, far], [probe]), probe.id);
    assert(anchor !== undefined);
    const cover = nandAt(anchor.x, 0);
    const { project, chipId } = projectOf([source, far, cover], []);
    const wireId = newWireId();
    const connected = applyAction(project, {
      type: "connectWire",
      chipId,
      wireId,
      from: { instanceId: source.id, pin: NAND_OUT },
      to: { instanceId: far.id, pin: NAND_A },
    });
    assert(connected.ok);
    expect(wireIn(connected.value, chipId, wireId).waypoints).toEqual([]);
  });
});

describe("recolorWires", () => {
  it("recolorWires recolours many in one action and clears with undefined", () => {
    const [first, second] = [
      link([source, NAND_OUT], [sink, NAND_A]),
      link([source, NAND_OUT], [sink, NAND_B]),
    ];
    const { project, chipId } = projectOf([source, sink], [first, second]);
    const wireIds = [first.id, second.id];
    const red = applied(project, { type: "recolorWires", chipId, wireIds, color: "red" });
    const recolored = draftIn(red, chipId).wires;
    expect(recolored.map((item) => [item.color, item.waypoints])).toEqual([
      ["red", []],
      ["red", []],
    ]);
    const cleared = applied(red, { type: "recolorWires", chipId, wireIds: [first.id] });
    expect(Object.hasOwn(wireIn(cleared, chipId, first.id), "color")).toBe(false);
    expect(wireIn(cleared, chipId, second.id)).toBe(recolored[1]);
  });

  it("recolorWires rejects an empty list and unknown ids", () => {
    const { project, chipId } = projectOf([source, sink], []);
    const wireId = newWireId();
    expect(applyAction(project, { type: "recolorWires", chipId, wireIds: [] })).toEqual({
      ok: false,
      error: { type: "NothingToRecolor" },
    });
    expect(applyAction(project, { type: "recolorWires", chipId, wireIds: [wireId] })).toEqual({
      ok: false,
      error: { type: "WireNotFound", wireId },
    });
  });
});

describe("rerouteWires", () => {
  it("rerouteWires makes a manual wire automatic", () => {
    const manual = {
      ...link([source, NAND_OUT], [sink, NAND_A]),
      waypoints: [
        { x: 200, y: 40 },
        { x: 200, y: 140 },
      ],
      manualWaypoints: true,
    };
    const { project, chipId } = projectOf([source, sink], [manual]);
    const next = applied(project, { type: "rerouteWires", chipId, wireIds: [manual.id] });
    const stored = wireIn(next, chipId, manual.id);
    const expected = routeWire(sceneOf([source, sink], [manual]), manual, []);
    assert(expected.ok);
    expect(stored.manualWaypoints).toBe(false);
    expect(stored.waypoints).toEqual(expected.value);
  });

  it("rerouteWires rejects an empty list and unknown ids", () => {
    const { project, chipId } = projectOf([source, sink], []);
    const wireId = newWireId();
    expect(applyAction(project, { type: "rerouteWires", chipId, wireIds: [] })).toEqual({
      ok: false,
      error: { type: "NothingToReroute" },
    });
    expect(applyAction(project, { type: "rerouteWires", chipId, wireIds: [wireId] })).toEqual({
      ok: false,
      error: { type: "WireNotFound", wireId },
    });
  });
});
