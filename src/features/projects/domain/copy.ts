import { newProjectId } from "~/shared/ids";
import { err, ok } from "~/shared/result";
import type { Result } from "~/shared/result";

import type { Project } from "./model";

export interface CopyError {
  readonly type: "EmptyName";
}

/**
 * A copy of `project` under a new `ProjectId` and the given name. Used to keep both projects when
 * an imported file has the id of a saved one, and later for forks (ADR 6).
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Project is deeply readonly by schema, branded ids are not by type
export const copyProject = (project: Project, name: string): Result<Project, CopyError> =>
  name.trim() === "" ? err({ type: "EmptyName" }) : ok({ ...project, id: newProjectId(), name });
