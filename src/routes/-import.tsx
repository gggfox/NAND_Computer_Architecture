import { useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import type { ReactNode } from "react";

import type { EditorSession } from "~/features/circuit-editor";
import { getAppProjectRepository, persistenceErrorMessage } from "~/features/persistence";
import type { PersistenceError } from "~/features/persistence";
import { copyProject, importErrorMessage, readProjectFile } from "~/features/projects";
import type { ImportError, Project } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import { Button, ModalDialog } from "~/shared/ui";

export type ImportFailure =
  | { readonly kind: "import"; readonly error: ImportError }
  | { readonly kind: "save"; readonly error: PersistenceError };

export const importFailureMessage = (failure: ImportFailure): string =>
  failure.kind === "import"
    ? importErrorMessage(failure.error)
    : persistenceErrorMessage(failure.error);

export type ConflictChoice = "replace" | "keep-both" | "cancel";

/** Whether a record with this id is already saved, even one that is damaged. */
const isSaved = async (id: Project["id"]): Promise<boolean> => {
  const existing = await getAppProjectRepository().load(id);
  return existing.ok || existing.error.type === "Corrupt";
};

/** Saves a project, then opens it (reloading the editor if it replaced the open project). */
function useSaveAndOpen(
  currentId: Project["id"],
  setFailure: (failure: ImportFailure | undefined) => void,
): (project: Project) => Promise<void> {
  const router = useRouter();
  const navigate = useNavigate();
  return async (project) => {
    const saved = await getAppProjectRepository().save(project);
    if (!saved.ok) {
      setFailure({ kind: "save", error: saved.error });
      return;
    }
    setFailure(undefined);
    if (project.id !== currentId) {
      await navigate({ to: "/projects/$projectId", params: { projectId: project.id } });
      return;
    }
    // The file replaces this project, so its own last-opened chip wins over the URL's (D8).
    await navigate({
      to: ".",
      search: (search) => ({ ...search, chip: undefined }),
      replace: true,
    });
    await router.invalidate();
  };
}

interface UseImport {
  readonly failure: ImportFailure | undefined;
  /** The imported project that waits for a choice, because its id is already saved. */
  readonly conflict: Project | undefined;
  readonly onImport: (file: File) => void;
  readonly onResolve: (choice: ConflictChoice) => void;
}

/**
 * Reads and validates the file, then saves and opens it. A file whose id is already saved waits
 * for the person to choose: replace the saved project, or keep both (the file gets a new id).
 */
export function useImport(currentId: Project["id"], editor: EditorSession["editor"]): UseImport {
  const [failure, setFailure] = useState<ImportFailure>();
  const [conflict, setConflict] = useState<Project>();
  const saveAndOpen = useSaveAndOpen(currentId, setFailure);

  const importFile = async (file: File): Promise<void> => {
    const read = await readProjectFile(file);
    if (!read.ok) {
      setFailure({ kind: "import", error: read.error });
      return;
    }
    // Write any pending autosave first, so it cannot land after (and overwrite) the import.
    await editor.getState().flush();
    if (await isSaved(read.value.id)) {
      setConflict(read.value);
      return;
    }
    await saveAndOpen(read.value);
  };

  const resolve = async (choice: ConflictChoice): Promise<void> => {
    const pending = conflict;
    setConflict(undefined);
    if (pending === undefined || choice === "cancel") {
      return;
    }
    if (choice === "replace") {
      await saveAndOpen(pending);
      return;
    }
    const copy = copyProject(pending, m.import_copy_name({ name: pending.name }));
    if (copy.ok) {
      await saveAndOpen(copy.value);
    }
  };

  return {
    failure,
    conflict,
    onImport: (file) => {
      void importFile(file);
    },
    onResolve: (choice) => {
      void resolve(choice);
    },
  };
}

interface ImportConflictProps {
  readonly project: Project | undefined;
  readonly onResolve: (choice: ConflictChoice) => void;
}

/** Asks what to do with an imported file whose id is already saved. Nothing shows without one. */
export function ImportConflictDialog({ project, onResolve }: ImportConflictProps): ReactNode {
  if (project === undefined) {
    return undefined;
  }
  return (
    <ModalDialog
      title={m.import_conflict_title()}
      onClose={() => {
        onResolve("cancel");
      }}
    >
      <p>{m.import_conflict_body({ name: project.name })}</p>
      <Button
        onPress={() => {
          onResolve("replace");
        }}
      >
        {m.import_conflict_replace()}
      </Button>
      <Button
        variant="quiet"
        onPress={() => {
          onResolve("keep-both");
        }}
      >
        {m.import_conflict_keep_both()}
      </Button>
      <Button
        variant="quiet"
        onPress={() => {
          onResolve("cancel");
        }}
      >
        {m.import_conflict_cancel()}
      </Button>
    </ModalDialog>
  );
}
