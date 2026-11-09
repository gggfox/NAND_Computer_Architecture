import type { ReactNode } from "react";

import styles from "./CompactLabel.module.css";

interface CompactLabelProps {
  /** The full label: shown on a wide screen, and always the control's accessible name. */
  readonly label: string;
  /** What a narrow screen shows in its place, usually an icon; hidden from assistive technology. */
  readonly short: ReactNode;
}

/** A control's label that becomes `short` on a narrow screen, so the toolbar takes less room. */
export function CompactLabel({ label, short }: CompactLabelProps): ReactNode {
  return (
    <>
      <span className={styles.full}>{label}</span>
      <span className={styles.short} aria-hidden="true">
        {short}
      </span>
    </>
  );
}
