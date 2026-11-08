import type { ReactNode } from "react";

import type { EditorSession, Structure } from "~/features/circuit-editor";
import { m } from "~/i18n/paraglide/messages";
import { Button } from "~/shared/ui";

import { AddPartMenu } from "./AddPartMenu";
import { OutputsReader } from "./OutputsReader";
import { useStructureSession } from "./structure-session";
import { SuggestedList } from "./SuggestedList";
import { SUGGEST_KEY, useRowFocus } from "./use-row-focus";

import styles from "./StructureView.module.css";

/** Sends one canvas command, as the toolbar and the keyboard do. */
const sendCommand = (session: EditorSession, type: "suggestWires" | "tidyWires"): void => {
  session.interaction.store.getState().send({ type: "command", command: { type } });
};

export interface StructureActionsProps {
  readonly structure: Structure;
}

/**
 * Add part, Suggest wires, Tidy wires and Read outputs, then the suggested wires while there are
 * any: the circuit-wide actions, above the Parts list.
 */
export function StructureActions({ structure }: StructureActionsProps): ReactNode {
  const session = useStructureSession();
  const { register } = useRowFocus(SUGGEST_KEY);
  return (
    <>
      <div className={styles.actions}>
        <AddPartMenu />
        <Button
          ref={register}
          onPress={() => {
            sendCommand(session, "suggestWires");
          }}
        >
          {m.suggest_wires()}
        </Button>
        <Button
          onPress={() => {
            sendCommand(session, "tidyWires");
          }}
        >
          {m.tidy_wires()}
        </Button>
        <OutputsReader session={session} />
      </div>
      <SuggestedList structure={structure} />
    </>
  );
}
