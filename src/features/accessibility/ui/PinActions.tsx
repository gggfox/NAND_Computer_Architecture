import type { ReactNode } from "react";

import type { PinEntry } from "~/features/circuit-editor";

export interface PinActionsProps {
  readonly pin: PinEntry;
}

/** A placeholder. The pin actions task replaces this file. */
export function PinActions(props: PinActionsProps): ReactNode {
  void props;
  return undefined;
}
