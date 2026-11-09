import type { ReactNode } from "react";

import { m } from "~/i18n/paraglide/messages";
import { PopoverButton } from "~/shared/ui";

import type { EditorSession } from "../application/editor-session";
import { ZoomButtons } from "./CanvasControls";
import { MagnifierIcon } from "./icons";

import styles from "./ZoomCorner.module.css";

/**
 * The zoom controls in the canvas's top-right corner on a narrow screen, where the toolbar has no
 * room for them. A pinch zooms too.
 */
export function ZoomCorner({ session }: { readonly session: EditorSession }): ReactNode {
  return (
    <div className={styles.corner}>
      <PopoverButton label={m.zoom_controls()} icon={<MagnifierIcon />} placement="bottom end">
        <ZoomButtons session={session} />
      </PopoverButton>
    </div>
  );
}
