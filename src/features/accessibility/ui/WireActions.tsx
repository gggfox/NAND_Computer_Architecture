import type { ReactNode } from "react";

import type { WireEntry } from "~/features/circuit-editor";

export interface WireActionsProps {
  readonly wire: WireEntry;
}

/** A placeholder. The wire actions task replaces this file. */
export function WireActions(props: WireActionsProps): ReactNode {
  void props;
  return undefined;
}
