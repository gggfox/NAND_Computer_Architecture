/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { ProjectRepository } from "~/features/persistence";
import type { Point, Project } from "~/features/projects";

import type { Camera } from "../domain/camera";
import type { Size } from "../domain/chip-layout";
import type { Tool } from "../domain/interaction";
import { createEditorStore } from "./editor-store";
import type { EditorStore } from "./editor-store";
import { createInteractionStore } from "./interaction-store";
import type { InteractionHandle } from "./interaction-store";
import { createSimulationStore } from "./simulation-bridge";
import type { ClockControls, SimulationStore } from "./simulation-bridge";
import { createViewSync } from "./view-sync";
import type { ViewSync } from "./view-sync";

/** The canvas's size and where it sits in the window, in CSS pixels. */
type ViewportBox = Size & { readonly left: number; readonly top: number };

export interface EditorSession {
  readonly editor: EditorStore;
  readonly simulation: SimulationStore;
  /** Clock play/pause/step/speed; a no-op until the engine worker is connected. */
  readonly clock: ClockControls;
  /** Selection, camera, tool and overlays on the canvas (spec §5.3). */
  readonly interaction: InteractionHandle;
  /** The mounted canvas tells the session how to read its box; returns the detach. */
  readonly attachViewport: (read: () => ViewportBox) => () => void;
  /** A window (client) point in canvas pixels; `undefined` when it is not over the canvas. */
  readonly clientToCanvas: (client: Point) => Point | undefined;
}

/** Where the editor's camera comes from and goes to: the URL (ADR 16). */
export interface ViewLink {
  readonly camera: Camera;
  /** Writes a settled camera to the URL, replacing the history entry. */
  readonly write: (camera: Camera) => void;
}

const NO_BOX: ViewportBox = { width: 0, height: 0, left: 0, top: 0 };

/** `client` relative to the box's top-left corner, when it is inside the box. */
const inBox = (box: ViewportBox, client: Point): Point | undefined => {
  const local = { x: client.x - box.left, y: client.y - box.top };
  const inside = local.x >= 0 && local.y >= 0 && local.x < box.width && local.y < box.height;
  return inside ? local : undefined;
};

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

export interface SessionParts {
  readonly session: EditorSession;
  readonly relay: ClockRelay;
  readonly sync: ViewSync;
  /** Points camera writes at the latest `write` (the route's navigate changes identity). */
  readonly setWrite: (write: ViewLink["write"]) => void;
}

/** The open project's stores, wired together; nothing here touches the DOM or the worker. */
export const createEditorSession = (
  project: Project,
  repo: ProjectRepository,
  [view, tool]: readonly [ViewLink, Tool],
): SessionParts => {
  const relay = createClockRelay();
  const editor = createEditorStore(project, repo);
  const target = { write: view.write };
  const sync = createViewSync((camera) => {
    target.write(camera);
  });
  const viewport: { read: () => ViewportBox } = { read: () => NO_BOX };
  const interaction = createInteractionStore({
    editor,
    camera: view.camera,
    tool,
    viewport: () => viewport.read(),
    view: sync,
  });
  const session: EditorSession = {
    editor,
    simulation: createSimulationStore(),
    clock: relay.clock,
    interaction,
    attachViewport: (read) => {
      viewport.read = read;
      return () => {
        viewport.read = () => NO_BOX;
      };
    },
    clientToCanvas: (client) => inBox(viewport.read(), client),
  };
  return {
    session,
    relay,
    sync,
    setWrite: (write) => {
      target.write = write;
    },
  };
};
