/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import { useStore } from "zustand";

import { createCanvasRenderer } from "../adapters/canvas-renderer";
import type { RenderState } from "../adapters/canvas-renderer";
import { createMinimap } from "../adapters/minimap-renderer";
import type { MinimapState } from "../adapters/minimap-renderer";
import { attachPointerInput } from "../adapters/pointer-input";
import type { EditorSession } from "../application/editor-session";
import { announcementText } from "../domain/announcements";
import { cameraForUrl } from "../domain/camera";
import type { Camera } from "../domain/camera";
import { previewOf } from "../domain/interaction";
import { commandForKey } from "../domain/keymap";

const EVERY_OTHER = 2;

/** The host ref is always set after mount; this only satisfies the effect's return type. */
const noCleanup = (): void => {
  // Nothing was started.
};

/** Everything the renderer reads for one frame. */
const renderStateOf = (session: EditorSession): RenderState => {
  const { editor, simulation, interaction } = session;
  const editorState = editor.getState();
  const scene = interaction.sceneOf(editorState);
  const state = interaction.store.getState();
  const { outputs, levels } = simulation.getState();
  const marquee =
    state.drag?.kind === "marquee"
      ? { shape: state.drag.shape, points: state.drag.points }
      : undefined;
  return {
    project: scene.project,
    circuit: scene.circuit,
    inputs: editorState.inputs,
    outputs,
    levels,
    view: state.camera,
    overlay: {
      selection: state.selection,
      positions: previewOf(state, scene.circuit),
      ...(state.hover === undefined ? {} : { hover: state.hover }),
      ...(marquee === undefined ? {} : { marquee }),
    },
  };
};

/** What the minimap reads for one frame. */
const minimapStateOf = (session: EditorSession, canvas: HTMLCanvasElement): MinimapState => {
  const { editor, interaction } = session;
  const scene = interaction.sceneOf(editor.getState());
  const state = interaction.store.getState();
  return {
    project: scene.project,
    circuit: scene.circuit,
    layout: interaction.layout,
    positions: previewOf(state, scene.circuit),
    view: state.camera,
    viewport: { width: canvas.clientWidth, height: canvas.clientHeight },
    dragging: state.drag !== undefined,
  };
};

/** The renderer and the minimap, redrawn whenever the editor, simulation or interaction changes. */
const attachRenderer = (
  session: EditorSession,
  canvas: HTMLCanvasElement,
  minimapCanvas: HTMLCanvasElement,
): (() => void) => {
  const { interaction, editor, simulation } = session;
  const renderer = createCanvasRenderer(canvas, () => renderStateOf(session), interaction.layout);
  const minimap = createMinimap(minimapCanvas, {
    read: () => minimapStateOf(session, canvas),
    jump: (camera, settle) => {
      interaction.store
        .getState()
        .send({ type: "command", command: { type: "jumpTo", camera, settle } });
    },
  });
  renderer.start();
  minimap.start();
  const invalidate = (): void => {
    renderer.invalidate();
    minimap.invalidate();
  };
  const unsubscribes = [
    editor.subscribe(invalidate),
    simulation.subscribe(invalidate),
    interaction.store.subscribe(invalidate),
  ];
  return () => {
    for (const unsubscribe of unsubscribes) {
      unsubscribe();
    }
    minimap.stop();
    renderer.stop();
  };
};

/** Pointer, wheel and the viewport size, all feeding the interaction store. */
const attachInput = (
  session: EditorSession,
  canvas: HTMLCanvasElement,
  isSpaceDown: () => boolean,
): (() => void) => {
  const { send } = session.interaction.store.getState();
  const detachViewport = session.attachViewport(() => ({
    width: canvas.clientWidth,
    height: canvas.clientHeight,
  }));
  const detachPointer = attachPointerInput(canvas, {
    onGesture: (gesture) => {
      send({ type: "gesture", gesture });
    },
    onWheel: (command) => {
      send({ type: "command", command });
    },
    isSpaceDown,
  });
  return () => {
    detachPointer();
    detachViewport();
  };
};

/**
 * The canvas's renderer and input for the component's life. Space is tracked here, because the
 * host, not the canvas, has keyboard focus.
 */
export const useCanvas = (session: EditorSession) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const spaceRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const minimap = minimapRef.current;
    if (canvas === null || minimap === null) {
      return noCleanup;
    }
    const detachRenderer = attachRenderer(session, canvas, minimap);
    const detachInput = attachInput(session, canvas, () => spaceRef.current);
    return () => {
      detachInput();
      detachRenderer();
    };
  }, [session]);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === " ") {
      spaceRef.current = true;
      event.preventDefault();
      return;
    }
    const command = commandForKey({
      key: event.key,
      shift: event.shiftKey,
      ctrlOrMeta: event.ctrlKey || event.metaKey,
      alt: event.altKey,
    });
    if (command !== undefined) {
      event.preventDefault();
      session.interaction.store.getState().send({ type: "command", command });
    }
  };
  const onKeyUp = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === " ") {
      spaceRef.current = false;
    }
  };
  const onBlur = (): void => {
    spaceRef.current = false;
  };
  return { canvasRef, minimapRef, onKeyDown, onKeyUp, onBlur };
};

const sameCamera = (first: Camera, second: Camera): boolean =>
  first.zoom === second.zoom && first.x === second.x && first.y === second.y;

/**
 * Follows the URL's camera when it changes from outside (back/forward, an edited link). A camera
 * this canvas wrote itself rounds to the same URL, so its echo is ignored, and a drag in
 * progress is never yanked.
 */
export const useUrlCamera = (session: EditorSession, { zoom, x, y }: Camera): void => {
  useEffect(() => {
    const state = session.interaction.store.getState();
    const outside = { zoom, x, y };
    if (state.drag === undefined && !sameCamera(cameraForUrl(state.camera), outside)) {
      state.syncCamera(outside);
    }
  }, [session, zoom, x, y]);
};

/** What the live region says now; a repeat differs by a trailing no-break space, so it is re-read. */
export const useSpoken = (session: EditorSession): string => {
  const announcement = useStore(session.interaction.store, (state) => state.announcement);
  if (announcement === undefined) {
    return "";
  }
  const editor = session.editor.getState();
  const known = { ...editor, ...session.simulation.getState() };
  const text = announcementText(
    session.interaction.sceneOf(editor),
    known,
    announcement.announcement,
  );
  return announcement.id % EVERY_OTHER === 1 ? `${text}\u00A0` : text;
};
