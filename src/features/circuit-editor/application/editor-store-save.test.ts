import { assert, describe, expect, it } from "vitest";

import { createDemoProject, findChip, pinDef, unsavedState } from "~/features/projects";
import { newInstanceId } from "~/shared/ids";

import { createEditorStore, openCircuit } from "./editor-store";
import type { EditorStore } from "./editor-store";
import { fakeRepo, SAVED } from "./editor-store.fixtures";

/** Adds an input pin to the open chip. */
const addPin = (store: EditorStore, name: string, top: number) => {
  store.getState().dispatch({
    type: "addPin",
    chipId: store.getState().chipId,
    pin: pinDef(name, "input"),
    instanceId: newInstanceId(),
    // oxlint-disable-next-line eslint/id-length -- `x` and `y` are coordinate names
    position: { x: 0, y: top },
  });
};

/** Adds a pin to the open chip, saves it, and returns the circuit that was saved. */
const editAndSave = (store: EditorStore) => {
  addPin(store, "C", 160);
  const saved = openCircuit(store.getState());
  expect(store.getState().dispatch({ type: "saveChip", chipId: store.getState().chipId }).ok).toBe(
    true,
  );
  return saved;
};

const undoTwice = (store: EditorStore) => {
  store.getState().undo();
  store.getState().undo();
};

describe("createEditorStore save then undo", () => {
  it("undo never reverts a save: the chip reads changed and keeps what was saved", () => {
    const store = createEditorStore(createDemoProject("x"), fakeRepo(SAVED).repo);
    const { chipId } = store.getState();
    const savedCircuit = editAndSave(store);
    addPin(store, "D", 200);
    undoTwice(store);
    const chip = findChip(store.getState().history.present, chipId);
    assert(chip !== undefined);
    expect(unsavedState(chip)).toBe("changed");
    expect(chip.saved).toEqual(savedCircuit);
  });
});
