/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { assert, describe, expect, it } from "vitest";

import { piece } from "~/features/projects";
import type { Point } from "~/features/projects";

import { layoutIn, wireRoute } from "./geometry";
import { buildIndex, hitTest } from "./hit-test";
import type { InteractionContext } from "./interaction";
import { afterHistory } from "./interaction-history";
import {
  dispatched,
  EMPTY,
  NAND_A,
  NAND_OUT,
  PIN_A_OUT,
  wiring,
} from "./interaction-wiring.fixtures";
import { command, drag, gesture, gestures, screen, tap, WIRE_ID } from "./interaction.fixtures";

/** A 4-bit merge at (480, 400) and its bus output's key. */
const mergeWithOutput = (base: ReturnType<typeof wiring>) => {
  const merge = piece({ type: "merge", width: 4 }, { x: 480, y: 400 });
  const layout = layoutIn(base.context.scene, merge);
  const out = layout.pins.find((pin) => pin.anchor.x === layout.rect.x + layout.rect.width);
  assert(out !== undefined);
  return { merge, out: out.key };
};

/** The wiring demo plus a 4-bit merge whose bus output bit 2 drives the NAND's input `a`. */
const withBitWire = () => {
  const base = wiring();
  const { merge, out } = mergeWithOutput(base);
  const from = { instanceId: merge.id, pin: out, bit: 2 };
  const [model] = base.circuit.wires;
  assert(model !== undefined);
  const bitWire = { ...model, id: WIRE_ID, from, to: { instanceId: base.nand.id, pin: 0 } };
  const circuit = {
    ...base.circuit,
    instances: [...base.circuit.instances, merge],
    wires: [...base.circuit.wires, bitWire],
  };
  const scene = { ...base.context.scene, circuit };
  const context: InteractionContext = { ...base.context, scene, index: () => buildIndex(scene) };
  return { ...base, context, from, bitWire };
};

/** A screen point on the middle of a route segment where `wireId` is what a press hits. */
const onWire = (context: InteractionContext, route: readonly Point[], wireId: string): Point => {
  const middles = route.slice(1).map((point, index) => {
    const previous = route[index] ?? point;
    return { x: (point.x + previous.x) / 2, y: (point.y + previous.y) / 2 };
  });
  const found = middles.find((point) => {
    const hit = hitTest(context.index(), point, 1);
    return hit.type === "wire" && hit.wireId === wireId;
  });
  assert(found !== undefined);
  return screen(found.x, found.y);
};

describe("wire drags and tools", () => {
  it("in the Pan tool a drag on a wire pans and keeps the armed pin", () => {
    const { context, state, pieceA } = wiring();
    const armed = gesture({ ...state, tool: "pan" }, context, tap(PIN_A_OUT)).state;
    const result = gestures(armed, context, drag(screen(100, 100), screen(60, 100)));
    expect(result.state.camera).toEqual({ zoom: 1, x: 40, y: 0 });
    expect(result.state.armed?.end).toEqual({ instanceId: pieceA.id, pin: 0 });
    expect(dispatched(result.effects)).toEqual([]);
    // A drag from a pin still draws a wire in the Pan tool.
    const [start] = drag(PIN_A_OUT, EMPTY);
    expect(gesture({ ...state, tool: "pan" }, context, start!).state.drag?.kind).toBe("wire");
  });

  it("a drag from a pin clears the hover, as a chip move does", () => {
    const { context, state } = wiring();
    const hovering = gesture(state, context, { type: "hover", point: PIN_A_OUT }).state;
    expect(hovering.hover).toBeDefined();
    const [start] = drag(PIN_A_OUT, EMPTY);
    expect(gesture(hovering, context, start!).state.hover).toBeUndefined();
  });
});

describe("branching from a bit", () => {
  it("a branch drag from a wire whose from carries a bit keeps that bit on the armed end", () => {
    const { context, state, from, bitWire } = withBitWire();
    const point = onWire(context, wireRoute(context.scene, bitWire), bitWire.id);
    const [start] = drag(point, EMPTY);
    const drawing = gesture(state, context, start!).state;
    expect(drawing.armed?.end).toEqual(from);
    expect(drawing.drag).toMatchObject({ kind: "wire", from });
  });
});

describe("a bus pin armed", () => {
  it("pickBit puts the bit on the armed end", () => {
    const { context, state, pieceA, split, busIn } = wiring();
    const picking = gestures(state, context, [tap(busIn.screen), tap(PIN_A_OUT)]).state;
    expect(picking.bitPick).toMatchObject({ bus: "armed", bits: [0, 1, 2, 3] });
    const picked = command(picking, context, { type: "pickBit", bit: 1 });
    expect(dispatched(picked.effects)).toEqual([
      expect.objectContaining({
        type: "connectWire",
        from: { instanceId: pieceA.id, pin: 0 },
        to: { instanceId: split.id, pin: busIn.key, bit: 1 },
      }),
    ]);
  });
});

describe("a wire drag interrupted", () => {
  it("Escape ends the drag too, so the release says nothing more", () => {
    const { context, state } = wiring();
    const [start, move, end] = drag(PIN_A_OUT, NAND_A);
    const drawing = gestures(state, context, [start!, move!]).state;
    const escaped = command(drawing, context, { type: "escape" });
    expect(escaped.state.drag).toBeUndefined();
    expect(escaped.state.armed).toBeUndefined();
    expect(escaped.effects).toEqual([{ type: "announce", announcement: { type: "disarmed" } }]);
    expect(gesture(escaped.state, context, end!).effects).toEqual([]);
  });

  it("the release wires from where the drag started, whatever is armed meanwhile", () => {
    const { context, state, pieceA, nand } = wiring();
    const [start, move, end] = drag(PIN_A_OUT, NAND_A);
    const drawing = gestures(state, context, [start!, move!]).state;
    assert(drawing.armed !== undefined);
    const swapped = {
      ...drawing,
      armed: { ...drawing.armed, end: { instanceId: nand.id, pin: 2 } },
    };
    expect(dispatched(gesture(swapped, context, end!).effects)).toEqual([
      expect.objectContaining({
        from: { instanceId: pieceA.id, pin: 0 },
        to: { instanceId: nand.id, pin: 0 },
      }),
    ]);
  });
});

describe("a wire drag after an edit", () => {
  it("afterHistory ends a wire drag whose starting chip is gone", () => {
    const { context, state, pieceA } = wiring();
    const [start] = drag(PIN_A_OUT, EMPTY);
    const drawing = gesture(state, context, start!).state;
    const circuit = {
      ...context.scene.circuit,
      instances: context.scene.circuit.instances.filter((item) => item.id !== pieceA.id),
    };
    const after = afterHistory(drawing, { ...context.scene, circuit });
    expect(after.drag).toBeUndefined();
    expect(after.armed).toBeUndefined();
    expect(afterHistory(drawing, context.scene).drag).toEqual(drawing.drag);
  });

  it("afterHistory keeps a wire drag from a chip that is still there", () => {
    const { context, state, pieceA } = wiring();
    const circuit = {
      ...context.scene.circuit,
      instances: context.scene.circuit.instances.filter((item) => item.id !== pieceA.id),
    };
    const [nandStart] = drag(NAND_OUT, EMPTY);
    const fromNand = gesture(state, context, nandStart!).state;
    expect(afterHistory(fromNand, { ...context.scene, circuit }).drag?.kind).toBe("wire");
    const panning = { ...state, drag: { kind: "pan", last: EMPTY } } as const;
    expect(afterHistory(panning, context.scene).drag).toEqual(panning.drag);
  });
});
