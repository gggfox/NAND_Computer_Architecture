/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { describe, expect, it } from "vitest";

import { WireIdSchema } from "~/shared/ids";

import type { InteractionContext } from "./interaction";
import { dispatched } from "./interaction-wiring.fixtures";
import { command, gesture, screen, setup } from "./interaction.fixtures";
import { commandForKey } from "./keymap";
import { selectInstances, selectWire } from "./selection";

const ENTER = { key: "Enter", shift: false, ctrlOrMeta: false, alt: false } as const;
const ON_WIRE = screen(100, 40);
const EMPTY = screen(600, 400);

/** The demo with its first wire red and its last one bent by hand. */
const styled = () => {
  const base = setup();
  const [first, second, third] = base.circuit.wires;
  const wires = [
    { ...first!, color: "red" as const },
    second!,
    { ...third!, manualWaypoints: true },
  ];
  const circuit = { ...base.circuit, wires };
  const context: InteractionContext = {
    ...base.context,
    scene: { ...base.context.scene, circuit },
  };
  return { ...base, circuit, context, wireIds: wires.map((wire) => wire.id) };
};

const enter = () => {
  const key = commandForKey(ENTER);
  expect(key).toEqual({ type: "openMenu" });
  return key!;
};

describe("menu triggers", () => {
  it("long-press on a wire opens the wire menu and selects it", () => {
    const { context, state, circuit } = setup();
    const wireId = circuit.wires[0]!.id;
    const result = gesture(state, context, { type: "longPress", point: ON_WIRE, kind: "touch" });
    expect(result.state.menu).toEqual({ kind: "wire", wireId, screen: ON_WIRE });
    expect([...result.state.selection.wires]).toEqual([wireId]);
    expect(result.effects).toEqual([
      { type: "announce", announcement: { type: "selected", instanceIds: [], wires: 1 } },
    ]);
  });

  it("a wire menu keeps a multi-selection that holds the wire", () => {
    const { context, state, circuit, nand } = setup();
    const wireId = circuit.wires[0]!.id;
    const selection = { instances: new Set([nand.id]), wires: new Set([wireId]), pins: [] };
    const result = gesture({ ...state, selection }, context, {
      type: "contextMenu",
      point: ON_WIRE,
    });
    expect(result.state.menu).toEqual({ kind: "wire", wireId, screen: ON_WIRE });
    expect(result.state.selection).toBe(selection);
    expect(result.effects).toEqual([]);
  });

  it("right-click on a wire alone in the selection reselects only it", () => {
    const { context, state, circuit } = setup();
    const wireId = circuit.wires[0]!.id;
    const result = gesture({ ...state, selection: selectWire(wireId) }, context, {
      type: "contextMenu",
      point: ON_WIRE,
    });
    expect(result.state.menu).toMatchObject({ kind: "wire", wireId });
    expect([...result.state.selection.wires]).toEqual([wireId]);
  });
});

describe("canvas menu triggers", () => {
  it("right-click on empty canvas opens the canvas menu", () => {
    const { context, state, nand } = setup();
    const busy = { ...state, selection: selectInstances([nand.id]) };
    const result = gesture(busy, context, { type: "contextMenu", point: EMPTY });
    expect(result.state.menu).toEqual({ kind: "canvas", screen: EMPTY });
    expect(result.state.selection).toBe(busy.selection);
  });

  it("long-press on empty canvas still arms the lasso", () => {
    const { context, state } = setup();
    const result = gesture(state, context, { type: "longPress", point: EMPTY, kind: "touch" });
    expect(result.state.lassoArmed).toBe(true);
    expect(result.state.menu).toBeUndefined();
  });
});

describe("Enter opens the menu the selection asks for", () => {
  it("Enter with only wires selected opens the wire menu", () => {
    const { context, state, circuit } = setup();
    const [first, second] = circuit.wires;
    const selection = { ...selectWire(first!.id), wires: new Set([first!.id, second!.id]) };
    const result = command({ ...state, selection }, context, enter());
    // The first selected wire's route runs (40,20) → (100,20) → (100,60) → (160,60).
    expect(result.state.menu).toEqual({ kind: "wire", wireId: first!.id, screen: screen(100, 40) });
  });

  it("Enter with nothing selected opens the canvas menu", () => {
    const { context, state } = setup();
    const result = command(state, context, enter());
    expect(result.state.menu).toEqual({ kind: "canvas", screen: { x: 400, y: 300 } });
  });

  it("a selected wire that is gone opens the canvas menu instead", () => {
    const { context, state } = setup();
    const ghost = WireIdSchema.parse("00000000-0000-4000-8000-0000000000ff");
    const result = command({ ...state, selection: selectWire(ghost) }, context, enter());
    expect(result.state.menu).toMatchObject({ kind: "canvas" });
  });
});

