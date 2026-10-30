import { useSyncExternalStore } from "react";

import { getAppProjectRepository } from "../adapters/fallback-repository";

const serverSnapshot = (): boolean => false;

/**
 * True while the app repository keeps work in memory only (IndexedDB unreachable, or a save that
 * has not reached it yet). Re-renders the moment that changes, including mid-session.
 */
export const useStorageDegraded = (): boolean => {
  const repo = getAppProjectRepository();
  return useSyncExternalStore(repo.subscribe, repo.isDegraded, serverSnapshot);
};
