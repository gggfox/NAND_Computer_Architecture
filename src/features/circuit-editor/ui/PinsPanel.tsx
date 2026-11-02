import { useState } from "react";
import type { ReactNode } from "react";

import { m } from "~/i18n/paraglide/messages";
import { Button, Sheet, useMediaQuery } from "~/shared/ui";

import type { EditorSession } from "../application/editor-session";
import { PinsBody } from "./PinsBody";
import { usePinCount } from "./use-pins";

import styles from "./PinsPanel.module.css";

/** The layout's own breakpoint: from here the panel sits beside the canvas. */
const WIDE = "(min-width: 640px)";

interface PinsPanelProps {
  readonly session: EditorSession;
}

/**
 * The chip's pins (spec §5): beside the canvas from 640 px, open by default and folded by its
 * "Pins N" button; on phones that button opens them in a sheet.
 */
export function PinsPanel({ session }: PinsPanelProps): ReactNode {
  const isWide = useMediaQuery(WIDE);
  const [expanded, setExpanded] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const heading = m.pins_heading({ count: usePinCount(session) });
  const close = (): void => {
    setSheetOpen(false);
  };
  const toggle = (): void => {
    if (isWide) {
      setExpanded(!expanded);
    } else {
      setSheetOpen(true);
    }
  };
  const body = <PinsBody session={session} />;
  const inline = expanded ? body : undefined;
  return (
    <section className={styles.panel}>
      <h2 className={styles.heading}>
        <Button variant="quiet" aria-expanded={isWide ? expanded : sheetOpen} onPress={toggle}>
          {heading}
        </Button>
      </h2>
      {isWide ? (
        inline
      ) : (
        <Sheet title={heading} isOpen={sheetOpen} onClose={close}>
          {body}
        </Sheet>
      )}
    </section>
  );
}
