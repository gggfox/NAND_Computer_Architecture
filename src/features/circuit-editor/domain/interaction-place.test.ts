/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { describe, expect, it } from "vitest";

import type { Point } from "~/features/projects";

import type { PlaceableKind } from "./actions";
import { screenToWorld } from "./camera";
import type { Effect, InteractionState, Interpreted } from "./interaction";
import { RECENT_LIMIT } from "./interaction-place";
import { command, gesture, screen, setup, tap } from "./interaction.fixtures";
import { placementPosition } from "./placement";
import { selectInstances } from "./selection";

const NAND: PlaceableKind = { type: "nand" };

const dispatched = (result: Interpreted) =>
  result.effects.flatMap((effect: Effect) => (effect.type === "dispatch" ? [effect.action] : []));

const announced = (result: Interpreted) =>
  result.effects.flatMap((effect: Effect) =>
    effect.type === "announce" ? [effect.announcement] : [],
  );

const placing = (state: InteractionState, kind: PlaceableKind = NAND): InteractionState => ({
  ...state,
  placing: kind,
});

describe("armPlacement", () => {
  it("arms the kind, disarms a pin and says so", () => {
    const { context, state, nand } = setup();
    const pinArmed = command({ ...state, focus: nand.id }, context, { type: "arm" }).state;
    expect(pinArmed.armed).toBeDefined();
    const result = command(pinArmed, context, { type: "armPlacement", kind: NAND });
    expect(result.state.placing).toEqual(NAND);
    expect(result.state.armed).toBeUndefined();
    expect(announced(result)).toEqual([{ type: "placing", kind: NAND }]);
  });

  it("arming the same kind again cancels", () => {
    const { context, state } = setup();
    const result = command(placing(state), context, { type: "armPlacement", kind: { ...NAND } });
    expect(result.state.placing).toBeUndefined();
    expect(announced(result)).toEqual([{ type: "placing", kind: undefined }]);
  });

  it("arming another kind switches to it", () => {
    const { context, state } = setup();
    const split: PlaceableKind = { type: "split", width: 4 };
    const result = command(placing(state), context, { type: "armPlacement", kind: split });
    expect(result.state.placing).toEqual(split);
  });

  it("cancelPlacement stops placing, and does nothing when nothing is armed", () => {
    const { context, state } = setup();
    const result = command(placing(state), context, { type: "cancelPlacement" });
    expect(result.state.placing).toBeUndefined();
    expect(announced(result)).toEqual([{ type: "placing", kind: undefined }]);
    expect(command(state, context, { type: "cancelPlacement" })).toEqual({ state, effects: [] });
  });
});

describe("placing taps", () => {
  it("a tap places a copy at the tap and stays armed", () => {
    const { context, state } = setup();
    const point = { x: 200, y: 120 };
    const result = gesture(placing(state), context, tap(point));
    const position = placementPosition(context.scene, NAND, screenToWorld(state.camera, point));
    const [action, ...more] = dispatched(result);
    expect(more).toEqual([]);
    expect(action).toMatchObject({
      type: "placeChip",
      chipId: context.chipId,
      instance: { kind: NAND, position },
    });
    expect(result.state.placing).toEqual(NAND);
    expect(result.state.recent[0]).toEqual(NAND);
    expect(announced(result)).toEqual([{ type: "placed", kind: NAND }]);
  });

  it("a tap on a pin still places (D6)", () => {
    const { context, state } = setup();
    const result = gesture(placing(state), context, tap(screen(160, 60)));
    expect(dispatched(result).map((action) => action.type)).toEqual(["placeChip"]);
    expect(result.state.armed).toBeUndefined();
  });

  it("arming a pin by key stops placing", () => {
    const { context, state, nand } = setup();
    const result = command({ ...placing(state), focus: nand.id }, context, { type: "arm" });
    expect(result.state.armed).toBeDefined();
    expect(result.state.placing).toBeUndefined();
  });
});

describe("placeAt", () => {
  it("places at the viewport centre without a screen point", () => {
    const { context, state } = setup();
    const result = command(state, context, { type: "placeAt", kind: NAND });
    const centre = { x: context.viewport.width / 2, y: context.viewport.height / 2 };
    const position = placementPosition(context.scene, NAND, screenToWorld(state.camera, centre));
    expect(dispatched(result)).toMatchObject([{ type: "placeChip", instance: { position } }]);
    expect(result.state.placing).toBeUndefined();
  });

  it("recent keeps the last five kinds, newest first, without repeats", () => {
    const { context, state } = setup();
    const kinds: readonly PlaceableKind[] = [
      NAND,
      { type: "split", width: 4 },
      { type: "split", width: 8 },
      { type: "split", width: 16 },
      { type: "merge", width: 4 },
      { type: "merge", width: 8 },
      { type: "split", width: 8 },
    ];
    const after = kinds.reduce(
      (current, kind) => command(current, context, { type: "placeAt", kind }).state,
      state,
    );
    expect(after.recent).toHaveLength(RECENT_LIMIT);
    expect(after.recent).toEqual([
      { type: "split", width: 8 },
      { type: "merge", width: 8 },
      { type: "merge", width: 4 },
      { type: "split", width: 16 },
      { type: "split", width: 4 },
    ]);
  });

  it("counts a custom chip once however its kind is built", () => {
    const { context, state } = setup();
    const first: PlaceableKind = { type: "custom", chipId: context.chipId };
    const once = command(state, context, { type: "placeAt", kind: first }).state;
    const twice = command(once, context, { type: "placeAt", kind: { ...first } }).state;
    expect(twice.recent).toEqual([first]);
  });
});

describe("escape while placing", () => {
  it("clears only the placement; the selection stays", () => {
    const { context, state, nand } = setup();
    const before = { ...placing(state), selection: selectInstances([nand.id]) };
    const result = command(before, context, { type: "escape" });
    expect(result.state.placing).toBeUndefined();
    expect([...result.state.selection.instances]).toEqual([nand.id]);
    expect(announced(result)).toEqual([{ type: "placing", kind: undefined }]);
  });

  it("closes an open menu first, keeping the placement", () => {
    const { context, state } = setup();
    const menu = { kind: "canvas", screen: screen(0, 0) } as const;
    const result = command({ ...placing(state), menu }, context, { type: "escape" });
    expect(result.state.menu).toBeUndefined();
    expect(result.state.placing).toEqual(NAND);
  });
});

describe("addPinAt", () => {
  it("adds one output pin piece at the point", () => {
    const { context, state } = setup();
    const point: Point = { x: 400, y: 300 };
    const result = command(state, context, {
      type: "addPinAt",
      direction: "output",
      screen: point,
    });
    const [action, ...more] = dispatched(result);
    expect(more).toEqual([]);
    expect(action?.type).toBe("addPins");
    const pins = action?.type === "addPins" ? action.pins : [];
    expect(pins).toHaveLength(1);
    expect(pins[0]?.pin).toMatchObject({ direction: "output", width: 1 });
  });
});
