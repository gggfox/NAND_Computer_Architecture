import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { createDemoProject } from "~/features/projects";
import { err } from "~/shared/result";

import type { ProjectRepository } from "../domain/repository";
import { getAppProjectRepository, withMemoryFallback } from "./fallback-repository";
import type { AppProjectRepository } from "./fallback-repository";
import { createMemoryProjectRepository } from "./idb-project-repository";

const unavailable: ProjectRepository = {
  save: () => Promise.resolve(err({ type: "Unavailable" })),
  load: () => Promise.resolve(err({ type: "Unavailable" })),
  list: () => Promise.resolve(err({ type: "Unavailable" })),
};

interface Flaky {
  readonly store: ProjectRepository;
  readonly repo: AppProjectRepository;
  readonly listener: Mock<() => void>;
  readonly setDown: (down: boolean) => void;
}

/**
 * An app repository whose primary works but reports `Unavailable` while `down`, like IndexedDB
 * after iOS Safari drops the connection, with a subscribed listener.
 */
const flaky = (): Flaky => {
  const store = createMemoryProjectRepository();
  let down = false;
  const pick = (): ProjectRepository => (down ? unavailable : store);
  const primary: ProjectRepository = {
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Project is a branded-id shape
    save: (project) => pick().save(project),
    load: (id) => pick().load(id),
    list: () => pick().list(),
  };
  const repo = withMemoryFallback(primary, createMemoryProjectRepository());
  const listener = vi.fn<() => void>();
  repo.subscribe(listener);
  return {
    store,
    repo,
    listener,
    setDown: (next) => {
      down = next;
    },
  };
};

describe("withMemoryFallback", () => {
  it("serves from the primary while it works", async () => {
    const primary = createMemoryProjectRepository();
    const repo = withMemoryFallback(primary, createMemoryProjectRepository());
    const project = createDemoProject("Kept");
    await repo.save(project);
    expect(await primary.load(project.id)).toEqual({ ok: true, value: project });
    expect(repo.isDegraded()).toBe(false);
  });

  it("keeps working in memory while the primary is unavailable", async () => {
    const repo = withMemoryFallback(unavailable, createMemoryProjectRepository());
    expect(await repo.list()).toEqual({ ok: true, value: [] });
    expect(repo.isDegraded()).toBe(true);
    const project = createDemoProject("In memory");
    const saved = await repo.save(project);
    expect(saved.ok).toBe(true);
    expect(await repo.load(project.id)).toEqual({ ok: true, value: project });
    expect(await repo.list()).toEqual({
      ok: true,
      value: [{ id: project.id, name: "In memory" }],
    });
  });

  it("passes other errors through without degrading", async () => {
    const repo = withMemoryFallback(createMemoryProjectRepository(), unavailable);
    const project = createDemoProject("Missing");
    expect(await repo.load(project.id)).toEqual({
      ok: false,
      error: { type: "NotFound", id: project.id },
    });
    expect(repo.isDegraded()).toBe(false);
  });

  it("returns one shared app repository", () => {
    expect(getAppProjectRepository()).toBe(getAppProjectRepository());
  });
});

describe("withMemoryFallback mid-session failures", () => {
  it("tells subscribers the moment a save falls back", async () => {
    const { repo, listener, setDown } = flaky();
    const project = createDemoProject("Edited");
    await repo.save(project);
    setDown(true);
    const edited = { ...project, name: "Edited twice" };
    const saved = await repo.save(edited);
    expect(saved.ok).toBe(true);
    expect(repo.isDegraded()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(await repo.load(project.id)).toEqual({ ok: true, value: edited });
  });

  it("keeps a memory-only draft listed and loadable after the primary comes back", async () => {
    const { repo, setDown } = flaky();
    setDown(true);
    const project = createDemoProject("Offline draft");
    await repo.save(project);
    setDown(false);
    const summary = { id: project.id, name: "Offline draft" };
    expect(await repo.list()).toEqual({ ok: true, value: [summary] });
    expect(await repo.load(project.id)).toEqual({ ok: true, value: project });
    expect(repo.isDegraded()).toBe(true);
  });

  it("recovers once the draft is saved to the primary again", async () => {
    const { repo, store, listener, setDown } = flaky();
    setDown(true);
    const project = createDemoProject("Offline draft");
    await repo.save(project);
    setDown(false);
    await repo.save(project);
    expect(repo.isDegraded()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(await store.load(project.id)).toEqual({ ok: true, value: project });
  });
});

describe("withMemoryFallback cache and subscriptions", () => {
  it("can reopen a project loaded earlier after the primary drops", async () => {
    const { repo, store, setDown } = flaky();
    const project = createDemoProject("Seen");
    await store.save(project);
    await repo.load(project.id);
    setDown(true);
    expect(await repo.load(project.id)).toEqual({ ok: true, value: project });
    expect(repo.isDegraded()).toBe(true);
  });

  it("stops notifying after unsubscribe", async () => {
    const repo = withMemoryFallback(unavailable, createMemoryProjectRepository());
    const listener = vi.fn<() => void>();
    const unsubscribe = repo.subscribe(listener);
    unsubscribe();
    await repo.list();
    expect(listener).not.toHaveBeenCalled();
  });
});
