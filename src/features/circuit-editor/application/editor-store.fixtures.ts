import type { ProjectRepository } from "~/features/persistence";
import type { Project } from "~/features/projects";
import { err, ok } from "~/shared/result";

export const DEBOUNCE_MS = 300;

// oxlint-disable-next-line unicorn/no-useless-undefined -- Result<void, _> success carries no value
export const SAVED = ok(undefined);

/** A repository that records every save and answers with `saveResult`. */
export const fakeRepo = (saveResult: Awaited<ReturnType<ProjectRepository["save"]>>) => {
  const saved: Project[] = [];
  const repo: ProjectRepository = {
    save: (project) => {
      saved.push(project);
      return Promise.resolve(saveResult);
    },
    load: () => Promise.resolve(err({ type: "Unavailable" })),
    list: () => Promise.resolve(ok([])),
  };
  return { repo, saved };
};
