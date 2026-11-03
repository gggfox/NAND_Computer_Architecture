import type { PinRef, Point } from "~/features/projects";
import type { WireId } from "~/shared/ids";

/** A proposed wire and the route a real one would take. Never stored in the circuit. */
export interface Ghost {
  readonly from: PinRef;
  readonly to: PinRef;
  readonly route: readonly Point[];
}

export interface Suggestions {
  readonly ghosts: readonly Ghost[];
  /** The ghost `n` focused, by index; `Enter` accepts it. */
  readonly focus?: number;
  /** The wires the last accept dispatched; the history step keeps the ghosts only for them (D10). */
  readonly accepting?: readonly WireId[];
}

export type SuggestCommand =
  | { readonly type: "suggestWires" | "acceptAllGhosts" | "dismissGhosts" }
  | { readonly type: "acceptGhost"; readonly index?: number }
  | { readonly type: "nextGhost"; readonly backwards: boolean };

export type SuggestAnnouncement =
  | { readonly type: "suggested"; readonly count: number }
  | { readonly type: "accepted"; readonly count: number }
  | { readonly type: "dismissed" }
  | {
      readonly type: "ghostFocused";
      readonly index: number;
      readonly count: number;
      readonly ghost: Ghost;
    };
