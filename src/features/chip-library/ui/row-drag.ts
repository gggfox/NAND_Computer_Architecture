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
  /**
   * On phones: true once a drag leaves the sheet it began in (the sheet hides for the rest of the
   * drag, uncovering the canvas), false when the drag ends.
   */
  readonly onTuck: (isTucked: boolean) => void;
  /** A drop placed a part on the canvas: on phones the sheet closes. */
  readonly onPlaced: () => void;
}

const isInside = (box: DOMRect, client: Point): boolean =>
  client.x >= box.left && client.x <= box.right && client.y >= box.top && client.y <= box.bottom;

/** Where a drag is: its pointer, and the box of the sheet it began in (none on wide screens). */
interface DragPoint {
  readonly client: Point;
  readonly sheet: DOMRect | undefined;
}

const isOverSheet = ({ client, sheet }: DragPoint): boolean =>
  sheet !== undefined && isInside(sheet, client);

/**
 * The folder row under the pointer (`data-drop-folder`, "" for the top level); else, off the
 * sheet, the canvas; else nothing.
 */
const targetAt = (session: EditorSession, point: DragPoint): DropTarget => {
  const { client } = point;
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
  return isOverSheet(point) || session.clientToCanvas(client) === undefined
    ? { type: "none" }
    : { type: "canvas" };
};

const actionAt = (session: EditorSession, item: DragItem, point: DragPoint) =>
  dropAction(session.editor.getState().history.present, item, targetAt(session, point));

/** Applies a drop; whether it placed a part on the canvas. */
const drop = (session: EditorSession, item: DragItem, point: DragPoint): boolean => {
  const action = actionAt(session, item, point);
  if (action.type === "place") {
    return placeAtClient(session, action.kind, point.client);
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
  /** The box of the sheet the row is in, as the press began; none on wide screens. */
  readonly sheet: DOMRect | undefined;
  readonly ghost: StoreApi<GhostState>;
}

const showGhost = (press: Press, point: DragPoint): void => {
  const { node } = press.item;
  press.ghost.setState(
    {
      ghost: {
        name: node.type === "builtins" ? "" : node.name,
        color: node.type === "chip" ? node.color : undefined,
        isRefused: actionAt(press.options.session, press.drag, point).type === "refuse",
        at: point.client,
      },
    },
    true,
  );
};

const endDrag = (press: Press, point: DragPoint, isDrop: boolean): void => {
  const { options } = press;
  const isPlaced = isDrop && drop(options.session, press.drag, point);
  options.onTuck(false);
  if (isPlaced) {
    options.onPlaced();
  } else {
    restoreFocus(press.row);
  }
};

interface DragHandlers extends PressHandlers {
  /** The press was cut short (the tree unmounted, or a new press began): undo the drag's tuck. */
  readonly onAbort: () => void;
}

/** `onSettled` hears when the press ends, and whether the row's own press must be ignored. */
const handlersFor = (press: Press, onSettled: (isSwallowed: boolean) => void): DragHandlers => {
  let isDragging = false;
  let isTucked = false;
  /** Once tucked, the sheet no longer covers anything: the whole canvas takes the drop. */
  const pointAt = (client: Point): DragPoint => ({
    client,
    sheet: isTucked ? undefined : press.sheet,
  });
  /*
   * The sheet stays in view while the pointer is over its box, so its folder rows take drops. Once
   * the pointer leaves it, the sheet tucks away for the rest of the drag, uncovering the canvas.
   */
  const follow = (client: Point): void => {
    if (!isTucked && press.sheet !== undefined && !isOverSheet(pointAt(client))) {
      isTucked = true;
      press.options.onTuck(true);
    }
    showGhost(press, pointAt(client));
  };
  return {
    onAbort: () => {
      press.ghost.setState({}, true);
      if (isDragging) {
        isDragging = false;
        press.options.onTuck(false);
      }
    },
    onDragStart: (client) => {
      isDragging = true;
      follow(client);
    },
    onDragMove: follow,
    onEnd: (outcome, client) => {
      press.ghost.setState({}, true);
      if (outcome === "menu") {
        press.options.onMenu(press.item);
      }
      if (isDragging) {
        endDrag(press, pointAt(client), outcome === "drop");
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
  /** Stops following the press, with no outcome; a drag on is undone (ghost gone, sheet back). */
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
    const sheet = row?.closest("[data-sheet]")?.getBoundingClientRect();
    const handlers = handlersFor({ options, item, drag, row, sheet, ghost }, onSettled);
    const untrack = trackPress(event, handlers);
    stopPress = (): void => {
      untrack();
      handlers.onAbort();
    };
  };
  return {
    ghost,
    start,
    takesAction: () => performance.now() >= swallowUntil,
    isPressing: () => stopPress !== NOT_PRESSING,
    stop,
  };
};
