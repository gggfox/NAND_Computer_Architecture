import { useEffect, useState } from "react";

import type { ProjectRepository } from "~/features/persistence";
import type { Project } from "~/features/projects";
import { createEngineClient } from "~/features/simulation";
import { registerPendingWrite } from "~/shared/pending-writes";

import { createEditorStore } from "../application/editor-store";
import type { EditorStore } from "../application/editor-store";
import { connectSimulation, createSimulationStore } from "../application/simulation-bridge";
import type { ClockControls, SimulationStore } from "../application/simulation-bridge";

export interface EditorSession {
  readonly editor: EditorStore;
  readonly simulation: SimulationStore;
  /** Clock play/pause/step/speed; a no-op until the engine worker is connected. */
  readonly clock: ClockControls;
}

const noop = (): void => {
  // No worker is connected (pre-render, or after unmount).
};
const DISCONNECTED: ClockControls = { play: noop, pause: noop, step: noop, setSpeed: noop };

interface ClockRelay {
  /** Stable controls that forward to the attached connection, or do nothing. */
  readonly clock: ClockControls;
  /** Forwards to `controls` until the returned function detaches them. */
  readonly attach: (controls: ClockControls) => () => void;
}

const createClockRelay = (): ClockRelay => {
  let target = DISCONNECTED;
  return {
    clock: {
      play: () => {
        target.play();
      },
      pause: () => {
        target.pause();
      },
      step: () => {
        target.step();
      },
      setSpeed: (stepsPerSecond) => {
        target.setSpeed(stepsPerSecond);
      },
    },
    attach: (controls) => {
      target = controls;
      return () => {
        target = DISCONNECTED;
      };
    },
  };
};

/**
 * Creates the open project's stores once per mount (remount with a `key` to open another
 * project) and keeps an engine worker connected while mounted. The worker is browser-only, so it
 * is started in an effect, never during render or pre-rendering. A pending autosave is flushed on
 * unmount and on `pagehide` (tab close, browser reload). In-app reloads (locale switch, app update)
 * await it through the pending-writes registry, because a `pagehide` write may not commit.
 */
export const useEditorSession = (project: Project, repo: ProjectRepository): EditorSession => {
  // oxlint-disable-next-line react/hook-use-state -- created once and never replaced, so there is no setter to name
  const [{ session, relay }] = useState(() => {
    const clockRelay = createClockRelay();
    const stores: EditorSession = {
      editor: createEditorStore(project, repo),
      simulation: createSimulationStore(),
      clock: clockRelay.clock,
    };
    return { session: stores, relay: clockRelay };
  });

  useEffect(() => {
    const client = createEngineClient();
    const connection = connectSimulation(session.editor, session.simulation, client);
    const detachClock = relay.attach(connection.clock);
    const flushSave = (): void => {
      void session.editor.getState().flush();
    };
    globalThis.addEventListener("pagehide", flushSave);
    const unregister = registerPendingWrite(() => session.editor.getState().flush());
    return () => {
      unregister();
      globalThis.removeEventListener("pagehide", flushSave);
      flushSave();
      detachClock();
      connection.disconnect();
      client.dispose();
    };
  }, [session, relay]);

  return session;
};
