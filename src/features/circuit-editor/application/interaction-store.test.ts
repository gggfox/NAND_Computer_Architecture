/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { assert, describe, expect, it, vi } from "vitest";

import type { ProjectRepository } from "~/features/persistence";
import { createDemoProject, piece } from "~/features/projects";
import { ok } from "~/shared/result";

import { SCREEN_PAD } from "../domain/camera";
import type { Camera } from "../domain/camera";
import type { Gesture } from "../domain/gesture-types";
import { createEditorStore, openCircuit } from "./editor-store";
import { createInteractionStore } from "./interaction-store";

const repo: ProjectRepository = {
  // oxlint-disable-next-line unicorn/no-useless-undefined -- Result<void, _> success carries no value
  save: () => Promise.resolve(ok(undefined)),
  load: () => Promise.reject(new Error("unused")),
  list: () => Promise.resolve(ok([])),
  // oxlint-disable-next-line unicorn/no-useless-undefined -- Result<void, _> success carries no value
  delete: () => Promise.resolve(ok(undefined)),
};

const NONE = { shift: false, alt: false, ctrlOrMeta: false, space: false };
const at = (x: number, y: number) => ({ x: x + SCREEN_PAD, y: y + SCREEN_PAD });

const setup = (tool: "pan" | "select" = "select") => {
  const editor = createEditorStore(createDemoProject("x"), repo);
  const view = { changed: vi.fn<(camera: Camera) => void>(), settle: vi.fn<() => void>() };
  const handle = createInteractionStore({
    editor,
    camera: { zoom: 1, x: 0, y: 0 },
    tool,
    viewport: () => ({ width: 800, height: 600 }),
    view,
  });
  const disconnect = handle.connect();
  const send = (gesture: Gesture) => {
    handle.store.getState().send({ type: "gesture", gesture });
  };
  const nand = openCircuit(editor.getState()).instances.find((item) => item.kind.type === "nand");
  assert(nand !== undefined);
  return { editor, view, handle, send, nand, store: handle.store, disconnect };
};

const dragFrom = (
  send: (gesture: Gesture) => void,
  from: { x: number; y: number },
  to: { x: number; y: number },
) => {
  send({
    type: "dragStart",
    origin: from,
    point: from,
    kind: "touch",
    modifiers: NONE,
    afterLongPress: false,
  });
  send({ type: "dragMove", point: to });
  send({ type: "dragEnd", point: to });
};

describe("createInteractionStore", () => {
  it("selects and numbers its announcements", () => {
    const { send, store, nand } = setup();
    send({ type: "tap", point: at(220, 80), kind: "mouse", modifiers: NONE });
    send({ type: "tap", point: at(220, 80), kind: "mouse", modifiers: NONE });
    expect([...store.getState().selection.instances]).toEqual([nand.id]);
    expect(store.getState().announcement).toMatchObject({
      id: 2,
      announcement: { type: "selected" },
    });
  });

  it("a drag is one undo step, and undo puts the chip back", () => {
    const { send, editor, nand, store } = setup();
    const before = editor.getState().history.past.length;
    dragFrom(send, at(220, 80), at(300, 80));
    expect(editor.getState().history.past.length).toBe(before + 1);
    const moved = openCircuit(editor.getState()).instances.find((item) => item.id === nand.id);
    expect(moved?.position).toEqual({ x: 240, y: 40 });
    store.getState().send({ type: "command", command: { type: "undo" } });
    expect(openCircuit(editor.getState()).instances[2]?.position).toEqual(nand.position);
  });

  it("delete then undo restores the chips but not the selection", () => {
    const { send, editor, store } = setup();
    send({ type: "tap", point: at(220, 80), kind: "mouse", modifiers: NONE });
    store.getState().send({ type: "command", command: { type: "deleteSelection" } });
    expect(openCircuit(editor.getState()).instances).toHaveLength(3);
    store.getState().send({ type: "command", command: { type: "undo" } });
    expect(openCircuit(editor.getState()).instances).toHaveLength(4);
    expect(store.getState().selection.instances.size).toBe(0);
  });

  it("prunes the selection when undo removes a selected chip", () => {
    const { editor, store, send } = setup();
    const placed = piece({ type: "nand" }, { x: 480, y: 0 });
    editor
      .getState()
      .dispatch({ type: "placeChip", chipId: editor.getState().chipId, instance: placed });
    send({ type: "tap", point: at(540, 40), kind: "mouse", modifiers: NONE });
    expect([...store.getState().selection.instances]).toEqual([placed.id]);
    editor.getState().undo();
    expect(store.getState().selection.instances.size).toBe(0);
  });
});

describe("createInteractionStore pins", () => {
  it("tapping input A toggles it through the editor, both ways", () => {
    const { send, editor } = setup();
    const [pieceA] = openCircuit(editor.getState()).instances;
    assert(pieceA?.kind.type === "pin");
    const { pinId } = pieceA.kind;
    send({ type: "tap", point: at(20, 20), kind: "mouse", modifiers: NONE });
    expect(editor.getState().inputs.get(pinId)).toBe(1);
    send({ type: "tap", point: at(20, 20), kind: "mouse", modifiers: NONE });
    expect(editor.getState().inputs.get(pinId)).toBe(0);
  });
});

describe("createInteractionStore camera", () => {
  it("mirrors camera moves to the URL and settles at the end of a pan", () => {
    const { send, view, store } = setup("pan");
    dragFrom(send, at(600, 400), at(560, 400));
    expect(store.getState().camera).toEqual({ zoom: 1, x: 40, y: 0 });
    expect(view.changed).toHaveBeenCalledWith({ zoom: 1, x: 40, y: 0 });
    expect(view.settle).toHaveBeenCalledTimes(1);
  });

  it("syncCamera takes an outside camera without writing it back", () => {
    const { store, view } = setup();
    store.getState().syncCamera({ zoom: 2, x: 5, y: 5 });
    expect(store.getState().camera).toEqual({ zoom: 2, x: 5, y: 5 });
    expect(view.changed).not.toHaveBeenCalled();
  });

  it("reuses the hit index until the circuit changes, and stops listening when disposed", () => {
    const { send, editor, store, disconnect } = setup();
    send({ type: "tap", point: at(220, 80), kind: "mouse", modifiers: NONE });
    send({ type: "hover", point: at(160, 60) });
    expect(store.getState().card).toMatchObject({ pin: 0 });
    disconnect();
    send({ type: "tap", point: at(220, 80), kind: "mouse", modifiers: NONE });
    editor.getState().undo();
    expect(store.getState().selection.instances.size).toBe(1);
    store.getState().send({ type: "command", command: { type: "redo" } });
  });
});
