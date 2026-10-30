import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import type { ReactNode } from "react";
import { useStore } from "zustand";

import { CircuitSummary } from "~/features/accessibility";
import {
  CircuitCanvas,
  EditorLayout,
  EditorSearchSchema,
  EditorToolbar,
  editorStoreErrorMessage,
  simulationErrorMessage,
  useEditorSession,
} from "~/features/circuit-editor";
import type { EditorSession } from "~/features/circuit-editor";
import { getAppProjectRepository, persistenceErrorMessage } from "~/features/persistence";
import type { PersistenceError } from "~/features/persistence";
import { importErrorMessage, readProjectFile } from "~/features/projects";
import type { ImportError, Project } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import { ProjectIdSchema } from "~/shared/ids";
import { StatusMessages } from "~/shared/ui";

export const Route = createFileRoute("/projects/$projectId")({
  validateSearch: EditorSearchSchema,
  // Data lives in this browser's IndexedDB, so the loader and component only ever run on the client.
  ssr: false,
  loader: async ({ params }) => {
    const parsed = ProjectIdSchema.safeParse(params.projectId);
    if (!parsed.success) {
      return { kind: "invalid-id" } as const;
    }
    const repo = getAppProjectRepository();
    const loaded = await repo.load(parsed.data);
    // A fresh token per load remounts the editor, so an import over the same id starts clean.
    const token = crypto.randomUUID();
    return { kind: "loaded", loaded, degraded: repo.isDegraded(), token } as const;
  },
  pendingComponent: Pending,
  component: ProjectRoute,
});

/**
 * Also what the pre-rendered shell shows. It carries no text, because the shell is always built
 * in the base locale and a translated string would not match a client hydrating in another one.
 */
function Pending(): ReactNode {
  return <main aria-busy="true" />;
}

function BackLink(): ReactNode {
  return <Link to="/">{m.back_to_projects()}</Link>;
}

function NotFound(): ReactNode {
  return (
    <main className="page">
      <h1>{m.project_not_found_title()}</h1>
      <p>{m.project_not_found_body()}</p>
      <BackLink />
    </main>
  );
}

function Corrupt({ error }: { readonly error: PersistenceError }): ReactNode {
  return (
    <main className="page">
      <h1>{m.project_corrupt_title()}</h1>
      <p role="alert">{persistenceErrorMessage(error)}</p>
      <BackLink />
    </main>
  );
}

function ProjectRoute(): ReactNode {
  const data = Route.useLoaderData();
  if (data.kind === "invalid-id") {
    return <NotFound />;
  }
  const { loaded } = data;
  if (loaded.ok) {
    return <Editor key={data.token} project={loaded.value} degraded={data.degraded} />;
  }
  return loaded.error.type === "NotFound" ? <NotFound /> : <Corrupt error={loaded.error} />;
}

type ImportFailure =
  | { readonly kind: "import"; readonly error: ImportError }
  | { readonly kind: "save"; readonly error: PersistenceError };

const importFailureMessage = (failure: ImportFailure): string =>
  failure.kind === "import"
    ? importErrorMessage(failure.error)
    : persistenceErrorMessage(failure.error);

/** Reads and validates the file, saves it, then opens it (reloading if it replaced this project). */
function useImport(currentId: Project["id"]): {
  readonly failure: ImportFailure | undefined;
  readonly onImport: (file: File) => void;
} {
  const router = useRouter();
  const navigate = useNavigate();
  const [failure, setFailure] = useState<ImportFailure>();

  const open = async (project: Project): Promise<void> => {
    setFailure(undefined);
    await (project.id === currentId
      ? router.invalidate()
      : navigate({ to: "/projects/$projectId", params: { projectId: project.id } }));
  };

  const importFile = async (file: File): Promise<void> => {
    const read = await readProjectFile(file);
    if (!read.ok) {
      setFailure({ kind: "import", error: read.error });
      return;
    }
    const saved = await getAppProjectRepository().save(read.value);
    if (!saved.ok) {
      setFailure({ kind: "save", error: saved.error });
      return;
    }
    await open(read.value);
  };

  return {
    failure,
    onImport: (file) => {
      void importFile(file);
    },
  };
}

function useNotices(
  session: EditorSession,
  degraded: boolean,
  failure: ImportFailure | undefined,
): readonly string[] {
  const lastError = useStore(session.editor, (state) => state.lastError);
  const simulationError = useStore(session.simulation, (state) => state.error);
  return [
    ...(degraded ? [m.persistence_error_unavailable()] : []),
    ...(lastError === null ? [] : [editorStoreErrorMessage(lastError)]),
    ...(simulationError === null ? [] : [simulationErrorMessage(simulationError)]),
    ...(failure === undefined ? [] : [importFailureMessage(failure)]),
  ];
}

interface EditorProps {
  readonly project: Project;
  readonly degraded: boolean;
}

function Editor({ project, degraded }: EditorProps): ReactNode {
  const view = Route.useSearch();
  const session = useEditorSession(project, getAppProjectRepository());
  const { failure, onImport } = useImport(project.id);
  const notices = useNotices(session, degraded, failure);
  const { editor, simulation } = session;

  const toolbar = (
    <>
      <BackLink />
      <EditorToolbar editor={editor} onImport={onImport} />
    </>
  );
  return (
    <main>
      <h1 className="visually-hidden">{project.name}</h1>
      <EditorLayout
        toolbar={toolbar}
        status={<StatusMessages messages={notices} />}
        canvas={<CircuitCanvas editor={editor} simulation={simulation} view={view} />}
        panel={<CircuitSummary editor={editor} simulation={simulation} />}
      />
    </main>
  );
}
