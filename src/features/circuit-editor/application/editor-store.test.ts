import { afterEach, assert, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectRepository } from "~/features/persistence";
import { createDemoProject, EMPTY_CIRCUIT, piece } from "~/features/projects";
import { newChipId, newInstanceId, newPinId, newWireId } from "~/shared/ids";
import type { WireId } from "~/shared/ids";
import { err, ok } from "~/shared/result";

import { alreadyBlockedSave, savingProject } from "../domain/route-edits.fixtures";
import {
  entersChips,
  link,
  NAND_A,
  NAND_OUT,
  nandAt,
  polylineOf,
} from "../domain/routing/routing.fixtures";
import { draftIn, projectOf, wireIn } from "../domain/wire-edits.fixtures";
import { createEditorStore, openCircuit } from "./editor-store";
import { DEBOUNCE_MS, fakeRepo, SAVED } from "./editor-store.fixtures";

const place = (store: ReturnType<typeof createEditorStore>) => ({
  type: "placeChip" as const,
  chipId: store.getState().chipId,
  instance: piece({ type: "nand" }),
});

describe("openCircuit", () => {
  it("opens the project's last opened chip and falls back to an empty circuit", () => {
    const { repo } = fakeRepo(SAVED);
    const project = createDemoProject("x");
    const store = createEditorStore(project, repo);
    expect(store.getState().chipId).toBe(project.lastOpenedChipId);
    // Opening routes the demo's unrouted wires, so the open draft is the routed one.
    expect(openCircuit(store.getState())).toBe(store.getState().history.present.chips[0]?.draft);
    expect(openCircuit(store.getState()).instances).toBe(project.chips[0]?.draft.instances);
    expect(openCircuit({ ...store.getState(), chipId: newChipId() })).toBe(EMPTY_CIRCUIT);
  });
});

describe("createEditorStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves once, with the latest project, after 3 rapid dispatches", async () => {
    const { repo, saved } = fakeRepo(SAVED);
    const store = createEditorStore(createDemoProject("x"), repo);
    for (let count = 0; count < 3; count += 1) {
      store.getState().dispatch(place(store));
    }
    expect(saved).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(saved).toHaveLength(1);
    expect(saved[0]?.chips[0]?.draft.instances).toHaveLength(7);
    expect(store.getState().lastError).toBeNull();
  });

  it("does not save when nothing changed", async () => {
    const { repo, saved } = fakeRepo(SAVED);
    createEditorStore(createDemoProject("x"), repo);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(saved).toHaveLength(0);
  });

  it("stores a save failure in lastError and keeps editing", async () => {
    const { repo } = fakeRepo(err({ type: "QuotaExceeded" }));
    const store = createEditorStore(createDemoProject("x"), repo);
    store.getState().dispatch(place(store));
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(store.getState().lastError).toEqual({ type: "QuotaExceeded" });
    expect(store.getState().dispatch(place(store)).ok).toBe(true);
    expect(openCircuit(store.getState()).instances).toHaveLength(6);
  });
});

describe("createEditorStore errors", () => {
  it("returns reducer errors and records them", () => {
    const { repo } = fakeRepo(SAVED);
    const store = createEditorStore(createDemoProject("x"), repo);
    const missing = newInstanceId();
    const result = store
      .getState()
      .dispatch({ type: "removeChip", chipId: store.getState().chipId, instanceId: missing });
    expect(result).toEqual({ ok: false, error: { type: "InstanceNotFound", instanceId: missing } });
    expect(store.getState().lastError).toEqual({ type: "InstanceNotFound", instanceId: missing });
    expect(store.getState().history.past).toHaveLength(0);
  });

  it("clears a stale error on the next successful dispatch", () => {
    const { repo } = fakeRepo(SAVED);
    const store = createEditorStore(createDemoProject("x"), repo);
    store.getState().dispatch({
      type: "removeChip",
      chipId: store.getState().chipId,
      instanceId: newInstanceId(),
    });
    store.getState().dispatch(place(store));
    expect(store.getState().lastError).toBeNull();
  });
});

describe("createEditorStore undo and inputs", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("undo and redo move through history", () => {
    const { repo } = fakeRepo(SAVED);
    const store = createEditorStore(createDemoProject("x"), repo);
    store.getState().dispatch(place(store));
    store.getState().undo();
    expect(openCircuit(store.getState()).instances).toHaveLength(4);
    store.getState().redo();
    expect(openCircuit(store.getState()).instances).toHaveLength(5);
  });

  it("saves after undo", async () => {
    const { repo, saved } = fakeRepo(SAVED);
    const store = createEditorStore(createDemoProject("x"), repo);
    store.getState().dispatch(place(store));
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(saved).toHaveLength(1);
    store.getState().undo();
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(saved).toHaveLength(2);
  });

  it("setInput updates only the signal level, not history", () => {
    const { repo } = fakeRepo(SAVED);
    const store = createEditorStore(createDemoProject("x"), repo);
    const [pinA, pinB] = openCircuit(store.getState()).pins;
    assert(pinA !== undefined && pinB !== undefined);
    expect(store.getState().inputs.size).toBe(0);
    store.getState().setInput(pinB.id, 1);
    expect([...store.getState().inputs]).toEqual([[pinB.id, 1]]);
    store.getState().setInput(newPinId(), 1);
    expect(store.getState().inputs.size).toBe(1);
    expect(store.getState().history.past).toHaveLength(0);
  });
});

