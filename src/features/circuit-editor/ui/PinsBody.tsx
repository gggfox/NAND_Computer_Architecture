import { useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";

import type { PinDirection } from "~/features/projects";
import { m } from "~/i18n/paraglide/messages";
import { Button } from "~/shared/ui";

import type { EditorSession } from "../application/editor-session";
import { AddPinsDialog } from "./AddPinsDialog";
import { PinsList } from "./PinsList";
import { usePins } from "./use-pins";
import { useRowActions } from "./use-row-actions";

import styles from "./PinsPanel.module.css";

interface ToolbarProps {
  readonly isEmpty: boolean;
  readonly onAdd: (direction: PinDirection) => void;
  readonly onTidy: () => void;
  /** "Add inputs…", which takes focus when the last pin is deleted. */
  readonly addRef: RefObject<HTMLButtonElement | null>;
}

function Toolbar({ isEmpty, onAdd, onTidy, addRef }: Readonly<ToolbarProps>): ReactNode {
  return (
    <div className={styles.toolbar}>
      <Button
        ref={addRef}
        variant="quiet"
        onPress={() => {
          onAdd("input");
        }}
      >
        {m.pins_add_inputs()}
      </Button>
      <Button
        variant="quiet"
        onPress={() => {
          onAdd("output");
        }}
      >
        {m.pins_add_outputs()}
      </Button>
      <Button variant="quiet" isDisabled={isEmpty} onPress={onTidy}>
        {m.pins_tidy()}
      </Button>
    </div>
  );
}

/** The panel's contents: Add and Tidy, the lists, and the Add dialog while it is open. */
export function PinsBody({ session }: { readonly session: EditorSession }): ReactNode {
  const view = usePins(session);
  const addRef = useRef<HTMLButtonElement>(null);
  const { actions, focus } = useRowActions(session, view, addRef);
  const [adding, setAdding] = useState<PinDirection>();
  const { inputs, outputs } = view.rows;
  const { tidy } = actions.commands;
  return (
    <div className={styles.body}>
      <Toolbar
        isEmpty={inputs.length + outputs.length === 0}
        onAdd={setAdding}
        onTidy={tidy}
        addRef={addRef}
      />
      <PinsList view={view} actions={actions} />
      {adding === undefined ? undefined : (
        <AddPinsDialog
          direction={adding}
          onClose={() => {
            setAdding(undefined);
          }}
          onAdd={(request) => {
            setAdding(undefined);
            const first = actions.commands.add(request);
            if (first !== undefined) {
              focus.focusSoon(first);
            }
          }}
        />
      )}
    </div>
  );
}
