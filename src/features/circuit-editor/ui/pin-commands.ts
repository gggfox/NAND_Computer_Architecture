import type { BitWidth } from "~/features/projects";
import type { InstanceId, PinId } from "~/shared/ids";

import type { EditorSession } from "../application/editor-session";
import { openCircuit } from "../application/editor-store";
import type { EditorAction } from "../domain/actions";
import { editorErrorMessage } from "../domain/editor-error-messages";
import { newPins } from "../domain/pin-rows";
import type { PinsRequest } from "../domain/pin-rows";
import { tidyMoves } from "../domain/pin-tidy";

/** What the Pins panel can do; a failed edit shows in the status bar, a failed rename inline. */
export interface PinCommands {
  /** The pin's name as saved now, which a just-dispatched rename has already changed. */
  readonly nameOf: (pinId: PinId) => string | undefined;
  /** The error message when the name is refused. */
  readonly rename: (pinId: PinId, name: string) => string | undefined;
  readonly setWidth: (pinId: PinId, width: BitWidth) => void;
  /** `toIndex` counts within the pin's direction. */
  readonly move: (pinId: PinId, toIndex: number) => void;
  readonly remove: (pinId: PinId) => void;
  readonly select: (instanceIds: readonly InstanceId[]) => void;
  readonly tidy: () => void;
  /** The first new pin, when they were added. */
  readonly add: (request: PinsRequest) => PinId | undefined;
}

export const pinCommands = ({ editor, interaction }: EditorSession): PinCommands => {
  const dispatch = (action: EditorAction) => editor.getState().dispatch(action);
  const chipId = () => editor.getState().chipId;
  return {
    nameOf: (pinId) => openCircuit(editor.getState()).pins.find((pin) => pin.id === pinId)?.name,
    rename: (pinId, name) => {
      // Refused here, not by the edit, so the field alone says why (no status-bar error as well).
      if (name.trim() === "") {
        return editorErrorMessage({ type: "EmptyName" });
      }
      const result = dispatch({ type: "renamePin", chipId: chipId(), pinId, name });
      return result.ok ? undefined : editorErrorMessage(result.error);
    },
    setWidth: (pinId, width) => {
      dispatch({ type: "setPinWidth", chipId: chipId(), pinId, width });
    },
    move: (pinId, toIndex) => {
      dispatch({ type: "reorderPin", chipId: chipId(), pinId, toIndex });
    },
    remove: (pinId) => {
      dispatch({ type: "removePin", chipId: chipId(), pinId });
    },
    select: (instanceIds) => {
      interaction.store
        .getState()
        .send({ type: "command", command: { type: "selectPieces", instanceIds } });
    },
    tidy: () => {
      const moves = tidyMoves(interaction.sceneOf(editor.getState()));
      if (moves.length > 0) {
        dispatch({ type: "moveChips", chipId: chipId(), moves });
      }
    },
    add: (request) => {
      const pins = newPins(interaction.sceneOf(editor.getState()), request);
      const result = dispatch({ type: "addPins", chipId: chipId(), pins });
      return result.ok ? pins[0]?.pin.id : undefined;
    },
  };
};
