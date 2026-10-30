/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { describe, expect, it } from "vitest";

import { EMPTY_CIRCUIT } from "~/features/projects";

import { interact } from "./interact";
import { command, gesture, screen, setup, tap } from "./interaction.fixtures";
import { selectInstances } from "./selection";

describe("tool and stepping", () => {
  it("setTool switches, disarms the lasso and announces", () => {
    const { context, state } = setup();
    const result = command({ ...state, lassoArmed: true }, context, {
      type: "setTool",
      tool: "pan",
    });
    expect(result.state).toMatchObject({ tool: "pan", lassoArmed: false });
    expect(result.effects).toEqual([
      { type: "announce", announcement: { type: "tool", tool: "pan" } },
    ]);
  });

  it("] and [ step through chips in canvas order and wrap", () => {
    const { context, state, pieceA, pieceOut } = setup();
    const next = command(state, context, { type: "selectNext", additive: false }).state;
    expect([...next.selection.instances]).toEqual([pieceA.id]);
    const back = command(next, context, { type: "selectPrevious", additive: false }).state;
    expect([...back.selection.instances]).toEqual([pieceOut.id]);
    const last = command(state, context, { type: "selectPrevious", additive: false }).state;
    expect(last.focus).toBe(pieceOut.id);
    const wrapped = command(last, context, { type: "selectNext", additive: true }).state;
    expect([...wrapped.selection.instances]).toEqual([pieceOut.id, pieceA.id]);
  });

  it("stepping in an empty chip does nothing", () => {
    const { context: demo, state } = setup();
    const context = { ...demo, scene: { ...demo.scene, circuit: EMPTY_CIRCUIT } };
    expect(command(state, context, { type: "selectNext", additive: false })).toEqual({
      state,
      effects: [],
    });
  });

  it("brings an off-screen chip into view", () => {
    const { context, state, pieceA } = setup();
    const away = { ...state, camera: { zoom: 1, x: 2000, y: 2000 } };
    const result = command(away, context, { type: "selectNext", additive: false });
    expect(result.state.focus).toBe(pieceA.id);
    expect(result.state.camera).toEqual({ zoom: 1, x: -332, y: -232 });
    expect(result.effects.at(-1)).toEqual({ type: "cameraSettled" });
  });

  it("select all takes every chip and wire", () => {
    const { context, state, circuit } = setup();
    const result = command(state, context, { type: "selectAll" });
    expect(result.state.selection.instances.size).toBe(circuit.instances.length);
    expect(result.state.selection.wires.size).toBe(circuit.wires.length);
  });
});

describe("escape", () => {
  it("closes an overlay, then the lasso, then the selection, then nothing", () => {
    const { context, state } = setup();
    const opened = gesture(state, context, { type: "contextMenu", point: screen(220, 80) }).state;
    const closed = command({ ...opened, lassoArmed: true }, context, { type: "escape" }).state;
    expect(closed.menu).toBeUndefined();
    expect(closed.selection.instances.size).toBe(1);
    const disarmed = command(closed, context, { type: "escape" }).state;
    expect(disarmed.lassoArmed).toBe(false);
    const cleared = command(disarmed, context, { type: "escape" });
    expect(cleared.state.selection.instances.size).toBe(0);
    expect(command(cleared.state, context, { type: "escape" }).effects).toEqual([]);
  });
});

describe("editing commands", () => {
  it("nudge moves the selection by grid steps, or pans when nothing is selected", () => {
    const { context, state, nand } = setup();
    const chosen = { ...state, selection: selectInstances([nand.id]) };
    expect(command(chosen, context, { type: "nudge", columns: 1, rows: -1 }).effects[0]).toEqual({
      type: "dispatch",
      action: {
        type: "moveChips",
        chipId: context.chipId,
        moves: [{ instanceId: nand.id, position: { x: 200, y: 0 } }],
      },
    });
    const panned = command(state, context, { type: "nudge", columns: 1, rows: 0 });
    expect(panned.state.camera).toEqual({ zoom: 1, x: 40, y: 0 });
    expect(panned.effects).toEqual([{ type: "cameraSettled" }]);
  });

  it("delete removes the selection in one action and clears it", () => {
    const { context, state, nand, circuit } = setup();
    const wireId = circuit.wires[0]?.id;
    const chosen = {
      ...state,
      selection: { instances: new Set([nand.id]), wires: new Set(wireId ? [wireId] : []) },
    };
    const result = command(chosen, context, { type: "deleteSelection" });
    expect(result.effects).toEqual([
      {
        type: "dispatch",
        action: {
          type: "removeItems",
          chipId: context.chipId,
          instanceIds: [nand.id],
          wireIds: [wireId],
        },
      },
      { type: "announce", announcement: { type: "deleted", count: 2 } },
    ]);
    expect(result.state.selection.instances.size).toBe(0);
    expect(command(state, context, { type: "deleteSelection" }).effects).toEqual([]);
  });

  it("undo and redo pass through", () => {
    const { context, state } = setup();
    expect(command(state, context, { type: "undo" }).effects).toEqual([{ type: "undo" }]);
    expect(command(state, context, { type: "redo" }).effects).toEqual([{ type: "redo" }]);
  });
});

