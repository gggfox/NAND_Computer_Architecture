import type { ReactNode } from "react";
import { useStore } from "zustand";

import { piece } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import { Button } from "~/shared/ui";

import type { EditorSession } from "../application/editor-session";
import { openCircuit } from "../application/editor-store";
import { freeNandPosition } from "../domain/geometry";
import { CompactLabel } from "./CompactLabel";
import { RedoIcon, UndoIcon } from "./icons";

const undoIcon = <UndoIcon />;
const redoIcon = <RedoIcon />;

/** Undo and Redo; icons only on a narrow screen. */
export function HistoryButtons({ session }: { readonly session: EditorSession }): ReactNode {
  const { editor } = session;
  const canUndo = useStore(editor, (state) => state.history.past.length > 0);
  const canRedo = useStore(editor, (state) => state.history.future.length > 0);
  return (
    <>
      <Button
        isDisabled={!canUndo}
        onPress={() => {
          editor.getState().undo();
        }}
        variant="quiet"
      >
        <CompactLabel label={m.undo()} short={undoIcon} />
      </Button>
      <Button
        isDisabled={!canRedo}
        onPress={() => {
          editor.getState().redo();
        }}
        variant="quiet"
      >
        <CompactLabel label={m.redo()} short={redoIcon} />
      </Button>
    </>
  );
}

/** Places a NAND gate on a free spot of the open circuit. */
export function AddNandButton({ session }: { readonly session: EditorSession }): ReactNode {
  const handleAddNand = (): void => {
    const state = session.editor.getState();
    const position = freeNandPosition({
      project: state.history.present,
      circuit: openCircuit(state),
    });
    state.dispatch({
      type: "placeChip",
      chipId: state.chipId,
      instance: piece({ type: "nand" }, position),
    });
  };
  return (
    <Button onPress={handleAddNand}>
      <CompactLabel label={m.add_nand()} short={m.add_nand_short()} />
    </Button>
  );
}
