import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import type { ReactNode } from "react";

import { Landing } from "~/features/landing";
import {
  getAppProjectRepository,
  isDamaged,
  persistenceErrorMessage,
  useStorageDegraded,
} from "~/features/persistence";
import type { DamagedProject, PersistenceError, ProjectEntry } from "~/features/persistence";
import { createDemoProject, downloadRawRecord } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import { Button, ModalDialog, StatusMessages } from "~/shared/ui";

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

interface DamagedRowProps {
  readonly project: DamagedProject;
  readonly onDelete: (project: DamagedProject) => void;
}

/** A record that cannot be opened. It offers no open action, only export and delete. */
function DamagedRow({ project, onDelete }: DamagedRowProps): ReactNode {
  return (
    <li>
      <span>{m.project_damaged_row({ id: project.id })}</span>
      <Button
        variant="quiet"
        aria-label={m.project_damaged_export_label({ id: project.id })}
        onPress={() => {
          downloadRawRecord(project.raw, project.id);
        }}
      >
        {m.project_damaged_export()}
      </Button>
      <Button
        variant="quiet"
        aria-label={m.project_damaged_delete_label({ id: project.id })}
        onPress={() => {
          onDelete(project);
        }}
      >
        {m.project_damaged_delete()}
      </Button>
    </li>
  );
}

/** The projects that open, as links, and the damaged records, as rows with export and delete. */
const splitEntries = (entries: readonly ProjectEntry[]) => ({
  healthy: entries.flatMap((entry) => (isDamaged(entry) ? [] : [entry])),
  damaged: entries.filter((entry) => isDamaged(entry)),
});

interface ConfirmDeleteProps {
  /** The record to delete; nothing is shown while it is unset. */
  readonly project: DamagedProject | undefined;
  readonly onConfirm: (project: DamagedProject) => void;
  readonly onCancel: () => void;
}

function ConfirmDelete({ project, onConfirm, onCancel }: ConfirmDeleteProps): ReactNode {
  if (project === undefined) {
    return undefined;
  }
  return (
    <ModalDialog title={m.project_damaged_delete_title()} onClose={onCancel}>
      <p>{m.project_damaged_delete_body()}</p>
      <Button
        onPress={() => {
          onConfirm(project);
        }}
      >
        {m.project_damaged_delete_confirm()}
      </Button>
      <Button variant="quiet" onPress={onCancel}>
        {m.project_damaged_delete_cancel()}
      </Button>
    </ModalDialog>
  );
}

/** Removes a damaged record after the person confirmed, then reloads the list. */
function useDeleteDamaged(
  setPending: (project: DamagedProject | undefined) => void,
  setError: (error: PersistenceError) => void,
): (project: DamagedProject) => Promise<void> {
  const router = useRouter();
  return async (project) => {
    setPending(undefined);
    const removed = await getAppProjectRepository().delete(project.id);
    if (removed.ok) {
      await router.invalidate();
    } else {
      setError(removed.error);
    }
  };
}

/** Saves a new demo project and opens it; a failed save is reported through `setError`. */
function useCreateProject(setError: (error: PersistenceError) => void): () => Promise<void> {
  const navigate = useNavigate();
  return async () => {
    const project = createDemoProject(m.demo_project_name());
    const saved = await getAppProjectRepository().save(project);
    if (!saved.ok) {
      setError(saved.error);
      return;
    }
    await navigate({ to: "/projects/$projectId", params: { projectId: project.id } });
  };
}

function Home(): ReactNode {
  const { listed } = Route.useLoaderData();
  const degraded = useStorageDegraded();
  const [saveError, setSaveError] = useState<PersistenceError>();
  const [pendingDelete, setPendingDelete] = useState<DamagedProject>();
  const deleteDamaged = useDeleteDamaged(setPendingDelete, setSaveError);
  const createProject = useCreateProject(setSaveError);

  const notices = [
    ...(degraded ? [m.persistence_error_unavailable()] : []),
    ...(listed.ok ? [] : [persistenceErrorMessage(listed.error)]),
    ...(saveError === undefined ? [] : [persistenceErrorMessage(saveError)]),
  ];

  const { healthy, damaged } = splitEntries(listed.ok ? listed.value : []);

  return (
    <>
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
        projects={healthy}
        damaged={damaged.map((project) => (
          <DamagedRow key={project.id} project={project} onDelete={setPendingDelete} />
        ))}
      />
      <ConfirmDelete
        project={pendingDelete}
        onConfirm={(project) => {
          void deleteDamaged(project);
        }}
        onCancel={() => {
          setPendingDelete(undefined);
        }}
      />
    </>
  );
}
