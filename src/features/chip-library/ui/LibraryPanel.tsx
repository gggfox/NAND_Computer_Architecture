import { useId, useState } from "react";
import type { ReactNode } from "react";

import type { EditorSession } from "~/features/circuit-editor";
import { m } from "~/i18n/paraglide/messages";
import { Sheet } from "~/shared/ui";

import type { LibraryFilter } from "../domain/library-search";
import { NO_EXPANSION } from "./library-view";
import { LibraryBody } from "./LibraryBody";

import styles from "./LibraryPanel.module.css";

const NO_FILTER: LibraryFilter = { query: "", starred: false, tags: new Set() };

const noop = (): void => {
  // On wide screens the column stays open while a part is armed or a chip opened.
};

interface LibraryPanelProps {
  readonly session: EditorSession;
  readonly isOpen: boolean;
  readonly isWide: boolean;
  readonly onClose: () => void;
}

/**
 * The chip library (spec §3.2): New chip and New folder, search, filters and the folder tree. A
 * column left of the canvas from 640 px, a sheet on phones. It stays mounted while closed, so the
 * search and open folders are as the user left them.
 */
export function LibraryPanel({ session, isOpen, isWide, onClose }: LibraryPanelProps): ReactNode {
  const [filter, setFilter] = useState(NO_FILTER);
  const [expansion, setExpansion] = useState(NO_EXPANSION);
  const [isTucked, setIsTucked] = useState(false);
  const headingId = useId();
  /*
   * On phones the sheet gets out of the canvas's way once a part is armed or a chip opened, and
   * tucks away (still mounted, so the drag goes on) once a row drag leaves it for the canvas.
   */
  const body = (
    <LibraryBody
      session={session}
      state={{ filter: [filter, setFilter], expansion: [expansion, setExpansion] }}
      onOutOfTheWay={isWide ? noop : onClose}
      onTuck={setIsTucked}
    />
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
    <Sheet title={m.library_heading()} isOpen={isOpen} onClose={onClose} isTucked={isTucked}>
      {body}
    </Sheet>
  );
}
