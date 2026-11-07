import "fake-indexeddb/auto"; // oxlint-disable-line import/no-unassigned-import -- installs the global indexedDB
import { openDB } from "idb";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createDemoProject, MAX_IMPORT_BYTES, serializeProject } from "~/features/projects";
import { newProjectId } from "~/shared/ids";

import type { ProjectRepository } from "../domain/repository";
import { createMemoryProjectRepository, createProjectRepository } from "./idb-project-repository";
import { requestPersistentStorage } from "./storage-persist";

let dbCounter = 0;
const freshDbName = (): string => {
  dbCounter += 1;
  return `test-db-${dbCounter}`;
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const sharedBehaviour = (label: string, make: () => ProjectRepository): void => {
  describe(label, () => {
    it("round-trips a saved project", async () => {
      const repo = make();
      const project = createDemoProject("Round trip");
      const saved = await repo.save(project);
      expect(saved.ok).toBe(true);
      const loaded = await repo.load(project.id);
      expect(loaded).toEqual({ ok: true, value: project });
    });

    it("returns NotFound for an unknown id", async () => {
      const id = newProjectId();
      expect(await make().load(id)).toEqual({ ok: false, error: { type: "NotFound", id } });
    });

    it("reopens a saved project larger than the import cap", async () => {
      const repo = make();
      const project = createDemoProject("x".repeat(MAX_IMPORT_BYTES));
      const saved = await repo.save(project);
      expect(saved.ok).toBe(true);
      expect(await repo.load(project.id)).toEqual({ ok: true, value: project });
      expect(await repo.list()).toEqual({
        ok: true,
        value: [{ id: project.id, name: project.name }],
      });
    });

    it("lists saved project names", async () => {
      const repo = make();
      const alpha = createDemoProject("Alpha");
      const beta = createDemoProject("Beta");
      await repo.save(alpha);
      await repo.save(beta);
      const listed = await repo.list();
      expect(listed).toEqual({
        ok: true,
        value: expect.arrayContaining([
          { id: alpha.id, name: "Alpha" },
          { id: beta.id, name: "Beta" },
        ]) as unknown,
      });
    });
  });
};

const REMOVED = { ok: true, value: undefined };

const sharedDeleteBehaviour = (label: string, make: () => ProjectRepository): void => {
  describe(`${label} delete`, () => {
    it("removes a saved project and ignores an unknown id", async () => {
      const repo = make();
      const project = createDemoProject("Gone");
      await repo.save(project);
      expect(await repo.delete(project.id)).toEqual(REMOVED);
      expect(await repo.list()).toEqual({ ok: true, value: [] });
      expect(await repo.delete(newProjectId())).toEqual(REMOVED);
    });
  });
};

sharedBehaviour("idb repository", () => createProjectRepository(freshDbName()));
sharedBehaviour("memory repository", () => createMemoryProjectRepository());
sharedDeleteBehaviour("idb repository", () => createProjectRepository(freshDbName()));
sharedDeleteBehaviour("memory repository", () => createMemoryProjectRepository());

/** Overwrites a stored record, as a failed write or an old build could leave it. */
const overwrite = async (name: string, id: string, value: unknown): Promise<void> => {
  const raw = await openDB(name);
  await raw.put("projects", value, id);
  raw.close();
};

describe("idb repository corrupt records", () => {
  it("returns Corrupt with an InvalidJson cause for an unparsable record", async () => {
    const name = freshDbName();
    const repo = createProjectRepository(name);
    const project = createDemoProject("Broken");
    await repo.save(project);
    await overwrite(name, project.id, "{");
    expect(await repo.load(project.id)).toEqual({
      ok: false,
      error: { type: "Corrupt", id: project.id, cause: { type: "InvalidJson" } },
    });
  });

  it("lists corrupt records as damaged entries with their raw text", async () => {
    const name = freshDbName();
    const repo = createProjectRepository(name);
    const good = createDemoProject("Good");
    const bad = createDemoProject("Bad");
    await repo.save(good);
    await repo.save(bad);
    await overwrite(name, bad.id, "{");
    expect(await repo.list()).toEqual({
      ok: true,
      value: expect.arrayContaining([
        { id: good.id, name: "Good" },
        { damaged: true, id: bad.id, cause: { type: "InvalidJson" }, raw: "{" },
      ]) as unknown,
    });
  });

  it("lists a record that is not text as damaged", async () => {
    const name = freshDbName();
    const repo = createProjectRepository(name);
    const bad = createDemoProject("Odd");
    await repo.save(bad);
    await overwrite(name, bad.id, { not: "text" });
    expect(await repo.list()).toEqual({
      ok: true,
      value: [
        { damaged: true, id: bad.id, cause: { type: "NotAProjectFile" }, raw: '{"not":"text"}' },
      ],
    });
  });
});

describe("idb repository damaged records", () => {
  it("removes a damaged record", async () => {
    const name = freshDbName();
    const repo = createProjectRepository(name);
    const bad = createDemoProject("Bad");
    await repo.save(bad);
    await overwrite(name, bad.id, "{");
    expect(await repo.delete(bad.id)).toEqual(REMOVED);
    expect(await repo.list()).toEqual({ ok: true, value: [] });
  });
});

describe("idb repository environment failures", () => {
  it("returns Unavailable instead of rejecting when indexedDB.open throws", async () => {
    vi.spyOn(indexedDB, "open").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    const repo = createProjectRepository(freshDbName());
    const project = createDemoProject("Private");
    const unavailable = { ok: false, error: { type: "Unavailable" } };
    expect(await repo.save(project)).toEqual(unavailable);
    expect(await repo.load(project.id)).toEqual(unavailable);
    expect(await repo.list()).toEqual(unavailable);
    expect(await repo.delete(project.id)).toEqual(unavailable);
  });

  it("returns Unavailable when indexedDB is missing entirely", async () => {
    const missing: unknown = undefined;
    vi.stubGlobal("indexedDB", missing);
    const repo = createProjectRepository(freshDbName());
    expect(await repo.list()).toEqual({ ok: false, error: { type: "Unavailable" } });
  });

  it("returns QuotaExceeded when put raises a QuotaExceededError", async () => {
    const repo = createProjectRepository(freshDbName());
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    const result = await repo.save(createDemoProject("Big"));
    expect(result).toEqual({ ok: false, error: { type: "QuotaExceeded" } });
  });

  it("stores compact file text under the projects store", async () => {
    const name = freshDbName();
    const project = createDemoProject("Stored");
    await createProjectRepository(name).save(project);
    const raw = await openDB(name);
    const stored: unknown = await raw.get("projects", project.id);
    expect(typeof stored === "string" && JSON.parse(stored)).toEqual(
      JSON.parse(serializeProject(project)),
    );
    expect(stored).not.toContain("\n");
    raw.close();
  });
});

describe("idb repository version changes", () => {
  it("returns Blocked when an older connection stops the upgrade", async () => {
    const name = freshDbName();
    const holder = await openDB(name, 1, {
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- idb handle
      upgrade(db) {
        db.createObjectStore("projects");
      },
    });
    const result = await createProjectRepository(name, 2).list();
    expect(result).toEqual({ ok: false, error: { type: "Blocked" } });
    holder.close();
  });

  it("closes its connection when another tab wants to upgrade", async () => {
    const repo = createProjectRepository(freshDbName());
    // oxlint-disable-next-line typescript/unbound-method -- called back with the right `this` below
    const original = IDBObjectStore.prototype.getAll;
    const closeSpy = vi.spyOn(IDBDatabase.prototype, "close");
    vi.spyOn(IDBObjectStore.prototype, "getAll").mockImplementation(function getAllAndNotify(
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- DOM types are mutable
      this: IDBObjectStore,
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- DOM types are mutable
      ...args: Parameters<IDBObjectStore["getAll"]>
    ) {
      // Another tab asks to upgrade while this operation runs.
      this.transaction.db.dispatchEvent(
        new IDBVersionChangeEvent("versionchange", { oldVersion: 1, newVersion: 2 }),
      );
      return original.apply(this, args);
    });
    const listed = await repo.list();
    expect(listed.ok).toBe(true);
    // Without the `blocking` callback, the connection closes only twice (once in fake-indexeddb, once at the end of the operation).
    expect(closeSpy).toHaveBeenCalledTimes(3);
  });
});

describe("requestPersistentStorage", () => {
  it("returns the browser's answer", async () => {
    vi.stubGlobal("navigator", { storage: { persist: () => Promise.resolve(true) } });
    expect(await requestPersistentStorage()).toBe(true);
  });

  it("returns false when the API is missing or throws", async () => {
    vi.stubGlobal("navigator", {});
    expect(await requestPersistentStorage()).toBe(false);
    vi.stubGlobal("navigator", {
      storage: { persist: () => Promise.reject(new Error("no")) },
    });
    expect(await requestPersistentStorage()).toBe(false);
  });
});
