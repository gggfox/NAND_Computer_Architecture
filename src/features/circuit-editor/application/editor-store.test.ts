import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectRepository } from "~/features/persistence";
import { createDemoProject } from "~/features/projects";
import type { Project } from "~/features/projects";
import { newInstanceId } from "~/shared/ids";
import { err, ok } from "~/shared/result";

import { createEditorStore } from "./editor-store";

const DEBOUNCE_MS = 300;

// oxlint-disable-next-line unicorn/no-useless-undefined -- Result<void, _> success carries no value
const SAVED = ok(undefined);

const place = () => ({
  type: "placeChip" as const,
  instance: {
    id: newInstanceId(),
    kind: { type: "builtin" as const, builtin: "nand" as const },
    /* oxlint-disable-next-line eslint/id-length -- `x` and `y` are coordinate names */
    position: { x: 0, y: 0 },
  },
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
      store.getState().dispatch(place());
    }
    expect(saved).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(saved).toHaveLength(1);
    expect(saved[0]?.rootCircuit.instances).toHaveLength(7);
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
    store.getState().dispatch(place());
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    expect(store.getState().lastError).toEqual({ type: "QuotaExceeded" });
    expect(store.getState().dispatch(place()).ok).toBe(true);
    expect(store.getState().history.present.rootCircuit.instances).toHaveLength(6);
  });
});

describe("createEditorStore errors", () => {
  it("returns reducer errors and records them", () => {
    const { repo } = fakeRepo(SAVED);
    const store = createEditorStore(createDemoProject("x"), repo);
    const missing = newInstanceId();
    const result = store.getState().dispatch({ type: "removeChip", instanceId: missing });
    expect(result).toEqual({ ok: false, error: { type: "InstanceNotFound", instanceId: missing } });
    expect(store.getState().lastError).toEqual({ type: "InstanceNotFound", instanceId: missing });
    expect(store.getState().history.past).toHaveLength(0);
  });

  it("clears a stale error on the next successful dispatch", () => {
    const { repo } = fakeRepo(SAVED);
    const store = createEditorStore(createDemoProject("x"), repo);
    store.getState().dispatch({ type: "removeChip", instanceId: newInstanceId() });
    store.getState().dispatch(place());
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
    store.getState().dispatch(place());
    store.getState().undo();
    expect(store.getState().history.present.rootCircuit.instances).toHaveLength(4);
    store.getState().redo();
    expect(store.getState().history.present.rootCircuit.instances).toHaveLength(5);
  });

  it("saves after undo", async () => {
    const { repo, saved } = fakeRepo(SAVED);
    const store = createEditorStore(createDemoProject("x"), repo);
    store.getState().dispatch(place());
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
      store.getState().dispatch(place());
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
      expect(store.getState().lastError).toEqual({ type: "Unavailable" });
      expect(store.getState().dispatch(place()).ok).toBe(true);
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
    store.getState().dispatch(place());
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
