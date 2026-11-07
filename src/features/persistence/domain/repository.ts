import type { ImportError, Project } from "~/features/projects";
import type { ProjectId } from "~/shared/ids";
import type { Result } from "~/shared/result";

import type { PersistenceError } from "./errors";

export interface ProjectSummary {
  readonly id: ProjectId;
  readonly name: string;
}

/** A stored record that cannot be read. It keeps the raw text, so the person can export it. */
export interface DamagedProject {
  readonly damaged: true;
  readonly id: ProjectId;
  readonly cause: ImportError;
  readonly raw: string;
}

export type ProjectEntry = ProjectSummary | DamagedProject;

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- entries carry branded ids; only read
export const isDamaged = (entry: ProjectEntry): entry is DamagedProject => "damaged" in entry;

export interface ProjectRepository {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Project is deeply readonly by schema, branded ids are not by type
  readonly save: (project: Project) => Promise<Result<void, PersistenceError>>;
  readonly load: (id: ProjectId) => Promise<Result<Project, PersistenceError>>;
  /** Lists every stored record. Unreadable records come back as `DamagedProject`. */
  readonly list: () => Promise<Result<readonly ProjectEntry[], PersistenceError>>;
  /** Removes a record, readable or not. Removing an unknown id succeeds. */
  readonly delete: (id: ProjectId) => Promise<Result<void, PersistenceError>>;
}
