/** Finds the focus target when it is needed, as the page can change before that. */
export interface FocusSource {
  readonly find: () => Focusable | undefined;
}

/** What a focus target needs: the page tells if it is still there, and it takes focus. */
export interface Focusable {
  readonly isConnected: boolean;
  readonly focus: (options?: Readonly<FocusOptions>) => void;
}

/**
 * Where focus goes when the next dialog closes. A caller outside the dialog owner sets it before
 * the dialog opens. The dialog owner takes it once, when the dialog closes.
 */
const state: { target?: FocusSource } = {};

/** Names the element that gets focus when the next dialog closes. */
export const setFocusReturn = (target: FocusSource): void => {
  state.target = target;
};

/** Returns the named element once, then forgets it. It returns nothing if the element is gone. */
export const takeFocusReturn = (): Focusable | undefined => {
  const element = state.target?.find();
  delete state.target;
  return element?.isConnected === true ? element : undefined;
};
