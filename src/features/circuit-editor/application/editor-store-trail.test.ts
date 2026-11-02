import { describe, expect, it } from "vitest";

import { newChip, projectWith } from "~/features/projects";
import type { Project } from "~/features/projects";
import { newChipId } from "~/shared/ids";

import { createEditorStore } from "./editor-store";
import type { EditorStore } from "./editor-store";
import { fakeRepo, SAVED } from "./editor-store.fixtures";

const full = newChip("Full adder");
const half = newChip("Half adder");
const other = newChip("Other");
const project: Project = {
  ...projectWith("p", [full, half, other]),
  lastOpenedChipId: full.id,
};

const storeOnFull = (): EditorStore => createEditorStore(project, fakeRepo(SAVED).repo);

const inHalf = (): EditorStore => {
  const store = storeOnFull();
  store.getState().lookInside(half.id);
  return store;
};

describe("createEditorStore trail", () => {
  it("starts as the open chip", () => {
    expect(storeOnFull().getState().trail).toEqual([full.id]);
  });

  it("lookInside appends the chip, opens it and leaves the history alone", () => {
    const store = storeOnFull();
    const { history } = store.getState();
    expect(store.getState().lookInside(half.id).ok).toBe(true);
    expect(store.getState().trail).toEqual([full.id, half.id]);
    expect(store.getState().chipId).toBe(half.id);
    expect(store.getState().history.past).toEqual(history.past);
    expect(store.getState().history.future).toEqual(history.future);
  });

  it("lookInside of an unknown chip sets ChipNotFound and changes nothing", () => {
    const store = storeOnFull();
    const chipId = newChipId();
    expect(store.getState().lookInside(chipId).ok).toBe(false);
    expect(store.getState().lastError).toEqual({ type: "ChipNotFound", chipId });
    expect(store.getState().trail).toEqual([full.id]);
  });

  it("goBack cuts the trail and opens that chip", () => {
    const store = inHalf();
    store.getState().goBack(0);
    expect(store.getState().trail).toEqual([full.id]);
    expect(store.getState().chipId).toBe(full.id);
  });

  it("goBack is a no-op out of range or on the last item", () => {
    const store = inHalf();
    store.getState().goBack(1);
    store.getState().goBack(5);
    store.getState().goBack(-1);
    expect(store.getState().trail).toEqual([full.id, half.id]);
    expect(store.getState().chipId).toBe(half.id);
  });

  it("openChip starts a fresh trail", () => {
    const store = inHalf();
    store.getState().openChip(other.id);
    expect(store.getState().trail).toEqual([other.id]);
  });
});

describe("createEditorStore trail after deletes", () => {
  it("deleting a chip earlier in the trail drops it", () => {
    const store = inHalf();
    expect(store.getState().dispatch({ type: "deleteChip", chipId: full.id }).ok).toBe(true);
    expect(store.getState().trail).toEqual([half.id]);
    expect(store.getState().chipId).toBe(half.id);
  });

  it("deleting the open chip leaves the first remaining chip as the trail", () => {
    const store = inHalf();
    store.getState().dispatch({ type: "deleteChip", chipId: half.id });
    const { chipId, trail } = store.getState();
    expect(chipId).toBe(full.id);
    expect(trail).toEqual([full.id]);
  });
});
