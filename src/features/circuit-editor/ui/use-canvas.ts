/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { useEffect, useRef } from "react";
import type { KeyboardEvent, RefObject } from "react";
import { useStore } from "zustand";

import { createCanvasRenderer } from "../adapters/canvas-renderer";
import { createMinimap } from "../adapters/minimap-renderer";
import { attachPointerInput } from "../adapters/pointer-input";
import type { EditorSession } from "../application/editor-session";
import { announcementText } from "../domain/announcements";
import { cameraForUrl } from "../domain/camera";
import type { Camera } from "../domain/camera";
import { commandForKey } from "../domain/keymap";
import { minimapStateOf, renderStateOf } from "./render-state-of";

const EVERY_OTHER = 2;

/** The host ref is always set after mount; this only satisfies the effect's return type. */
const noCleanup = (): void => {
  // Nothing was started.
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
  const detachViewport = session.attachViewport(() => {
    const { left, top } = canvas.getBoundingClientRect();
    return { width: canvas.clientWidth, height: canvas.clientHeight, left, top };
  });
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

/** The canvas command for a key; `Enter` reads whether a pin is armed, `F2` the focused chip. */
const commandFor = (session: EditorSession, event: KeyboardEvent<HTMLElement>) => {
  const { armed, focus } = session.interaction.store.getState();
  return commandForKey(
    {
      key: event.key,
      shift: event.shiftKey,
      ctrlOrMeta: event.ctrlKey || event.metaKey,
      alt: event.altKey,
    },
    { armed: armed !== undefined, focus },
  );
};

/**
 * The host's keyboard map. Only keys aimed at the host itself drive it: the overlays render inside
 * the host, and their keystrokes must stay theirs. Space is tracked here, because the host, not
 * the canvas, has keyboard focus.
 */
const useKeyMap = (session: EditorSession, spaceRef: RefObject<boolean>) => {
  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    // Keys typed in an overlay (menu, dialogs, help) bubble here through React's portals.
    if (event.target !== event.currentTarget) {
      return;
    }
    if (event.key === " ") {
      spaceRef.current = true;
      event.preventDefault();
      return;
    }
    const command = commandFor(session, event);
    if (command !== undefined) {
      event.preventDefault();
      session.interaction.store.getState().send({ type: "command", command });
    }
  };
  // Not limited to the host: releasing Space anywhere ends the pan, so it can never stick.
  const onKeyUp = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === " ") {
      spaceRef.current = false;
    }
  };
  const onBlur = (): void => {
    spaceRef.current = false;
  };
  return { onKeyDown, onKeyUp, onBlur };
};

/** The canvas's renderer, input and keyboard map for the component's life. */
export const useCanvas = (session: EditorSession) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const spaceRef = useRef(false);
  const keyMap = useKeyMap(session, spaceRef);

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

  return { canvasRef, minimapRef, ...keyMap };
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
