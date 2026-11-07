/* oxlint-disable import/max-dependencies -- the route wires the editor, the library, storage and the import flow together */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import type { ReactNode } from "react";

import { CircuitSummary } from "~/features/accessibility";
import { useLibrary } from "~/features/chip-library";
import {
  cameraForUrl,
  ChipHeader,
  CircuitCanvas,
  EditorLayout,
  EditorPreferences,
  EditorSearchSchema,
  EditorToolbar,
  PinsPanel,
  startingChipId,
  useEditorSession,
  useSessionErrors,
} from "~/features/circuit-editor";
import type { Camera, EditorSearch, EditorSession } from "~/features/circuit-editor";
import {
  getAppProjectRepository,
  persistenceErrorMessage,
  useStorageDegraded,
} from "~/features/persistence";
import type { PersistenceError } from "~/features/persistence";
import type { Project } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import { ProjectIdSchema } from "~/shared/ids";
import { StatusMessages } from "~/shared/ui";

import { ImportConflictDialog, importFailureMessage, useImport } from "./-import";
import type { ImportFailure } from "./-import";

export const Route = createFileRoute("/projects/$projectId")({
  validateSearch: EditorSearchSchema,
  // Data lives in this browser's IndexedDB, so the loader and component only ever run on the client.
  ssr: false,
  loader: async ({ params }) => {
    const parsed = ProjectIdSchema.safeParse(params.projectId);
    if (!parsed.success) {
      return { kind: "invalid-id" } as const;
    }
    const loaded = await getAppProjectRepository().load(parsed.data);
    // Editor key: changes only when the loader really runs (route entered or import invalidated).
    const token = crypto.randomUUID();
    return { kind: "loaded", loaded, token } as const;
  },
  /*
   * The open project lives in the editor store, not in loader data. Reload only when the route is
   * entered (or invalidated by an import); search-only and back/forward navigations within the
   * route keep the mounted editor, its undo history and input levels. Search is not a loader dep.
   */
  staleTime: Number.POSITIVE_INFINITY,
  /*
   * Keep nothing once the route is left. A cached match would mount the previous project while the
   * reload runs; the editor's mount-time `?chip=` correction would then navigate, cancel that
   * reload, and leave the stale project (without the latest edits) open.
   */
  gcTime: 0,
  shouldReload: ({ cause }) => cause === "enter",
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

/** Shown wherever work could be lost: the editor and the "not found" page of a memory-only session. */
function useDegradedNotice(): readonly string[] {
  return useStorageDegraded() ? [m.persistence_error_unavailable()] : [];
}

function NotFound(): ReactNode {
  const notices = useDegradedNotice();
  return (
    <main className="page">
      <h1>{m.project_not_found_title()}</h1>
      <StatusMessages messages={notices} />
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
    return <Editor key={data.token} project={loaded.value} />;
  }
  return loaded.error.type === "NotFound" ? <NotFound /> : <Corrupt error={loaded.error} />;
}

function useNotices(session: EditorSession, failure: ImportFailure | undefined): readonly string[] {
  const degradedNotice = useDegradedNotice();
  const sessionErrors = useSessionErrors(session);
  return [
    ...degradedNotice,
    ...sessionErrors,
    ...(failure === undefined ? [] : [importFailureMessage(failure)]),
  ];
}

/**
 * The editor session, linked to the URL (ADR 16): the camera, and the chip being edited. Opening
 * another chip (from the library, or after a delete) writes it. On load the URL's chip is opened
 * when the project has it; otherwise the last opened chip is, and the URL is corrected.
 */
function useLinkedSession(project: Project, view: EditorSearch): EditorSession {
  const navigate = Route.useNavigate();
  const startingChip = startingChipId(project, view.chip);
  const write = (camera: Camera): void => {
    void navigate({
      search: (previous) => ({ ...previous, ...cameraForUrl(camera) }),
      replace: true,
    });
  };
  const session = useEditorSession(
    { ...project, lastOpenedChipId: startingChip },
    getAppProjectRepository(),
    { camera: view, write },
  );
  // A missing, unknown or malformed `?chip=` is corrected once, on mount (D8).
  useEffect(() => {
    if (view.chip !== startingChip) {
      void navigate({ search: (search) => ({ ...search, chip: startingChip }), replace: true });
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- mount only; later chip changes are written by the subscription below
  }, []);
  useEffect(
    () =>
      session.editor.subscribe((state, previous) => {
        if (state.chipId !== previous.chipId) {
          void navigate({ search: (search) => ({ ...search, chip: state.chipId }), replace: true });
        }
      }),
    [session, navigate],
  );
  return session;
}

interface EditorProps {
  readonly project: Project;
}

function Editor({ project }: EditorProps): ReactNode {
  const view = Route.useSearch();
  const session = useLinkedSession(project, view);
  const { failure, conflict, onImport, onResolve } = useImport(project.id, session.editor);
  const notices = useNotices(session, failure);
  const library = useLibrary(session);

  const header = (
    <ChipHeader
      session={session}
      firstSave={library.firstSave}
      start={<BackLink />}
      end={<EditorPreferences />}
    />
  );
  const panel = (
    <>
      <PinsPanel session={session} />
      <CircuitSummary session={session} />
    </>
  );
  return (
    <main>
      <h1 className="visually-hidden">{project.name}</h1>
      <EditorLayout
        toolbar={<EditorToolbar session={session} onImport={onImport} leading={library.toggle} />}
        header={header}
        status={<StatusMessages messages={notices} />}
        canvas={<CircuitCanvas session={session} view={view} canvasMenu={library.quickAdd} />}
        panel={panel}
        library={library.panel}
      />
      <ImportConflictDialog project={conflict} onResolve={onResolve} />
    </main>
  );
}
