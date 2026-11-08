type HideTarget = Pick<EventTarget, "addEventListener" | "removeEventListener">;
type VisibilityTarget = HideTarget & { readonly visibilityState: string };

/**
 * Calls `flush` when the page hides. `visibilitychange` to `hidden` fires before `pagehide` and
 * is reliable on mobile, so it saves an edit made less than one debounce period earlier.
 * `pagehide` stays as a second trigger. Returns a function that removes both listeners.
 */
export const flushOnHide = (
  flush: () => void,
  win: HideTarget = globalThis,
  doc: VisibilityTarget = document,
): (() => void) => {
  const onVisibility = (): void => {
    if (doc.visibilityState === "hidden") {
      flush();
    }
  };
  win.addEventListener("pagehide", flush);
  doc.addEventListener("visibilitychange", onVisibility);
  return () => {
    win.removeEventListener("pagehide", flush);
    doc.removeEventListener("visibilitychange", onVisibility);
  };
};
