import { useEffect, useState } from "react";

import type { ProjectRepository } from "~/features/persistence";
import type { Project } from "~/features/projects";
import { createEngineClient } from "~/features/simulation";
import { registerPendingWrite } from "~/shared/pending-writes";

import { createEditorSession } from "../application/editor-session";
import type { EditorSession, ViewLink } from "../application/editor-session";
import { connectSimulation } from "../application/simulation-bridge";
import type { Tool } from "../domain/interaction";
import { flushOnHide } from "./flush-on-hide";

/** A finger has no hover, so on a phone a drag on empty canvas pans by default. */
const defaultTool = (): Tool =>
  typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches ? "pan" : "select";

/**
 * Creates the open project's stores once per mount (remount with a `key` to open another
 * project) and keeps an engine worker connected while mounted. The worker is browser-only, so it
 * is started in an effect, never during render or pre-rendering. A pending autosave is flushed on
 * unmount, when the page becomes hidden, and on `pagehide` (tab close, browser reload). In-app reloads (locale switch, app update)
 * await it through the pending-writes registry, because a `pagehide` write may not commit.
 */
export const useEditorSession = (
  project: Project,
  repo: ProjectRepository,
  view: ViewLink,
): EditorSession => {
  // oxlint-disable-next-line react/hook-use-state -- created once and never replaced, so there is no setter to name
  const [{ session, relay, sync, setWrite }] = useState(() =>
    createEditorSession(project, repo, [view, defaultTool()]),
  );

  useEffect(() => {
    setWrite(view.write);
  }, [setWrite, view.write]);

  useEffect(() => {
    const disconnect = session.interaction.connect();
    return () => {
      disconnect();
      // Drop, never write, a pending camera: writing while leaving would navigate back here.
      sync.dispose();
    };
  }, [session, sync]);

  useEffect(() => {
    const client = createEngineClient();
    const connection = connectSimulation(session.editor, session.simulation, client);
    const detachClock = relay.attach(connection.clock);
    const flushSave = (): void => {
      void session.editor.getState().flush();
    };
    const stopHideFlush = flushOnHide(flushSave);
    const unregister = registerPendingWrite(() => session.editor.getState().flush());
    return () => {
      unregister();
      stopHideFlush();
      flushSave();
      detachClock();
      connection.disconnect();
      client.dispose();
    };
  }, [session, relay]);

  return session;
};
