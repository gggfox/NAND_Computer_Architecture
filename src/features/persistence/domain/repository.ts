import type { Project } from "~/features/projects";
import type { ProjectId } from "~/shared/ids";
import type { Result } from "~/shared/result";

import type { PersistenceError } from "./errors";

export interface ProjectSummary {
  readonly id: ProjectId;
  readonly name: string;
}

export interface ProjectRepository {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Project is deeply readonly by schema, branded ids are not by type
  readonly save: (project: Project) => Promise<Result<void, PersistenceError>>;
  readonly load: (id: ProjectId) => Promise<Result<Project, PersistenceError>>;
  readonly list: () => Promise<Result<readonly ProjectSummary[], PersistenceError>>;
}
