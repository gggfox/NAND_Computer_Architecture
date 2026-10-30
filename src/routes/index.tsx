import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { ReactNode } from "react";

import { getAppProjectRepository, persistenceErrorMessage } from "~/features/persistence";
import type { PersistenceError, ProjectSummary } from "~/features/persistence";
import { createDemoProject } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import { Button, LanguagePicker, StatusMessages } from "~/shared/ui";

export const Route = createFileRoute("/")({
  // Data lives in this browser's IndexedDB, so the loader and component only ever run on the client.
  ssr: false,
  loader: async () => {
    const repo = getAppProjectRepository();
    const listed = await repo.list();
    return { listed, degraded: repo.isDegraded() };
  },
  pendingComponent: Pending,
  component: Home,
});

/**
 * Also what the pre-rendered shell shows. It carries no text, because the shell is always built
 * in the base locale and a translated string would not match a client hydrating in another one.
 */
function Pending(): ReactNode {
  return <main aria-busy="true" />;
}

function ProjectList({ projects }: { readonly projects: readonly ProjectSummary[] }): ReactNode {
  if (projects.length === 0) {
    return <p>{m.projects_empty()}</p>;
  }
  return (
    <ul>
      {projects.map((project) => (
        <li key={project.id}>
          <Link to="/projects/$projectId" params={{ projectId: project.id }}>
            {project.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Home(): ReactNode {
  const { listed, degraded } = Route.useLoaderData();
  const navigate = useNavigate();
  const [saveError, setSaveError] = useState<PersistenceError>();

  const createProject = async (): Promise<void> => {
    const project = createDemoProject(m.demo_project_name());
    const saved = await getAppProjectRepository().save(project);
    if (!saved.ok) {
      setSaveError(saved.error);
      return;
    }
    await navigate({ to: "/projects/$projectId", params: { projectId: project.id } });
  };

  const notices = [
    ...(degraded ? [m.persistence_error_unavailable()] : []),
    ...(listed.ok ? [] : [persistenceErrorMessage(listed.error)]),
    ...(saveError === undefined ? [] : [persistenceErrorMessage(saveError)]),
  ];

  return (
    <main className="page">
      <h1>{m.app_title()}</h1>
      <LanguagePicker />
      <StatusMessages messages={notices} />
      <h2>{m.projects_heading()}</h2>
      <Button
        onPress={() => {
          void createProject();
        }}
      >
        {m.new_project()}
      </Button>
      <ProjectList projects={listed.ok ? listed.value : []} />
    </main>
  );
}
