import { afterEach, assert, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDemoProject,
  findChip,
  newChip,
  piece,
  pinDef,
  projectWith,
} from "~/features/projects";
import type { Project } from "~/features/projects";
import { newChipId, newFolderId, newInstanceId } from "~/shared/ids";

import { editorStoreErrorMessage } from "../domain/messages";
import { createEditorStore, openCircuit } from "./editor-store";
import type { EditorStore } from "./editor-store";
import { DEBOUNCE_MS, fakeRepo, SAVED } from "./editor-store.fixtures";

const COLOR = "#123456";

const demoStore = (): EditorStore =>
  createEditorStore(createDemoProject("x"), fakeRepo(SAVED).repo);

const demoPins = (store: EditorStore) => {
  const [pinA, pinB] = openCircuit(store.getState()).pins;
  assert(pinA !== undefined && pinB !== undefined);
  return { pinA, pinB };
};

/** The demo chip plus an empty one, opened on the empty one. */
const twoChips = (): Project => {
  const [first] = createDemoProject("first").chips;
  assert(first !== undefined);
  const other = newChip("other");
  return { ...projectWith("two", [first, other]), lastOpenedChipId: other.id };
};

describe("createEditorStore pins", () => {
  it("input values follow their pins across reorder", () => {
    const store = demoStore();
    const { pinA, pinB } = demoPins(store);
    store.getState().setInput(pinA.id, 1);
    const { chipId } = store.getState();
    store.getState().dispatch({ type: "reorderPin", chipId, pinId: pinB.id, toIndex: 0 });
    expect(openCircuit(store.getState()).pins[0]?.id).toBe(pinB.id);
    expect(store.getState().inputs.get(pinA.id)).toBe(1);
    expect(store.getState().inputs.get(pinB.id)).toBeUndefined();
  });

  it("undo after removePin restores the pin and its wires", () => {
    const store = demoStore();
    const before = openCircuit(store.getState());
    const { pinA } = demoPins(store);
    store
      .getState()
      .dispatch({ type: "removePin", chipId: store.getState().chipId, pinId: pinA.id });
    expect(openCircuit(store.getState()).wires).toHaveLength(2);
    store.getState().undo();
    expect(openCircuit(store.getState())).toBe(before);
    expect(openCircuit(store.getState()).wires).toHaveLength(3);
  });
});

describe("createEditorStore open chip", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens on the project's lastOpenedChipId", () => {
    const project = twoChips();
    const store = createEditorStore(project, fakeRepo(SAVED).repo);
    expect(store.getState().chipId).toBe(project.chips[1]?.id);
    expect(openCircuit(store.getState())).toBe(project.chips[1]?.draft);
  });

  it("openChip switches chips and autosave records it", async () => {
    const { repo, saved } = fakeRepo(SAVED);
    const store = createEditorStore(twoChips(), repo);
    const first = store.getState().history.present.chips[0]?.id;
    assert(first !== undefined);
    expect(store.getState().openChip(first).ok).toBe(true);
    expect(store.getState().chipId).toBe(first);
    expect(store.getState().history.past).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(saved.at(-1)?.lastOpenedChipId).toBe(first);
  });

  it("openChip of an unknown chip is ChipNotFound and changes nothing", () => {
    const store = demoStore();
    const before = store.getState();
    const missing = newChipId();
    expect(store.getState().openChip(missing)).toEqual({
      ok: false,
      error: { type: "ChipNotFound", chipId: missing },
    });
    expect(store.getState()).toBe(before);
  });
});

/** Adds input C to the open demo chip and returns its id. */
const addPinC = (store: EditorStore) => {
  const pinC = pinDef("C", "input");
  store.getState().dispatch({
    type: "addPin",
    chipId: store.getState().chipId,
    pin: pinC,
    instanceId: newInstanceId(),
    // oxlint-disable-next-line eslint/id-length -- `x` and `y` are coordinate names
    position: { x: 0, y: 160 },
  });
  return pinC.id;
};

describe("createEditorStore saveChip", () => {
  it("saveChip is not on the undo stack; undo keeps the new saved version", () => {
    const store = demoStore();
    const { chipId } = store.getState();
    const pinC = addPinC(store);
    const pastBefore = store.getState().history.past.length;
    expect(store.getState().dispatch({ type: "saveChip", chipId }).ok).toBe(true);
    expect(store.getState().history.past).toHaveLength(pastBefore);
    store.getState().undo();
    const chip = store.getState().history.present.chips.find((item) => item.id === chipId);
    expect(chip?.saved?.pins.map((pin) => pin.id)).toContain(pinC);
    expect(chip?.draft.pins.map((pin) => pin.id)).not.toContain(pinC);
  });

  it("a rejected saveChip records the error", () => {
    const store = demoStore();
    const missing = newChipId();
    expect(store.getState().dispatch({ type: "saveChip", chipId: missing }).ok).toBe(false);
    expect(store.getState().lastError).toEqual({ type: "ChipNotFound", chipId: missing });
  });
});

/** Every chip a saved version places, across the whole history, that its own snapshot lacks. */
const danglingSavedRefs = (store: EditorStore): readonly string[] => {
  const { past, present, future } = store.getState().history;
  return [...past, present, ...future].flatMap((snapshot) =>
    snapshot.chips.flatMap((chip) =>
      (chip.saved?.instances ?? []).flatMap((instance) =>
        instance.kind.type === "custom" && findChip(snapshot, instance.kind.chipId) === undefined
          ? [instance.kind.chipId]
          : [],
      ),
    ),
  );
};

