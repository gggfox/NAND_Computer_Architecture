/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { describe, expect, it } from "vitest";

import { NONE, gesture, gestures, screen, setup, tap } from "./interaction.fixtures";

describe("tap", () => {
  it("selects a chip, focuses it and announces it", () => {
    const { context, state, nand } = setup();
    const result = gesture(state, context, tap(screen(220, 80)));
    expect([...result.state.selection.instances]).toEqual([nand.id]);
    expect(result.state.focus).toBe(nand.id);
    expect(result.effects).toEqual([
      { type: "announce", announcement: { type: "selected", instanceIds: [nand.id], wires: 0 } },
    ]);
  });

  it("Shift toggles chips and wires", () => {
    const { context, state, nand, pieceA, circuit } = setup();
    const shift = { ...NONE, shift: true };
    const both = gestures(state, context, [
      tap(screen(220, 80)),
      tap(screen(20, 20), "mouse", shift),
    ]);
    expect([...both.state.selection.instances]).toEqual([nand.id, pieceA.id]);
    const wireId = circuit.wires[0]?.id;
    const wires = gestures(state, context, [
      tap(screen(100, 40)),
      tap(screen(100, 40), "mouse", shift),
    ]);
    expect(wires.state.selection.wires.size).toBe(0);
    const wireTap = gesture(state, context, tap(screen(100, 40)));
    expect([...wireTap.state.selection.wires]).toEqual([wireId]);
  });
});

describe("tap on empty canvas and pins", () => {
  it("on empty canvas clears the selection and closes overlays", () => {
    const { context, state } = setup();
    const opened = gesture(state, context, { type: "contextMenu", point: screen(220, 80) }).state;
    const cleared = gesture(opened, context, tap(screen(600, 400)));
    expect(cleared.state.selection.instances.size).toBe(0);
    expect(cleared.state.menu).toBeUndefined();
    expect(cleared.effects).toEqual([{ type: "announce", announcement: { type: "cleared" } }]);
  });

  it("a tap on a pin arms it instead of selecting its chip or opening its card", () => {
    const { context, state, nand } = setup();
    for (const kind of ["touch", "mouse"] as const) {
      const tapped = gesture(state, context, tap(screen(160, 60), kind));
      expect(tapped.state.armed?.end).toEqual({ instanceId: nand.id, pin: 0 });
      expect(tapped.state.card).toBeUndefined();
      expect(tapped.state.selection.instances.size).toBe(0);
    }
  });
});

/** A long-press on the NAND's pin `a`: it pins the card open. */
const pressPin = { type: "longPress", point: screen(160, 60), kind: "touch" } as const;

describe("hover", () => {
  it("a mouse over a pin shows its card; moving away hides it", () => {
    const { context, state, nand } = setup();
    const over = gesture(state, context, { type: "hover", point: screen(160, 100) }).state;
    expect(over.card).toMatchObject({ instanceId: nand.id, pin: 1, pinned: false });
    expect(over.hover).toMatchObject({ type: "pin" });
    const away = gesture(over, context, { type: "hover", point: screen(600, 400) }).state;
    expect(away.card).toBeUndefined();
  });

  it("a pinned card stays while the mouse moves", () => {
    const { context, state } = setup();
    const pinned = gesture(state, context, pressPin).state;
    const moved = gesture(pinned, context, { type: "hover", point: screen(160, 100) }).state;
    expect(moved.card).toMatchObject({ pin: 0, pinned: true });
  });

  it("leaving the canvas ends the hover and its card, but keeps a pinned card", () => {
    const { context, state } = setup();
    const over = gesture(state, context, { type: "hover", point: screen(160, 100) }).state;
    const left = gesture(over, context, { type: "hoverEnd" }).state;
    expect(left.hover).toBeUndefined();
    expect(left.card).toBeUndefined();
    const pinned = gesture(state, context, pressPin).state;
    const hovered = gesture(pinned, context, { type: "hover", point: screen(160, 100) }).state;
    const kept = gesture(hovered, context, { type: "hoverEnd" }).state;
    expect(kept.hover).toBeUndefined();
    expect(kept.card).toMatchObject({ pin: 0, pinned: true });
  });
});

describe("long-press and context menu", () => {
  it("on a chip opens its menu and selects it", () => {
    const { context, state, nand } = setup();
    const point = screen(220, 80);
    const result = gesture(state, context, { type: "longPress", point, kind: "touch" });
    expect(result.state.menu).toEqual({ kind: "chip", instanceId: nand.id, screen: point });
    expect([...result.state.selection.instances]).toEqual([nand.id]);
    const right = gesture(state, context, { type: "contextMenu", point: screen(160, 60) });
    expect(right.state.menu).toEqual({
      kind: "chip",
      instanceId: nand.id,
      screen: screen(160, 60),
    });
  });

  it("on a pin pins its card; on a wire selects it", () => {
    const { context, state, circuit } = setup();
    const pin = gesture(state, context, {
      type: "longPress",
      point: screen(160, 60),
      kind: "touch",
    });
    expect(pin.state.card).toMatchObject({ pin: 0, pinned: true });
    const wire = gesture(state, context, {
      type: "longPress",
      point: screen(100, 40),
      kind: "touch",
    });
    expect([...wire.state.selection.wires]).toEqual([circuit.wires[0]?.id]);
  });

  it("a context menu off any chip closes the chip menu for the canvas menu", () => {
    const { context, state } = setup();
    const opened = gesture(state, context, { type: "contextMenu", point: screen(220, 80) }).state;
    const closed = gesture(opened, context, { type: "contextMenu", point: screen(600, 400) });
    expect(closed.state.menu).toEqual({ kind: "canvas", screen: screen(600, 400) });
    expect(closed.effects).toEqual([]);
  });
});

describe("pinch", () => {
  it("zooms about its centre, closes overlays and settles at the end", () => {
    const { context, state } = setup();
    const opened = gesture(state, context, { type: "contextMenu", point: screen(220, 80) }).state;
    const result = gestures(opened, context, [
      { type: "pinchStart", center: screen(0, 0) },
      { type: "pinch", center: screen(0, 0), scale: 2, pan: { x: 0, y: 0 } },
      { type: "pinch", center: screen(0, 0), scale: 1, pan: { x: 10, y: 0 } },
      { type: "pinchEnd" },
    ]);
    expect(result.state.menu).toBeUndefined();
    expect(result.state.camera).toEqual({ zoom: 2, x: -5, y: 0 });
    expect(result.effects).toEqual([{ type: "cameraSettled" }]);
  });
});

describe("long-press on empty canvas", () => {
  it("on empty canvas arms the lasso in the Select tool, and opens the canvas menu in Pan", () => {
    const empty = { type: "longPress", point: screen(600, 400), kind: "touch" } as const;
    const select = setup();
    const lasso = gesture(select.state, select.context, empty).state;
    expect([lasso.lassoArmed, lasso.menu]).toEqual([true, undefined]);
    const pan = setup("pan");
    const { lassoArmed, menu } = gesture(pan.state, pan.context, empty).state;
    expect({ lassoArmed, menu }).toEqual({
      lassoArmed: false,
      menu: { kind: "canvas", screen: screen(600, 400) },
    });
  });
});
