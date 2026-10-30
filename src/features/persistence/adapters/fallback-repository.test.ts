import { describe, expect, it } from "vitest";

import { createDemoProject } from "~/features/projects";
import { err } from "~/shared/result";

import type { ProjectRepository } from "../domain/repository";
import { getAppProjectRepository, withMemoryFallback } from "./fallback-repository";
import { createMemoryProjectRepository } from "./idb-project-repository";

const unavailable: ProjectRepository = {
  save: () => Promise.resolve(err({ type: "Unavailable" })),
  load: () => Promise.resolve(err({ type: "Unavailable" })),
  list: () => Promise.resolve(err({ type: "Unavailable" })),
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

  it("switches to the fallback for good once the primary is unavailable", async () => {
    const repo = withMemoryFallback(unavailable, createMemoryProjectRepository());
    expect(await repo.list()).toEqual({ ok: true, value: [] });
    expect(repo.isDegraded()).toBe(true);
    const project = createDemoProject("In memory");
    const saved = await repo.save(project);
    expect(saved.ok).toBe(true);
    expect(await repo.load(project.id)).toEqual({ ok: true, value: project });
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
