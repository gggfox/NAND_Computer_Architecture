import { useCallback, useEffect } from "react";
import type { RefCallback } from "react";

import type { Focusable } from "~/shared/focus-return";

type Candidate = Focusable | null | undefined;

/** The registry key of the "Suggest wires" button: focus goes there when no suggestion is left. */
export const SUGGEST_KEY = "suggest-wires";

/** The buttons that rows own, by key, so a caller can focus a row that is not yet on screen. */
const buttons = new Map<string, HTMLElement>();
/** The places to focus if the row with this key goes away. */
const plans = new Map<string, readonly Candidate[]>();

const MENU_ATTRIBUTE = "data-row-menu";
const MENU_SELECTOR = `[${MENU_ATTRIBUTE}]`;
/** Frames to wait for a new row to appear. */
const MAX_FRAMES = 20;
/** How long a removal plan stays valid. */
const PLAN_MS = 1000;

/** Runs `task` after React Aria has put back its own focus, which also needs a frame. */
const afterFrame = (task: () => void): void => {
  requestAnimationFrame(() => {
    requestAnimationFrame(task);
  });
};

/** Focuses the first candidate that is still in the page. */
export const focusFirst = (candidates: readonly Candidate[]): void => {
  candidates.find((item) => item?.isConnected === true)?.focus({ preventScroll: true });
};

/**
 * The button of the next row, of the previous row, and then the end target: the `lastKey`
 * button, or the heading of the list.
 */
const fallbacksOf = (button: HTMLElement, lastKey: string | undefined): readonly Candidate[] => {
  const row = button.closest("li");
  const heading = row?.parentElement?.previousElementSibling;
  return [
    row?.nextElementSibling?.querySelector<HTMLElement>(MENU_SELECTOR),
    row?.previousElementSibling?.querySelector<HTMLElement>(MENU_SELECTOR),
    lastKey === undefined ? undefined : buttons.get(lastKey),
    heading instanceof HTMLElement ? heading : undefined,
  ];
};

/**
 * Moves focus to the row with this key as soon as its button exists. A part that was just
 * added needs a render first, so this waits some frames.
 */
export const focusRowWhenReady = (key: string): void => {
  let frames = 0;
  const attempt = (): void => {
    const button = buttons.get(key);
    if (button?.isConnected === true) {
      button.focus({ preventScroll: true });
    } else if (frames < MAX_FRAMES) {
      frames += 1;
      requestAnimationFrame(attempt);
    }
  };
  requestAnimationFrame(attempt);
};

export interface RowFocus {
  /** Put this on the row's button. */
  readonly register: RefCallback<HTMLButtonElement>;
  /** Call it after a dialog from this row closes. Focus goes to the row's button. */
  readonly returnFocus: () => void;
  /**
   * Call it before an action that can remove the row. If the row goes, focus moves to the next
   * row's button, then to the previous one, then to the list heading.
   */
  readonly prepareRemoval: () => void;
  /** The row's button, so that another feature can name it as a focus target. */
  readonly element: () => HTMLElement | undefined;
}

/**
 * Focus rules for one row with a button (spec 3.6). The row gives a `key`, so other code can
 * focus the row with `focusRowWhenReady`. `lastKey` names the button that gets focus when no row
 * is left, before the heading.
 */
export function useRowFocus(key: string, lastKey?: string): RowFocus {
  const register = useCallback<RefCallback<HTMLButtonElement>>(
    (element) => {
      if (element === null) {
        buttons.delete(key);
      } else {
        element.setAttribute(MENU_ATTRIBUTE, "");
        buttons.set(key, element);
      }
    },
    [key],
  );
  useEffect(
    () => () => {
      const plan = plans.get(key);
      plans.delete(key);
      if (plan !== undefined) {
        afterFrame(() => {
          focusFirst(plan);
        });
      }
    },
    [key],
  );
  return {
    register,
    returnFocus: () => {
      afterFrame(() => {
        focusFirst([buttons.get(key)]);
      });
    },
    prepareRemoval: () => {
      const button = buttons.get(key);
      if (button === undefined) {
        return;
      }
      const plan = fallbacksOf(button, lastKey);
      plans.set(key, plan);
      setTimeout(() => {
        if (plans.get(key) === plan) {
          plans.delete(key);
        }
      }, PLAN_MS);
    },
    element: () => buttons.get(key),
  };
}