describe("wire and canvas menu commands", () => {
  it("recolorSelection recolours every selected wire in one dispatch", () => {
    const { context, state, wireIds, nand } = styled();
    const { chipId } = context;
    const selection = {
      instances: new Set([nand.id]),
      wires: new Set(wireIds.slice(0, 2)),
      pins: [],
    };
    const menu = { kind: "wire", wireId: wireIds[0]!, screen: ON_WIRE } as const;
    const result = command({ ...state, selection, menu }, context, {
      type: "recolorSelection",
      color: "teal",
    });
    expect(dispatched(result.effects)).toEqual([
      { type: "recolorWires", chipId, wireIds: wireIds.slice(0, 2), color: "teal" },
    ]);
    expect(result.state.menu).toBeUndefined();
    const cleared = command({ ...state, selection }, context, { type: "recolorSelection" });
    expect(dispatched(cleared.effects)).toEqual([
      { type: "recolorWires", chipId, wireIds: wireIds.slice(0, 2) },
    ]);
    expect(command(state, context, { type: "recolorSelection" }).effects).toEqual([]);
  });

  it("tidyWires sends every automatic wire and skips manual ones", () => {
    const { context, state, wireIds } = styled();
    const result = command(state, context, { type: "tidyWires" });
    expect(dispatched(result.effects)).toEqual([
      { type: "rerouteWires", chipId: context.chipId, wireIds: wireIds.slice(0, 2) },
    ]);
    const manual = context.scene.circuit.wires.map((wire) => ({ ...wire, manualWaypoints: true }));
    const handmade = {
      ...context,
      scene: { ...context.scene, circuit: { ...context.scene.circuit, wires: manual } },
    };
    expect(command(state, handmade, { type: "tidyWires" }).effects).toEqual([]);
  });
});

describe("re-route, branch and bend commands", () => {
  it("rerouteWire re-routes that one wire", () => {
    const { context, state, wireIds } = styled();
    const result = command(state, context, { type: "rerouteWire", wireId: wireIds[2]! });
    expect(dispatched(result.effects)).toEqual([
      { type: "rerouteWires", chipId: context.chipId, wireIds: [wireIds[2]] },
    ]);
  });

  it("branch arms the wire's source in its colour", () => {
    const { context, state, circuit, pieceA, wireIds } = styled();
    const menu = { kind: "wire", wireId: wireIds[0]!, screen: ON_WIRE } as const;
    const result = command({ ...state, menu }, context, { type: "branch", wireId: wireIds[0]! });
    expect(result.state.armed).toMatchObject({ end: circuit.wires[0]!.from, color: "red" });
    expect(result.state.armed?.end.instanceId).toBe(pieceA.id);
    expect(result.state.menu).toBeUndefined();
    const plain = command(state, context, { type: "branch", wireId: wireIds[1]! }).state;
    expect(plain.armed).toBeDefined();
    expect(plain.armed?.color).toBeUndefined();
  });

  it("branch and editBends on a wire that is gone only close the menu", () => {
    const { context, state } = setup();
    const ghost = WireIdSchema.parse("00000000-0000-4000-8000-0000000000ff");
    const menu = { kind: "canvas", screen: EMPTY } as const;
    for (const type of ["branch", "editBends"] as const) {
      const result = command({ ...state, menu }, context, { type, wireId: ghost });
      expect(result.state).toEqual(state);
      expect(result.effects).toEqual([]);
    }
  });

  it("editBends puts the wire in bend mode and closes the menu", () => {
    const { context, state, wireIds } = styled();
    const menu = { kind: "wire", wireId: wireIds[0]!, screen: ON_WIRE } as const;
    const result = command({ ...state, menu }, context, {
      type: "editBends",
      wireId: wireIds[0]!,
    });
    expect(result.state.bends).toEqual({ wireId: wireIds[0], segment: 1 });
    expect(result.effects).toEqual([
      { type: "announce", announcement: { type: "bends", active: true } },
    ]);
    expect(result.state.menu).toBeUndefined();
  });
});
