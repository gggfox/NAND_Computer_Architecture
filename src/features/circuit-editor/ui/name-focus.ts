import type { PinId } from "~/shared/ids";

/** Moves focus between the Pins panel's name fields, which register as they mount. */
export interface NameFocus {
  readonly register: (pinId: PinId, field: HTMLInputElement | null) => void;
  /** Focuses the pin's name field with its text selected. */
  readonly focus: (pinId: PinId) => void;
  /** The same, once a closing menu or dialog has given focus back to its opener. */
  readonly focusSoon: (pinId: PinId) => void;
  /** Leaves the name field for its row, which arrow keys then move from. */
  readonly leave: (pinId: PinId) => void;
}

export const createNameFocus = (): NameFocus => {
  const fields = new Map<PinId, HTMLInputElement>();
  const focus = (pinId: PinId): void => {
    const field = fields.get(pinId);
    field?.focus();
    field?.select();
  };
  return {
    register: (pinId, field) => {
      if (field === null) {
        fields.delete(pinId);
      } else {
        fields.set(pinId, field);
      }
    },
    focus,
    focusSoon: (pinId) => {
      // Two frames: the overlay unmounts, then restores focus to its trigger; this comes after.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          focus(pinId);
        });
      });
    },
    leave: (pinId) => {
      fields.get(pinId)?.closest<HTMLElement>('[role="row"]')?.focus();
    },
  };
};
