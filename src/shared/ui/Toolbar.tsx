import type { ReactNode } from "react";
import { Toolbar as AriaToolbar } from "react-aria-components";

import styles from "./Toolbar.module.css";

interface ToolbarProps {
  readonly children: ReactNode;
  readonly "aria-label": string;
  readonly orientation?: "horizontal" | "vertical" | undefined;
}

export function Toolbar({
  children,
  "aria-label": ariaLabel,
  orientation = "horizontal",
}: Readonly<ToolbarProps>): ReactNode {
  return (
    <AriaToolbar className={styles.toolbar} aria-label={ariaLabel} orientation={orientation}>
      {children}
    </AriaToolbar>
  );
}
