import type { ReactNode } from "react";

/*
 * Small line icons for the compact toolbar and the zoom corner. Each one is decoration: the
 * control around it keeps a text name.
 */

function Icon({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** A magnifying glass: a ring and its handle. */
export function MagnifierIcon(): ReactNode {
  return (
    <Icon>
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="M12.5 12.5 17 17" />
    </Icon>
  );
}

/** An arrow that turns back to the left. */
export function UndoIcon(): ReactNode {
  return (
    <Icon>
      <path d="M7 4 3 8l4 4" />
      <path d="M3 8h9a5 5 0 0 1 0 10H9" />
    </Icon>
  );
}

/** An arrow that turns forward to the right. */
export function RedoIcon(): ReactNode {
  return (
    <Icon>
      <path d="m13 4 4 4-4 4" />
      <path d="M17 8H8a5 5 0 0 0 0 10h3" />
    </Icon>
  );
}

/** Four arrows from the centre: move the view. */
export function PanIcon(): ReactNode {
  return (
    <Icon>
      <path d="M10 2v16M2 10h16" />
      <path d="m7 5 3-3 3 3M7 15l3 3 3-3M5 7l-3 3 3 3M15 7l3 3-3 3" />
    </Icon>
  );
}

/** A mouse pointer: select. */
export function SelectIcon(): ReactNode {
  return (
    <Icon>
      <path d="M4 3v13l4-4 3 6 2-1-3-6h6Z" />
    </Icon>
  );
}
