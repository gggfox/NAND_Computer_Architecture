import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectRepository } from "~/features/persistence";
import { createDemoProject, EMPTY_CIRCUIT, piece } from "~/features/projects";
import type { Project } from "~/features/projects";
import { newChipId, newInstanceId } from "~/shared/ids";
import { err, ok } from "~/shared/result";

import { createEditorStore, openCircuit } from "./editor-store";

const DEBOUNCE_MS = 300;

// oxlint-disable-next-line unicorn/no-useless-undefined -- Result<void, _> success carries no value
const SAVED = ok(undefined);

const place = (store: ReturnType<typeof createEditorStore>) => ({
  type: "placeChip" as const,
  chipId: store.getState().chipId,
  instance: piece({ type: "nand" }),
});

const fakeRepo = (saveResult: Awaited<ReturnType<ProjectRepository["save"]>>) => {
  const saved: Project[] = [];
  const repo: ProjectRepository = {
    save: (project) => {
      saved.push(project);
      return Promise.resolve(saveResult);
    },
    load: () => Promise.resolve(err({ type: "Unavailable" })),
    list: () => Promise.resolve(ok([])),
  };
  return { repo, saved };
};

describe("openCircuit", () => {
  it("opens the project's last opened chip and falls back to an empty circuit", () => {
    const { repo } = fakeRepo(SAVED);
    const project = createDemoProject("x");
    const store = createEditorStore(project, repo);
    expect(store.getState().chipId).toBe(project.lastOpenedChipId);
    expect(openCircuit(store.getState())).toBe(project.chips[0]?.draft);
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
    expect(store.getState().inputs).toEqual([0, 0]);
    store.getState().setInput(1, 1);
    expect(store.getState().inputs).toEqual([0, 1]);
    store.getState().setInput(5, 1);
    expect(store.getState().inputs).toEqual([0, 1]);
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
    expect(saved[0]).toBe(store.getState().history.present);
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
