import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { EditorSearchSchema } from "~/features/circuit-editor";
import { m } from "~/i18n/paraglide/messages";
import { ProjectIdSchema } from "~/shared/ids";

export const Route = createFileRoute("/projects/$projectId")({
  validateSearch: EditorSearchSchema,
  component: ProjectRoute,
});

function ProjectRoute(): ReactNode {
  const { projectId } = Route.useParams();
  const parsed = ProjectIdSchema.safeParse(projectId);

  if (!parsed.success) {
    return (
      <main>
        <h1>{m.project_not_found_title()}</h1>
        <p>{m.project_not_found_body()}</p>
      </main>
    );
  }

  return (
    <main>
      <h1>{m.app_title()}</h1>
      <p>{parsed.data}</p>
    </main>
  );
}
