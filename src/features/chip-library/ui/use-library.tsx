import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useStore } from "zustand";

import { cancelPlacement, usePlacing } from "~/features/circuit-editor";
import type { CanvasMenuContext, EditorSession } from "~/features/circuit-editor";
import { m } from "~/i18n/paraglide/messages";
import { Button, useMediaQuery } from "~/shared/ui";

import { isStalePlacement } from "../domain/placement";
import { LibraryPanel } from "./LibraryPanel";

/** The layout's own breakpoint: from here the library is a column beside the canvas. */
const WIDE = "(min-width: 640px)";

/** Cancels an armed chip once it can't be placed: deleted, or the open chip would contain it. */
const useStalePlacementGuard = (session: EditorSession): void => {
  const placing = usePlacing(session);
  const isStale = useStore(session.editor, (state) =>
    isStalePlacement(state.history.present, state.chipId, placing),
  );
  useEffect(() => {
    if (isStale) {
      cancelPlacement(session);
    }
  }, [isStale, session]);
};

export interface Library {
  /** The toolbar's "Library" button, which opens and closes the panel. */
  readonly toggle: ReactNode;
  /** `EditorLayout`'s `library` slot. */
  readonly panel: ReactNode;
  /** The canvas's quick-add menu (Task 11); nothing yet. */
  readonly quickAdd: (context: CanvasMenuContext) => ReactNode;
}

const noQuickAdd = (): ReactNode => undefined;

/** The chip library for one editor session. It starts closed on every width (D14). */
export const useLibrary = (session: EditorSession): Library => {
  const [isOpen, setIsOpen] = useState(false);
  const isWide = useMediaQuery(WIDE);
  useStalePlacementGuard(session);
  const toggle = (
    <Button
      variant="quiet"
      aria-expanded={isOpen}
      onPress={() => {
        setIsOpen(!isOpen);
      }}
    >
      {m.library_button()}
    </Button>
  );
  const panel = (
    <LibraryPanel
      session={session}
      isOpen={isOpen}
      isWide={isWide}
      onClose={() => {
        setIsOpen(false);
      }}
    />
  );
  return { toggle, panel, quickAdd: noQuickAdd };
};
