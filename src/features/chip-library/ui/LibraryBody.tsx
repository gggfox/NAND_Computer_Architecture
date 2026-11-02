import type { ReactNode } from "react";
import { useStore } from "zustand";

import { cancelPlacement, usePlacing } from "~/features/circuit-editor";
import type { EditorSession } from "~/features/circuit-editor";
import { EscapeScope } from "~/shared/ui";

import type { LibraryFilter } from "../domain/library-search";
import { libraryView } from "./library-view";
import type { Expansion } from "./library-view";
import { LibraryActions, useLibraryDialogs } from "./LibraryActions";
import { LibrarySearch } from "./LibrarySearch";
import { LibraryTree } from "./LibraryTree";

import styles from "./LibraryPanel.module.css";

type State<Value> = readonly [Value, (value: Value) => void];

interface LibraryBodyProps {
  readonly session: EditorSession;
  /** The search and open folders, kept by the panel so they outlive a closed column. */
  readonly state: {
    readonly filter: State<LibraryFilter>;
    readonly expansion: State<Expansion>;
  };
  /** A part was armed, dropped on the canvas or a chip opened: on phones the sheet closes. */
  readonly onOutOfTheWay: () => void;
  /** A row drag began (true) or ended (false): on phones the sheet tucks away meanwhile. */
  readonly onTuck: (isTucked: boolean) => void;
}

/** What the library panel holds, and the dialogs its buttons and row menus open. */
export function LibraryBody({
  session,
  state,
  onOutOfTheWay,
  onTuck,
}: LibraryBodyProps): ReactNode {
  const project = useStore(session.editor, (editor) => editor.history.present);
  const openChipId = useStore(session.editor, (editor) => editor.chipId);
  const [filter, setFilter] = state.filter;
  const [expansion, setExpansion] = state.expansion;
  const view = libraryView({ project, openChipId }, filter, expansion);
  const dialogs = useLibraryDialogs(session, onOutOfTheWay);
  const placing = usePlacing(session);
  return (
    // Escape anywhere in the library stops a placement (D6), as it does on the canvas.
    <EscapeScope
      className={styles.body}
      onEscape={
        placing === undefined
          ? undefined
          : () => {
              cancelPlacement(session);
            }
      }
    >
      <LibraryActions
        onOpen={(dialog) => {
          dialogs.open(dialog);
        }}
      />
      <LibrarySearch filter={filter} onChange={setFilter} tags={view.tags} />
      <LibraryTree
        session={session}
        view={view}
        onExpand={setExpansion}
        onArmed={onOutOfTheWay}
        onTuck={onTuck}
        onCommand={(node, command) => {
          dialogs.onCommand(node, command);
        }}
      />
      {dialogs.view}
    </EscapeScope>
  );
}
