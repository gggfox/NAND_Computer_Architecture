import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";

import { placeAtClient } from "~/features/circuit-editor";
import type { EditorSession } from "~/features/circuit-editor";
import type { Point } from "~/features/projects";

import { dragItemOf, dropAction } from "../domain/drop-target";
import type { DragItem, DropTarget } from "../domain/drop-target";
import type { LibraryItem } from "./library-view";
import { trackPress } from "./track-press";
import type { PressHandlers } from "./track-press";

/** How long after a menu or a drop the row's own press (RAC's click) is ignored. */
const SWALLOW_MS = 500;

/** What the ghost shows while a row is dragged. */
export interface Ghost {
  readonly name: string;
  /** A chip's colour square; folders and parts have none. */
  readonly color: string | undefined;
  /** Whether the target under the pointer would refuse the drop. */
  readonly isRefused: boolean;
  /** The pointer, in window pixels. */
  readonly at: Point;
}

/** The ghost while a row is dragged; nothing otherwise. */
export interface GhostState {
  readonly ghost?: Ghost;
}

export interface RowDragOptions {
  readonly session: EditorSession;
  /** A long-press held still: open the row's menu (D5). */
  readonly onMenu: (item: LibraryItem) => void;
  /** A drag began (true) or ended (false): on phones the sheet tucks away meanwhile. */
  readonly onTuck: (isTucked: boolean) => void;
  /** A drop placed a part on the canvas: on phones the sheet closes. */
  readonly onPlaced: () => void;
}

/** The folder row under `client` (`data-drop-folder`, "" for the top level), else the canvas. */
const targetAt = (session: EditorSession, client: Point): DropTarget => {
  const row = document
    .elementFromPoint(client.x, client.y)
    ?.closest<HTMLElement>("[data-drop-folder]")?.dataset["dropFolder"];
  if (row === "") {
    return { type: "folder" };
  }
  if (row !== undefined) {
    const folder = session.editor.getState().history.present.folders.find(({ id }) => id === row);
    return folder === undefined ? { type: "none" } : { type: "folder", folderId: folder.id };
  }
  // The open sheet makes the page inert, so the canvas is found by its box, not by hit-testing.
  return session.clientToCanvas(client) === undefined ? { type: "none" } : { type: "canvas" };
};

const actionAt = (session: EditorSession, item: DragItem, client: Point) =>
  dropAction(session.editor.getState().history.present, item, targetAt(session, client));

/** Applies a drop; whether it placed a part on the canvas. */
const drop = (session: EditorSession, item: DragItem, client: Point): boolean => {
  const action = actionAt(session, item, client);
  if (action.type === "place") {
    return placeAtClient(session, action.kind, client);
  }
  if (action.type === "dispatch") {
    session.editor.getState().dispatch(action.action);
  }
  return false;
};

/** Hiding the tucked sheet can drop focus to the page; it goes back to the row. */
const restoreFocus = (row: HTMLElement | undefined): void => {
  requestAnimationFrame(() => {
    if (document.activeElement === null || document.activeElement === document.body) {
      row?.focus({ preventScroll: true });
    }
  });
};

interface Press {
  readonly options: RowDragOptions;
  readonly item: LibraryItem;
  readonly drag: DragItem;
  readonly row: HTMLElement | undefined;
  readonly ghost: StoreApi<GhostState>;
}

const showGhost = (press: Press, client: Point): void => {
  const { node } = press.item;
  press.ghost.setState(
    {
      ghost: {
        name: node.type === "builtins" ? "" : node.name,
        color: node.type === "chip" ? node.color : undefined,
        isRefused: actionAt(press.options.session, press.drag, client).type === "refuse",
        at: client,
      },
    },
    true,
  );
};

const endDrag = (press: Press, client: Point, isDrop: boolean): void => {
  const { options } = press;
  const isPlaced = isDrop && drop(options.session, press.drag, client);
  options.onTuck(false);
  if (isPlaced) {
    options.onPlaced();
  } else {
    restoreFocus(press.row);
  }
};

/** `onSettled` hears when the press ends, and whether the row's own press must be ignored. */
const handlersFor = (press: Press, onSettled: (isSwallowed: boolean) => void): PressHandlers => {
  let isDragging = false;
  return {
    onDragStart: (client) => {
      isDragging = true;
      press.options.onTuck(true);
      showGhost(press, client);
    },
    onDragMove: (client) => {
      showGhost(press, client);
    },
    onEnd: (outcome, client) => {
      press.ghost.setState({}, true);
      if (outcome === "menu") {
        press.options.onMenu(press.item);
      }
      if (isDragging) {
        endDrag(press, client, outcome === "drop");
      }
      onSettled(outcome === "menu" || outcome === "drop");
    },
  };
};

export interface RowDrag {
  /** The ghost, while a row is dragged. */
  readonly ghost: StoreApi<GhostState>;
  /** Follows a press on a row from its `pointerdown`. */
  readonly start: (item: LibraryItem, event: PointerEvent, options: RowDragOptions) => void;
  /** False just after a release that opened a menu or ended a drag: that release is not a tap. */
  readonly takesAction: () => boolean;
  /** Whether a press on a row is being followed. */
  readonly isPressing: () => boolean;
  /** Stops following the press, with no outcome. */
  readonly stop: () => void;
}

const NOT_PRESSING = (): void => {
  // No press is followed.
};

/** The tree row a press began on. */
const rowOf = (target: EventTarget | null): HTMLElement | undefined =>
  target instanceof Element
    ? (target.closest<HTMLElement>('[role="row"]') ?? undefined)
    : undefined;

const isOnButton = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest("button") !== null;

/**
 * Drags library rows (D1): a mouse after `MOUSE_THRESHOLD`, a finger after a long-press; a
 * long-press held still opens the row's menu. A drop on the canvas places the part there; one on a
 * folder row files the chip or moves the folder; anything refused changes nothing.
 */
export const createRowDrag = (): RowDrag => {
  const ghost = createStore<GhostState>(() => ({}));
  let stopPress = NOT_PRESSING;
  let swallowUntil = 0;
  const stop = (): void => {
    stopPress();
    stopPress = NOT_PRESSING;
  };
  const onSettled = (isSwallowed: boolean): void => {
    stopPress = NOT_PRESSING;
    swallowUntil = isSwallowed ? performance.now() + SWALLOW_MS : 0;
  };
  const start = (item: LibraryItem, event: PointerEvent, options: RowDragOptions): void => {
    const drag = dragItemOf(item.node);
    if (event.button !== 0 || isOnButton(event.target) || drag === undefined) {
      return;
    }
    stop();
    swallowUntil = 0;
    const row = rowOf(event.target);
    stopPress = trackPress(event, handlersFor({ options, item, drag, row, ghost }, onSettled));
  };
  return {
    ghost,
    start,
    takesAction: () => performance.now() >= swallowUntil,
    isPressing: () => stopPress !== NOT_PRESSING,
    stop,
  };
};
