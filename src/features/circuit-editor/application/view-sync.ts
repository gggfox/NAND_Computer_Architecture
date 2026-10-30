import type { Camera } from "../domain/camera";

const DEFAULT_DELAY_MS = 200;

export interface ViewSync {
  /** The live camera moved; it is written once the movement pauses. */
  readonly changed: (camera: Camera) => void;
  /** A gesture ended: write the latest camera now. No-op when nothing is pending. */
  readonly settle: () => void;
  /** Drops anything pending without writing it. */
  readonly dispose: () => void;
}

/**
 * Keeps the URL's camera (ADR 16) in step with the live one without writing on every frame:
 * a burst of changes is written once, after `delayMs` of quiet or when the gesture settles.
 * The caller's `write` should replace the history entry, so back/forward are not flooded.
 */
export const createViewSync = (
  write: (camera: Camera) => void,
  delayMs = DEFAULT_DELAY_MS,
): ViewSync => {
  let pending: Camera | undefined = undefined;
  let timer: ReturnType<typeof setTimeout> | undefined = undefined;
  const settle = (): void => {
    clearTimeout(timer);
    const camera = pending;
    pending = undefined;
    if (camera !== undefined) {
      write(camera);
    }
  };
  return {
    changed: (camera) => {
      pending = camera;
      clearTimeout(timer);
      timer = setTimeout(settle, delayMs);
    },
    settle,
    dispose: () => {
      clearTimeout(timer);
      pending = undefined;
    },
  };
};
