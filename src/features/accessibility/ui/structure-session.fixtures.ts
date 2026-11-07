/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { createEditorSession } from "~/features/circuit-editor";
import type { EditorSession } from "~/features/circuit-editor";
import { createMemoryProjectRepository } from "~/features/persistence";
import { createDemoProject } from "~/features/projects";
import type { Project } from "~/features/projects";

const noWrite = (): void => {
  // Camera writes to the URL are not under test.
};

/** A real editor session on an in-memory repository, for tests of the structure view menus. */
export const createTestSession = (project: Project = createDemoProject("test")): EditorSession =>
  createEditorSession(project, createMemoryProjectRepository(), [
    { camera: { zoom: 1, x: 0, y: 0 }, write: noWrite },
    "select",
  ]).session;
