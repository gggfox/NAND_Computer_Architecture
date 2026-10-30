import { useEffect, useState } from "react";

import type { ProjectRepository } from "~/features/persistence";
import type { Project } from "~/features/projects";
import { createEngineClient } from "~/features/simulation";
import { registerPendingWrite } from "~/shared/pending-writes";

import { createEditorStore } from "../application/editor-store";
import type { EditorStore } from "../application/editor-store";
import { connectSimulation, createSimulationStore } from "../application/simulation-bridge";
import type { SimulationStore } from "../application/simulation-bridge";

export interface EditorSession {
  readonly editor: EditorStore;
  readonly simulation: SimulationStore;
}

/**
 * Creates the open project's stores once per mount (remount with a `key` to open another
 * project) and keeps an engine worker connected while mounted. The worker is browser-only, so it
 * is started in an effect, never during render or pre-rendering. A pending autosave is flushed on
 * unmount and on `pagehide` (tab close, browser reload). In-app reloads (locale switch, app update)
 * await it through the pending-writes registry, because a `pagehide` write may not commit.
 */
export const useEditorSession = (project: Project, repo: ProjectRepository): EditorSession => {
  // oxlint-disable-next-line react/hook-use-state -- created once and never replaced, so there is no setter to name
  const [session] = useState<EditorSession>(() => ({
    editor: createEditorStore(project, repo),
    simulation: createSimulationStore(),
  }));

  useEffect(() => {
    const client = createEngineClient();
    const disconnect = connectSimulation(session.editor, session.simulation, client);
    const flushSave = (): void => {
      void session.editor.getState().flush();
    };
    globalThis.addEventListener("pagehide", flushSave);
    const unregister = registerPendingWrite(() => session.editor.getState().flush());
    return () => {
      unregister();
      globalThis.removeEventListener("pagehide", flushSave);
      flushSave();
      disconnect();
      client.dispose();
    };
  }, [session]);

  return session;
};
