import { useId, useState } from "react";
import type { ReactNode } from "react";
import { useStore } from "zustand";

import type { EditorSession } from "~/features/circuit-editor";
import { m } from "~/i18n/paraglide/messages";
import { Sheet } from "~/shared/ui";

import type { LibraryFilter } from "../domain/library-search";
import { libraryView, NO_EXPANSION } from "./library-view";
import { LibrarySearch } from "./LibrarySearch";
import { LibraryTree } from "./LibraryTree";

import styles from "./LibraryPanel.module.css";

const NO_FILTER: LibraryFilter = { query: "", starred: false, tags: new Set() };

const noop = (): void => {
  // On wide screens the column stays open while a part is armed.
};

interface LibraryPanelProps {
  readonly session: EditorSession;
  readonly isOpen: boolean;
  readonly isWide: boolean;
  readonly onClose: () => void;
}

/**
 * The chip library (spec §3.2): search, filters and the folder tree. A column left of the canvas
 * from 640 px, a sheet on phones. It stays mounted while closed, so the search and open folders
 * are as the user left them.
 */
export function LibraryPanel({ session, isOpen, isWide, onClose }: LibraryPanelProps): ReactNode {
  const project = useStore(session.editor, (state) => state.history.present);
  const openChipId = useStore(session.editor, (state) => state.chipId);
  const [filter, setFilter] = useState(NO_FILTER);
  const [expansion, setExpansion] = useState(NO_EXPANSION);
  const headingId = useId();
  const view = libraryView({ project, openChipId }, filter, expansion);
  const body = (
    <div className={styles.body}>
      <LibrarySearch filter={filter} onChange={setFilter} tags={view.tags} />
      <LibraryTree
        session={session}
        view={view}
        onExpand={setExpansion}
        onArmed={isWide ? noop : onClose}
      />
    </div>
  );
  if (isWide) {
    return isOpen ? (
      <section className={styles.panel} aria-labelledby={headingId}>
        <h2 id={headingId} className={styles.heading}>
          {m.library_heading()}
        </h2>
        {body}
      </section>
    ) : undefined;
  }
  return (
    <Sheet title={m.library_heading()} isOpen={isOpen} onClose={onClose}>
      {body}
    </Sheet>
  );
}
