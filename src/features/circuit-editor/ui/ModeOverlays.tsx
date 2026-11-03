import type { ReactNode } from "react";
import { useStore } from "zustand";

import type { EditorSession } from "../application/editor-session";
import type { InteractionCommand } from "../domain/interaction";
import { ArrayDialog } from "./ArrayDialog";
import { KeyboardHelp } from "./KeyboardHelp";
import { SelectionBar } from "./SelectionBar";

const sendCommand = (session: EditorSession, command: InteractionCommand): void => {
  session.interaction.store.getState().send({ type: "command", command });
};

/** The selection bar, and the keyboard help and Array dialogs, which the interaction state opens. */
export function ModeOverlays({ session }: { readonly session: EditorSession }): ReactNode {
  const help = useStore(session.interaction.store, (state) => state.help);
  const arraying = useStore(session.interaction.store, (state) => state.arraying);
  return (
    <>
      <SelectionBar session={session} />
      {arraying === true ? (
        <ArrayDialog
          onArray={(request) => {
            sendCommand(session, { type: "array", request });
          }}
          onClose={() => {
            sendCommand(session, { type: "hideArray" });
          }}
        />
      ) : undefined}
      {help === true ? (
        <KeyboardHelp
          onClose={() => {
            sendCommand(session, { type: "hideHelp" });
          }}
        />
      ) : undefined}
    </>
  );
}
