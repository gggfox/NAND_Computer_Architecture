import { useSyncExternalStore } from "react";

/**
 * Whether `query` matches now, kept current as the viewport changes. It reads the real answer on
 * the first client render; with no `window` (a pre-render) it is false.
 */
export const useMediaQuery = (query: string): boolean =>
  useSyncExternalStore(
    (changed) => {
      const list = globalThis.matchMedia(query);
      list.addEventListener("change", changed);
      return () => {
        list.removeEventListener("change", changed);
      };
    },
    () => globalThis.matchMedia(query).matches,
    () => false,
  );