describe("camera commands", () => {
  it("zoom in and out about the viewport centre, and fit the circuit", () => {
    const { context, state } = setup();
    expect(command(state, context, { type: "zoomIn" }).state.camera.zoom).toBe(1.25);
    expect(command(state, context, { type: "zoomOut" }).state.camera.zoom).toBe(0.8);
    const fitted = command(state, context, { type: "fit" });
    expect(fitted.state.camera.zoom).toBeGreaterThan(1);
    expect(fitted.effects).toEqual([{ type: "cameraSettled" }]);
  });

  it("wheel zoom and pan change the camera without settling", () => {
    const { context, state } = setup();
    expect(command(state, context, { type: "zoomBy", screen: screen(0, 0), factor: 2 })).toEqual({
      state: { ...state, camera: { zoom: 2, x: 0, y: 0 } },
      effects: [],
    });
    expect(command(state, context, { type: "panBy", delta: { x: -10, y: 0 } }).state.camera.x).toBe(
      10,
    );
  });
});

describe("menu and pin keys", () => {
  it("opens the menu at the top right of a lone or focused selected chip", () => {
    const { context, state, nand, pieceA } = setup();
    const lone = { ...state, selection: selectInstances([nand.id]) };
    expect(command(lone, context, { type: "openMenu" }).state.menu).toEqual({
      instanceId: nand.id,
      screen: screen(280, 40),
    });
    const focused = {
      ...state,
      focus: pieceA.id,
      selection: selectInstances([nand.id, pieceA.id]),
    };
    expect(command(focused, context, { type: "openMenu" }).state.menu?.instanceId).toBe(pieceA.id);
    const many = { ...state, selection: selectInstances([nand.id, pieceA.id]) };
    expect(command(many, context, { type: "openMenu" }).state.menu).toBeUndefined();
  });

  it("P steps through the target chip's pins forwards and backwards", () => {
    const { context, state, nand } = setup();
    const lone = { ...state, selection: selectInstances([nand.id]) };
    const first = command(lone, context, { type: "nextPin", backwards: false });
    expect(first.state.card).toMatchObject({ instanceId: nand.id, pin: 0, pinned: true });
    expect(first.effects).toEqual([
      { type: "announce", announcement: { type: "pin", instanceId: nand.id, pin: 0 } },
    ]);
    const second = command(first.state, context, { type: "nextPin", backwards: false }).state;
    expect(second.card?.pin).toBe(1);
    expect(command(second, context, { type: "nextPin", backwards: true }).state.card?.pin).toBe(0);
    expect(command(lone, context, { type: "nextPin", backwards: true }).state.card?.pin).toBe(2);
    expect(command(state, context, { type: "nextPin", backwards: false })).toEqual({
      state,
      effects: [],
    });
  });
});

describe("history changes", () => {
  it("keep chips that still exist", () => {
    const { context, state, nand, pieceA } = setup();
    const opened = gesture(state, context, tap(screen(160, 60), "touch")).state;
    const withMenu = {
      ...opened,
      menu: { instanceId: nand.id, screen: screen(0, 0) },
      selection: selectInstances([nand.id, pieceA.id]),
    };
    const kept = interact(withMenu, { type: "historyChanged" }, context).state;
    expect(kept).toMatchObject({
      focus: nand.id,
      menu: { instanceId: nand.id },
      card: { instanceId: nand.id },
    });
  });

  it("forget chips that no longer exist", () => {
    const { context, state, nand, pieceA } = setup();
    const opened = gesture(state, context, tap(screen(160, 60), "touch")).state;
    const withMenu = {
      ...opened,
      menu: { instanceId: nand.id, screen: screen(0, 0) },
      selection: selectInstances([nand.id, pieceA.id]),
    };
    const without = {
      ...context.scene,
      circuit: {
        ...context.scene.circuit,
        instances: context.scene.circuit.instances.filter((item) => item.id !== nand.id),
      },
    };
    const pruned = interact(
      withMenu,
      { type: "historyChanged" },
      { ...context, scene: without },
    ).state;
    expect([...pruned.selection.instances]).toEqual([pieceA.id]);
    expect(pruned.focus).toBeUndefined();
    expect(pruned.menu).toBeUndefined();
    expect(pruned.card).toBeUndefined();
  });
});
