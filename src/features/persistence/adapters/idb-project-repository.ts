import { openDB } from "idb";
import type { IDBPDatabase } from "idb";

import { parseStoredProject, serializeStoredProject } from "~/features/projects";
import type { Project } from "~/features/projects";
import type { ProjectId } from "~/shared/ids";
import { err, ok } from "~/shared/result";
import type { Result } from "~/shared/result";

import type { PersistenceError } from "../domain/errors";
import type { ProjectRepository, ProjectSummary } from "../domain/repository";

// `ok()` needs a value argument, and the unit value is exactly what a void Result carries.
// oxlint-disable-next-line unicorn/no-useless-undefined
const SAVED: Result<void, never> = ok(undefined);

const STORE = "projects";
const DB_VERSION = 1;

const toPersistenceError = (failure: unknown): PersistenceError =>
  failure instanceof DOMException && failure.name === "QuotaExceededError"
    ? { type: "QuotaExceeded" }
    : { type: "Unavailable" };

const parseRecord = (id: ProjectId, text: unknown): Result<Project, PersistenceError> => {
  if (typeof text !== "string") {
    return err({ type: "Corrupt", id, cause: { type: "NotAProjectFile" } });
  }
  const parsed = parseStoredProject(text);
  return parsed.ok ? parsed : err({ type: "Corrupt", id, cause: parsed.error });
};

/** Unreadable records are skipped so one corrupt project never hides the rest. */
const summarize = (texts: readonly unknown[]): ProjectSummary[] =>
  texts.flatMap((text) => {
    if (typeof text !== "string") {
      return [];
    }
    const parsed = parseStoredProject(text);
    return parsed.ok ? [{ id: parsed.value.id, name: parsed.value.name }] : [];
  });

/** Opens the database for one operation and always closes it; any failure maps to a PersistenceError. */
const withDb = async <T>(
  dbName: string,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- idb database handles are mutable by nature
  operation: (db: IDBPDatabase) => Promise<Result<T, PersistenceError>>,
): Promise<Result<T, PersistenceError>> => {
  try {
    const db = await openDB(dbName, DB_VERSION, {
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- idb callback receives a mutable database handle
      upgrade(upgradeDb) {
        upgradeDb.createObjectStore(STORE);
      },
    });
    try {
      return await operation(db);
    } finally {
      db.close();
    }
  } catch (error) {
    return err(toPersistenceError(error));
  }
};

export const createProjectRepository = (dbName = "nand"): ProjectRepository => ({
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Project is a branded-id shape
  save: (project) =>
    withDb(
      dbName,
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- idb handle
      async (db) => {
        await db.put(STORE, serializeStoredProject(project), project.id);
        return SAVED;
      },
    ),
  load: (id) =>
    withDb(
      dbName,
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- idb handle
      async (db) => {
        const text: unknown = await db.get(STORE, id);
        return text === undefined ? err({ type: "NotFound", id }) : parseRecord(id, text);
      },
    ),
  list: () =>
    withDb(
      dbName,
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- idb handle
      async (db) => {
        const texts: unknown[] = await db.getAll(STORE);
        return ok(summarize(texts));
      },
    ),
});

export const createMemoryProjectRepository = (): ProjectRepository => {
  const records = new Map<ProjectId, string>();
  return {
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Project is a branded-id shape
    save: (project) => {
      records.set(project.id, serializeStoredProject(project));
      return Promise.resolve(SAVED);
    },
    load: (id) => {
      const text = records.get(id);
      return Promise.resolve(
        text === undefined ? err({ type: "NotFound", id }) : parseRecord(id, text),
      );
    },
    list: () => {
      const summaries = summarize([...records.values()]);
      return Promise.resolve(ok(summaries));
    },
  };
};