const rejectingRepo = (sync: boolean): ProjectRepository => ({
  save: () => {
    if (sync) {
      throw new Error("boom");
    }
    return Promise.reject(new Error("boom"));
  },
  load: () => Promise.resolve(err({ type: "Unavailable" })),
  list: () => Promise.resolve(ok([])),
});

describe("createEditorStore save rejection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([false, true])(
    "sets lastError when save fails (sync=%s) and editing continues",
    async (sync) => {
      const store = createEditorStore(createDemoProject("x"), rejectingRepo(sync));
      store.getState().dispatch(place(store));
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
      expect(store.getState().lastError).toEqual({ type: "Unavailable" });
      expect(store.getState().dispatch(place(store)).ok).toBe(true);
    },
  );
});

describe("createEditorStore flush", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves a pending autosave immediately and only once", async () => {
    const { repo, saved } = fakeRepo(SAVED);
    const store = createEditorStore(createDemoProject("x"), repo);
    store.getState().dispatch(place(store));
    await store.getState().flush();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toEqual(store.getState().history.present);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(saved).toHaveLength(1);
  });

  it("does nothing when no save is pending", async () => {
    const { repo, saved } = fakeRepo(SAVED);
    const store = createEditorStore(createDemoProject("x"), repo);
    await store.getState().flush();
    expect(saved).toHaveLength(0);
  });
});

const [source, sink] = [nandAt(0, 0), nandAt(400, 120)];

/** A store on a project holding `source`, `sink` and `wires`, and a reader of a wire's bends. */
const routingStore = (wires: Parameters<typeof projectOf>[1]) => {
  const { project, chipId } = projectOf([source, sink], wires);
  const store = createEditorStore(project, fakeRepo(SAVED).repo);
  const bends = (wireId: WireId) =>
    wireIn(store.getState().history.present, chipId, wireId).waypoints;
  return { store, chipId, bends };
};

describe("createEditorStore routing", () => {
  it("connect, undo, redo gives the same waypoints", () => {
    const { store, chipId, bends } = routingStore([]);
    const wireId = newWireId();
    const connected = store.getState().dispatch({
      type: "connectWire",
      chipId,
      wireId,
      from: { instanceId: source.id, pin: NAND_OUT },
      to: { instanceId: sink.id, pin: NAND_A },
    });
    expect(connected.ok).toBe(true);
    const routed = bends(wireId);
    expect(routed.length).toBeGreaterThan(0);
    store.getState().undo();
    store.getState().redo();
    expect(bends(wireId)).toEqual(routed);
  });

  it("opening a project routes unrouted wires without adding history", () => {
    const unrouted = link([source, NAND_OUT], [sink, NAND_A]);
    const { store, chipId, bends } = routingStore([unrouted]);
    expect(bends(unrouted.id)).not.toEqual([]);
    expect(store.getState().history.past).toHaveLength(0);
    // Handing the wire back to the router leaves it unrouted until the chip is opened again.
    store.getState().dispatch({ type: "moveWaypoint", chipId, wireId: unrouted.id, waypoints: [] });
    expect(bends(unrouted.id)).toEqual([]);
    const before = store.getState().history;
    expect(store.getState().openChip(chipId).ok).toBe(true);
    expect(store.getState().history.past).toEqual(before.past);
    expect(bends(unrouted.id)).not.toEqual([]);
  });

  it("opening a chip with nothing to route keeps the history object", () => {
    const { store, chipId } = routingStore([link([source, NAND_OUT], [sink, NAND_A])]);
    const before = store.getState().history;
    store.getState().openChip(chipId);
    expect(store.getState().history).toBe(before);
  });
});

describe("createEditorStore saving", () => {
  it("re-routes a parent draft shared by several snapshots once, so they keep sharing it", () => {
    const { project, child, parent, bystander, wire } = savingProject();
    const store = createEditorStore(project, fakeRepo(SAVED).repo);
    store.getState().dispatch({ type: "renameChip", chipId: bystander.id, name: "renamed" });
    const before = wireIn(store.getState().history.present, parent.id, wire.id);
    expect(store.getState().dispatch({ type: "saveChip", chipId: child.id }).ok).toBe(true);
    const { past, present } = store.getState().history;
    const [first] = past;
    assert(first !== undefined);
    expect(draftIn(first, parent.id)).toBe(draftIn(present, parent.id));
    expect(wireIn(present, parent.id, wire.id)).not.toBe(before);
  });

  it("saving does not rewire a host wire the old layout already blocked", () => {
    const { project, child, parent, wire } = alreadyBlockedSave();
    const store = createEditorStore(project, fakeRepo(SAVED).repo);
    const scene = { project, circuit: draftIn(project, parent.id) };
    expect(entersChips(scene, polylineOf(scene, wire.id))).toBe(true);
    expect(store.getState().dispatch({ type: "saveChip", chipId: child.id }).ok).toBe(true);
    expect(wireIn(store.getState().history.present, parent.id, wire.id)).toBe(wire);
  });
});
