import { useMemo } from "react";

import type { EditorSession } from "../application/editor-session";
import { rowAfter, rowNear } from "../domain/pin-rows";
import { createNameFocus } from "./name-focus";
import type { NameFocus } from "./name-focus";
import { pinCommands } from "./pin-commands";
import type { RowActions } from "./PinRow";
import type { PinsView } from "./use-pins";

/** The rows' callbacks: Enter goes on to the next name, and a deleted row's neighbour takes focus. */
export const useRowActions = (
  session: EditorSession,
  view: PinsView,
): { readonly actions: RowActions; readonly focus: NameFocus } => {
  const focus = useMemo(() => createNameFocus(), []);
  const commands = pinCommands(session);
  const actions: RowActions = {
    commands,
    registerName: focus.register,
    onNameDone: (pinId) => {
      const next = rowAfter(view.rows, pinId);
      if (next === undefined) {
        focus.leave(pinId);
      } else {
        focus.focus(next.pinId);
      }
    },
    onDelete: (pinId) => {
      const near = rowNear(view.rows, pinId);
      commands.remove(pinId);
      if (near !== undefined) {
        focus.focusSoon(near.pinId);
      }
    },
    onSetInput: (pinId, value) => {
      session.editor.getState().setInput(pinId, value);
    },
  };
  return { actions, focus };
};
