import { err } from "~/shared/result";
import type { Result } from "~/shared/result";

import type { ImportError } from "../domain/errors";
import { projectFileName } from "../domain/file-name";
import { MAX_IMPORT_BYTES, parseProjectFile, serializeProject } from "../domain/format";
import type { Project } from "../domain/model";

// DOM `File` and the mutable-by-shape `Project` can never be deeply readonly in a Web API signature.
/* oxlint-disable-next-line typescript/prefer-readonly-parameter-types */
export const readProjectFile = async (file: File): Promise<Result<Project, ImportError>> => {
  if (file.size > MAX_IMPORT_BYTES) {
    return err({ type: "TooLarge", bytes: file.size });
  }
  return parseProjectFile(await file.text());
};

const REVOKE_DELAY_MS = 60_000;

const downloadText = (text: string, fileName: string): void => {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  // Revoking synchronously can abort the download in Safari; give it time to start.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, REVOKE_DELAY_MS);
};

/* oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- branded ids are mutable object types; the value is never mutated */
export const downloadProjectFile = (project: Project): void => {
  downloadText(serializeProject(project), projectFileName(project.name));
};

/** Saves a stored record exactly as it is, so a damaged project can still be recovered by hand. */
export const downloadRawRecord = (raw: string, id: string): void => {
  downloadText(raw, projectFileName(`damaged-${id}`));
};
