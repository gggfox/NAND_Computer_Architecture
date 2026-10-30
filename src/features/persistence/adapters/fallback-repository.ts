import type { Result } from "~/shared/result";

import type { PersistenceError } from "../domain/errors";
import type { ProjectRepository } from "../domain/repository";
import { createMemoryProjectRepository, createProjectRepository } from "./idb-project-repository";

export interface AppProjectRepository extends ProjectRepository {
  /** True once IndexedDB reported `Unavailable` and work is kept in memory only. */
  readonly isDegraded: () => boolean;
}

/**
 * Uses `primary` until it reports `Unavailable` (private browsing, blocked storage), then retries
 * that call and serves every later call from `fallback`, so the app keeps working in memory.
 */
export const withMemoryFallback = (
  primary: ProjectRepository,
  fallback: ProjectRepository,
): AppProjectRepository => {
  let degraded = false;
  const run = async <T>(
    operation: (repo: ProjectRepository) => Promise<Result<T, PersistenceError>>,
  ): Promise<Result<T, PersistenceError>> => {
    if (!degraded) {
      const result = await operation(primary);
      if (result.ok || result.error.type !== "Unavailable") {
        return result;
      }
      degraded = true;
    }
    return operation(fallback);
  };
  return {
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Project is a branded-id shape
    save: (project) => run((repo) => repo.save(project)),
    load: (id) => run((repo) => repo.load(id)),
    list: () => run((repo) => repo.list()),
    isDegraded: () => degraded,
  };
};

// oxlint-disable-next-line unicorn/no-useless-undefined -- init-declarations wants an explicit initial value
let appRepository: AppProjectRepository | undefined = undefined;

/** The one repository the app uses: IndexedDB, falling back to memory. Opens nothing until used. */
export const getAppProjectRepository = (): AppProjectRepository => {
  appRepository ??= withMemoryFallback(createProjectRepository(), createMemoryProjectRepository());
  return appRepository;
};
