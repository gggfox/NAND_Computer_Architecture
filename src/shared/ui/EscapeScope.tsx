import type { ReactNode } from "react";
import { useKeyboard } from "react-aria";

interface EscapeScopeProps {
  /** Runs on Escape from anywhere inside; undefined lets Escape go on to the enclosing overlay. */
  readonly onEscape: (() => void) | undefined;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}

/**
 * A block that answers Escape pressed inside it. Keys a control handles itself (a search field
 * with text, an open menu) never reach it, and every other key goes on as usual.
 */
export function EscapeScope({ onEscape, className, children }: EscapeScopeProps): ReactNode {
  const { keyboardProps } = useKeyboard({
    onKeyDown: (event) => {
      if (event.key === "Escape" && onEscape !== undefined) {
        onEscape();
      } else {
        event.continuePropagation();
      }
    },
  });
  return (
    <div {...keyboardProps} className={className}>
      {children}
    </div>
  );
}
