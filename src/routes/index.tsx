import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { ReactNode } from "react";

import { Landing } from "~/features/landing";
import {
  getAppProjectRepository,
  persistenceErrorMessage,
  useStorageDegraded,
} from "~/features/persistence";
import type { PersistenceError } from "~/features/persistence";
import { createDemoProject } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import { Button, StatusMessages } from "~/shared/ui";

export const Route = createFileRoute("/")({
  // Data lives in this browser's IndexedDB, so the loader and component only ever run on the client.
  ssr: false,
  loader: async () => {
    const listed = await getAppProjectRepository().list();
    return { listed };
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

function Home(): ReactNode {
  const { listed } = Route.useLoaderData();
  const degraded = useStorageDegraded();
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
    <Landing
      notices={<StatusMessages messages={notices} />}
      primaryAction={
        <Button
          onPress={() => {
            void createProject();
          }}
        >
          {m.new_project()}
        </Button>
      }
      projects={listed.ok ? listed.value : []}
    />
  );
}
