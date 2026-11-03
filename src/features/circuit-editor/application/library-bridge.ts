import { useStore } from "zustand";

import type { PinDirection, Point } from "~/features/projects";

import type { PlaceableKind } from "../domain/actions";
import type { InteractionCommand } from "../domain/interaction";
import type { EditorSession } from "./editor-session";

/*
 * What the chip library drives on the canvas (D2): armed placement, placing at a point and the
 * quick-add menu. Placement lives in interaction state, so arming is never an undo step (ADR 43);
 * each part placed is one.
 */

const send = (session: EditorSession, command: InteractionCommand): void => {
  session.interaction.store.getState().send({ type: "command", command });
};

/** Arms `kind`: every tap on the canvas places a copy until cancelled; the armed kind again cancels. */
export const armPlacement = (session: EditorSession, kind: PlaceableKind): void => {
  send(session, { type: "armPlacement", kind });
};

export const cancelPlacement = (session: EditorSession): void => {
  send(session, { type: "cancelPlacement" });
};

/** Places one `kind` at the centre of the canvas (keyboard and screen-reader placing). */
export const placeAtCentre = (session: EditorSession, kind: PlaceableKind): void => {
  send(session, { type: "placeAt", kind });
};

/** Places one `kind` at a window point (a drop); `false` when the point is not over the canvas. */
export const placeAtClient = (
  session: EditorSession,
  kind: PlaceableKind,
  client: Point,
): boolean => {
  const screen = session.clientToCanvas(client);
  if (screen === undefined) {
    return false;
  }
  send(session, { type: "placeAt", kind, screen });
  return true;
};

/** The armed kind, if any. */
export const usePlacing = (session: EditorSession): PlaceableKind | undefined =>
  useStore(session.interaction.store, (state) => state.placing);

/** The last kinds placed this session, newest first. */
export const useRecentPlacements = (session: EditorSession): readonly PlaceableKind[] =>
  useStore(session.interaction.store, (state) => state.recent);

/** What a `canvasMenu` slot gets: the menu's point and what it can do there. */
export interface CanvasMenuContext {
  /** Where the menu opened, in canvas pixels. */
  readonly screen: Point;
  readonly close: () => void;
  readonly tidyWires: () => void;
  /** Proposes wires as ghosts (D18). */
  readonly suggestWires: () => void;
  /** Places one `kind` at the menu's point. */
  readonly place: (kind: PlaceableKind) => void;
  /** Adds one pin of the open chip at the menu's point. */
  readonly addPin: (direction: PinDirection) => void;
}
