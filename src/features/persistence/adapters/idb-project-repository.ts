import { openDB } from "idb";
import type { IDBPDatabase, OpenDBCallbacks } from "idb";

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

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- idb handle
const closeWhenOpen = async (opening: Promise<IDBPDatabase>): Promise<void> => {
  try {
    const late = await opening;
    late.close();
  } catch {
    // The open request failed, so there is no connection to close.
  }
};

/** Connection guards for one open: `blocked` ends the wait, `terminated` marks the result unreliable. */
interface Guards {
  readonly blocked: Promise<"blocked">;
  readonly options: OpenDBCallbacks<unknown>;
  readonly wasTerminated: () => boolean;
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- idb handle
  readonly connected: (db: IDBPDatabase) => void;
}

const createGuards = (): Guards => {
  let reportBlocked: (() => void) | undefined = undefined;
  // oxlint-disable-next-line promise/avoid-new -- the `blocked` callback has no promise of its own to race
  const blocked = new Promise<"blocked">((resolve) => {
    reportBlocked = () => {
      resolve("blocked");
    };
  });
  let current: IDBPDatabase | undefined = undefined;
  let terminated = false;
  return {
    blocked,
    wasTerminated: () => terminated,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- idb handle
    connected: (db) => {
      current = db;
    },
    options: {
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- idb callback receives a mutable database handle
      upgrade(upgradeDb) {
        if (!upgradeDb.objectStoreNames.contains(STORE)) {
          upgradeDb.createObjectStore(STORE);
        }
      },
      // Another tab holds an older connection open, so the upgrade cannot start.
      blocked() {
        reportBlocked?.();
      },
      // Another tab wants to upgrade: close this connection so it can.
      blocking() {
        current?.close();
      },
      // The browser closed the connection without a request from us.
      terminated() {
        terminated = true;
      },
    },
  };
};

/** Runs `operation` on an open connection and always closes it afterwards. */
const runGuarded = async <T>(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- holds idb callbacks
  guards: Guards,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- idb handle
  db: IDBPDatabase,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- idb database handles are mutable by nature
  operation: (db: IDBPDatabase) => Promise<Result<T, PersistenceError>>,
): Promise<Result<T, PersistenceError>> => {
  guards.connected(db);
  try {
    const result = await operation(db);
    return guards.wasTerminated() ? err({ type: "Unavailable" }) : result;
  } finally {
    db.close();
  }
};

/** Opens the database for one operation and always closes it; any failure maps to a PersistenceError. */
const withDb = async <T>(
  dbName: string,
  dbVersion: number,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- idb database handles are mutable by nature
  operation: (db: IDBPDatabase) => Promise<Result<T, PersistenceError>>,
): Promise<Result<T, PersistenceError>> => {
  const guards = createGuards();
  try {
    const opening = openDB(dbName, dbVersion, guards.options);
    const first = await Promise.race([opening, guards.blocked]);
    if (first === "blocked") {
      // The open request stays queued; close its connection if it succeeds later.
      void closeWhenOpen(opening);
      return err({ type: "Blocked" });
    }
    return await runGuarded(guards, first, operation);
  } catch (error) {
    return err(toPersistenceError(error));
  }
};

export const createProjectRepository = (
  dbName = "nand",
  dbVersion = DB_VERSION,
): ProjectRepository => ({
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Project is a branded-id shape
  save: (project) =>
    withDb(
      dbName,
      dbVersion,
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- idb handle
      async (db) => {
        await db.put(STORE, serializeStoredProject(project), project.id);
        return SAVED;
      },
    ),
  load: (id) =>
    withDb(
      dbName,
      dbVersion,
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- idb handle
      async (db) => {
        const text: unknown = await db.get(STORE, id);
        return text === undefined ? err({ type: "NotFound", id }) : parseRecord(id, text);
      },
    ),
  list: () =>
    withDb(
      dbName,
      dbVersion,
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