/** Creates and saves chip Y, places it in the open chip and saves that; returns Y's id. */
const placeSavedChip = (store: EditorStore) => {
  const { chipId, dispatch } = store.getState();
  const created = newChipId();
  dispatch({ type: "createChip", chipId: created, name: "Y", color: COLOR });
  dispatch({ type: "saveChip", chipId: created });
  // oxlint-disable-next-line eslint/id-length -- `x` and `y` are coordinate names
  const instance = piece({ type: "custom", chipId: created }, { x: 480, y: 0 });
  dispatch({ type: "placeChip", chipId, instance });
  expect(dispatch({ type: "saveChip", chipId }).ok).toBe(true);
  return created;
};

describe("createEditorStore createChip", () => {
  it("undo never removes a chip that a saved version places", () => {
    const store = demoStore();
    const created = placeSavedChip(store);
    store.getState().undo();
    store.getState().undo();
    const { chipId, dispatch } = store.getState();
    // oxlint-disable-next-line eslint/id-length -- `x` and `y` are coordinate names
    dispatch({ type: "placeChip", chipId, instance: piece({ type: "nand" }, { x: 0, y: 0 }) });
    expect(danglingSavedRefs(store)).toEqual([]);
    expect(findChip(store.getState().history.present, created)).toBeDefined();
  });

  it("createChip is not an undo step", () => {
    const store = demoStore();
    const created = newChipId();
    store.getState().dispatch({ type: "createChip", chipId: created, name: "New", color: COLOR });
    expect(store.getState().history.past).toHaveLength(0);
    store.getState().undo();
    expect(findChip(store.getState().history.present, created)).toBeDefined();
  });
});

describe("createEditorStore library actions", () => {
  it("createFolder is an undo step", () => {
    const store = createEditorStore(twoChips(), fakeRepo(SAVED).repo);
    store.getState().dispatch({ type: "createFolder", folderId: newFolderId(), name: "Gates" });
    expect(store.getState().history.present.folders).toHaveLength(1);
    store.getState().undo();
    expect(store.getState().history.present.folders).toHaveLength(0);
  });

  it("deleteChip of a chip that is not open resets history and undo changes nothing", () => {
    const store = createEditorStore(twoChips(), fakeRepo(SAVED).repo);
    const [first] = store.getState().history.present.chips;
    assert(first !== undefined);
    store.getState().dispatch({ type: "starChip", chipId: first.id, starred: true });
    store.getState().dispatch({ type: "deleteChip", chipId: first.id });
    expect(store.getState().history.past).toHaveLength(0);
    const { present } = store.getState().history;
    store.getState().undo();
    expect(store.getState().history.present).toBe(present);
    expect(findChip(present, first.id)).toBeUndefined();
  });

  it("deleteChip of the open chip opens the first remaining chip and autosaves it", async () => {
    const { repo, saved } = fakeRepo(SAVED);
    const project = twoChips();
    const store = createEditorStore(project, repo);
    const [first] = project.chips;
    assert(first !== undefined);
    store.getState().dispatch({ type: "deleteChip", chipId: store.getState().chipId });
    expect(store.getState().chipId).toBe(first.id);
    await store.getState().flush();
    expect(saved.at(-1)?.lastOpenedChipId).toBe(first.id);
  });

  it("deleteChip of the last chip is refused with LastChip", () => {
    const store = createEditorStore(createDemoProject("x"), fakeRepo(SAVED).repo);
    const { chipId } = store.getState();
    const result = store.getState().dispatch({ type: "deleteChip", chipId });
    expect(result).toEqual({ ok: false, error: { type: "LastChip" } });
    expect(store.getState().lastError).toEqual({ type: "LastChip" });
  });

  it("editorStoreErrorMessage names the chip that uses another", () => {
    expect(
      editorStoreErrorMessage({ type: "ChipInUse", chipId: newChipId(), usedByName: "Full adder" }),
    ).toBe("Used in Full adder");
  });
});

describe("createEditorStore library edits that change nothing", () => {
  it("a library edit that changes nothing is no undo step", () => {
    const store = createEditorStore(twoChips(), fakeRepo(SAVED).repo);
    const [first] = store.getState().history.present.chips;
    assert(first !== undefined);
    const { past } = store.getState().history;
    store.getState().dispatch({ type: "starChip", chipId: first.id, starred: false });
    store.getState().dispatch({ type: "fileChip", chipId: first.id });
    expect(store.getState().history.past).toBe(past);
  });
});

describe("createEditorStore deleting the open chip", () => {
  it("deleting the open chip never notifies a chipId missing from the present project", () => {
    const store = createEditorStore(twoChips(), fakeRepo(SAVED).repo);
    const missing: unknown[] = [];
    const unsubscribe = store.subscribe((state) => {
      if (findChip(state.history.present, state.chipId) === undefined) {
        missing.push(state.chipId);
      }
    });
    store.getState().dispatch({ type: "deleteChip", chipId: store.getState().chipId });
    unsubscribe();
    expect(missing).toEqual([]);
  });
});
