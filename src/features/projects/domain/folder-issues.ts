interface FolderLink {
  readonly id: string;
  readonly parentId?: string | undefined;
}

interface FolderIssue {
  readonly path: readonly (string | number)[];
  readonly message: string;
}

/** Walks up the parents; true when a folder is met twice before the top. */
const inCycle = (startId: string, parentOf: (id: string) => string | undefined): boolean => {
  const seen = new Set<string>();
  let current: string | undefined = startId;
  while (current !== undefined) {
    if (seen.has(current)) {
      return true;
    }
    seen.add(current);
    current = parentOf(current);
  }
  return false;
};

/** Folder ids are unique, every parent names a folder, and parents never loop. */
export const folderIssues = (folders: readonly FolderLink[]): readonly FolderIssue[] => {
  const parents = new Map(folders.map((folder) => [folder.id, folder.parentId] as const));
  const seen = new Set<string>();
  return folders.flatMap((folder, index): readonly FolderIssue[] => {
    const path = ["folders", index];
    if (seen.has(folder.id)) {
      return [{ path, message: "folder ids must be unique" }];
    }
    seen.add(folder.id);
    if (folder.parentId !== undefined && !parents.has(folder.parentId)) {
      return [{ path, message: "folder parent names no folder" }];
    }
    return inCycle(folder.id, (id) => parents.get(id))
      ? [{ path, message: "folder parents form a cycle" }]
      : [];
  });
};
