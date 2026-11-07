import type { ReactNode } from "react";

import type { PartEntry } from "~/features/circuit-editor";

export interface PartActionsProps {
  readonly part: PartEntry;
}

/** A placeholder. The part actions task replaces this file. */
export function PartActions(props: PartActionsProps): ReactNode {
  void props;
  return undefined;
}
