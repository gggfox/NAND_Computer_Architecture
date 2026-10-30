import type { ProjectId } from "~/shared/ids";
import { ok } from "~/shared/result";
import type { Result } from "~/shared/result";

import type { PersistenceError } from "../domain/errors";
import type { ProjectRepository, ProjectSummary } from "../domain/repository";
import { createMemoryProjectRepository, createProjectRepository } from "./idb-project-repository";

export interface AppProjectRepository extends ProjectRepository {
  /**
   * True while IndexedDB is unreachable, or while some project's latest save reached memory only.
   * Work saved in that state is lost when the tab closes.
   */
  readonly isDegraded: () => boolean;
  /** Calls `listener` whenever `isDegraded()` changes; returns the unsubscribe function. */
  readonly subscribe: (listener: () => void) => () => void;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- PersistenceError carries branded ids; only read
const isUnavailable = (result: Result<unknown, PersistenceError>): boolean =>
  !result.ok && result.error.type === "Unavailable";

/** Which projects' latest save reached memory only, and who wants to hear when that changes. */
interface Degradation {
  readonly markUnsynced: (id: ProjectId) => void;
  readonly markSynced: (id: ProjectId) => void;
  readonly isUnsynced: (id: ProjectId) => boolean;
  readonly hasUnsynced: () => boolean;
  /** Recomputes the degraded flag from the last primary outcome and notifies on change. */
  readonly update: (primaryDown: boolean) => void;
  readonly isDegraded: () => boolean;
  readonly subscribe: (listener: () => void) => () => void;
}

const createDegradation = (): Degradation => {
  const unsynced = new Set<ProjectId>();
  const listeners = new Set<() => void>();
  let degraded = false;
  return {
    markUnsynced: (id) => {
      unsynced.add(id);
    },
    markSynced: (id) => {
      unsynced.delete(id);
    },
    isUnsynced: (id) => unsynced.has(id),
    hasUnsynced: () => unsynced.size > 0,
    update: (primaryDown) => {
      const next = primaryDown || unsynced.size > 0;
      if (next !== degraded) {
        degraded = next;
        for (const listener of listeners) {
          listener();
        }
      }
    },
    isDegraded: () => degraded,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

type Repos = readonly [primary: ProjectRepository, fallback: ProjectRepository];

const saveTo =
  ([primary, fallback]: Repos, state: Degradation): ProjectRepository["save"] =>
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Project is a branded-id shape
  async (project) => {
    const result = await primary.save(project);
    if (isUnavailable(result)) {
      state.markUnsynced(project.id);
      state.update(true);
      return fallback.save(project);
    }
    if (result.ok) {
      state.markSynced(project.id);
      await fallback.save(project);
    }
    state.update(false);
    return result;
  };

const loadFrom =
  ([primary, fallback]: Repos, state: Degradation): ProjectRepository["load"] =>
  async (id) => {
    if (state.isUnsynced(id)) {
      return fallback.load(id);
    }
    const result = await primary.load(id);
    if (isUnavailable(result)) {
      state.update(true);
      return fallback.load(id);
    }
    state.update(false);
    if (result.ok) {
      await fallback.save(result.value);
    }
    return result;
  };

/** Projects saved to memory only are listed from memory, so they stay reachable after recovery. */
const withDrafts = async (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- summaries carry branded ids; only read
  listed: readonly ProjectSummary[],
  fallback: ProjectRepository,
  state: Degradation,
): Promise<readonly ProjectSummary[]> => {
  const memory = await fallback.list();
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- summaries carry branded ids; only read
  const isDraft = (summary: ProjectSummary): boolean => state.isUnsynced(summary.id);
  const drafts = memory.ok ? memory.value.filter(isDraft) : [];
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- summaries carry branded ids; only read
  const kept = listed.filter((summary) => !isDraft(summary));
  return [...kept, ...drafts];
};

const listFrom =
  ([primary, fallback]: Repos, state: Degradation): ProjectRepository["list"] =>
  async () => {
    const result = await primary.list();
    if (isUnavailable(result)) {
      state.update(true);
      return fallback.list();
    }
    state.update(false);
    return result.ok && state.hasUnsynced()
      ? ok(await withDrafts(result.value, fallback, state))
      : result;
  };

/**
 * Tries `primary` on every call, so a transient failure (iOS Safari drops IDB connections after
 * backgrounding) never latches. When it reports `Unavailable`, the call is served from `fallback`
 * and subscribers hear that the app is degraded. Every save and load is mirrored into `fallback`,
 * so projects stay reachable during an outage, and a project saved to memory only stays
 * "unsynced" (served from memory, keeping the app degraded) until a later save reaches `primary`.
 */
export const withMemoryFallback = (
  primary: ProjectRepository,
  fallback: ProjectRepository,
): AppProjectRepository => {
  const repos: Repos = [primary, fallback];
  const state = createDegradation();
  return {
    save: saveTo(repos, state),
    load: loadFrom(repos, state),
    list: listFrom(repos, state),
    isDegraded: state.isDegraded,
    subscribe: state.subscribe,
  };
};

// oxlint-disable-next-line unicorn/no-useless-undefined -- init-declarations wants an explicit initial value
let appRepository: AppProjectRepository | undefined = undefined;

/** The one repository the app uses: IndexedDB, falling back to memory. Opens nothing until used. */
export const getAppProjectRepository = (): AppProjectRepository => {
  appRepository ??= withMemoryFallback(createProjectRepository(), createMemoryProjectRepository());
  return appRepository;
};
