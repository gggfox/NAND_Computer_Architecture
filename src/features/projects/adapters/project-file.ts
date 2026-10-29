import { err } from "~/shared/result";
import type { Result } from "~/shared/result";

import type { ImportError } from "../domain/errors";
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

/* oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- branded ids are mutable object types; the value is never mutated */
export const downloadProjectFile = (project: Project): void => {
  const url = URL.createObjectURL(
    new Blob([serializeProject(project)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${project.name}.nand.json`;
  link.click();
  URL.revokeObjectURL(url);
};
