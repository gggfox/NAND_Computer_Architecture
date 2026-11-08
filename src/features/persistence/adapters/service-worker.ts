/*
 * Update strategy (ADR 7): a new service worker waits instead of taking over, because route code
 * and the engine worker are lazy chunks and taking over deletes the old precache, which breaks a
 * long-lived tab's next chunk request. The app offers "Update ready - reload"; applying it tells
 * the waiting worker to skip waiting, and every tab it then takes over writes pending edits and
 * reloads once, so no tab keeps running code whose chunks are gone.
 */

/** The message Workbox's generated worker listens for when `skipWaiting` is off. */
export const SKIP_WAITING = { type: "SKIP_WAITING" } as const;

/** The parts of the DOM service worker types this module uses; small enough to fake in tests. */
interface WorkerHandle {
  readonly state: string;
  readonly postMessage: (message: unknown) => void;
  readonly addEventListener: (type: "statechange", listener: () => void) => void;
}

export interface WorkerRegistration {
  readonly waiting?: WorkerHandle | null | undefined;
  readonly installing?: WorkerHandle | null | undefined;
  readonly addEventListener: (type: "updatefound", listener: () => void) => void;
}

export interface WorkerContainer {
  readonly controller: unknown;
  readonly addEventListener: (type: "controllerchange", listener: () => void) => void;
}

export interface UpdateHooks {
  /** A new version is installed and waiting; call `apply` when the user agrees to reload. */
  readonly onUpdateReady: (apply: () => void) => void;
  /** Writes pending edits before the page reloads. */
  readonly beforeReload: () => Promise<void>;
  readonly reload: () => void;
}

const offerWaiting = (registration: WorkerRegistration, hooks: UpdateHooks): void => {
  const { waiting } = registration;
  if (waiting !== null && waiting !== undefined) {
    hooks.onUpdateReady(() => {
      // oxlint-disable-next-line unicorn/require-post-message-target-origin -- ServiceWorker.postMessage has no targetOrigin
      waiting.postMessage(SKIP_WAITING);
    });
  }
};

const reloadAfterFlush = async (hooks: UpdateHooks): Promise<void> => {
  try {
    await hooks.beforeReload();
  } finally {
    hooks.reload();
  }
};

/**
 * Wires update detection and the reload on takeover. A page that had no controller is on its
 * first install: it is already running the newest code, so neither an offer nor a reload applies.
 */
export const watchForUpdates = (
  container: WorkerContainer,
  registration: WorkerRegistration,
  hooks: UpdateHooks,
): void => {
  /*
   * A page with no controller is on its first install. It already runs the newest code, so the
   * first claim needs no reload and no offer. The page is controlled after that claim, so a later
   * update in the same tab gets the banner and the reload like any other tab.
   */
  let controlled = container.controller !== null && container.controller !== undefined;
  if (controlled) {
    offerWaiting(registration, hooks);
  }
  registration.addEventListener("updatefound", () => {
    const { installing } = registration;
    installing?.addEventListener("statechange", () => {
      if (installing.state === "installed" && controlled) {
        offerWaiting(registration, hooks);
      }
    });
  });
  let reloading = false;
  container.addEventListener("controllerchange", () => {
    if (!controlled) {
      controlled = true;
      return;
    }
    if (reloading) {
      return;
    }
    reloading = true;
    void reloadAfterFlush(hooks);
  });
};

/** Registers the offline service worker (ADR 7) and watches for updates. Production only; never rejects. */
export const registerServiceWorker = async (hooks: UpdateHooks): Promise<boolean> => {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    return false;
  }
  try {
    const container = navigator.serviceWorker;
    const registration = await container.register("/sw.js", { scope: "/" });
    watchForUpdates(container, registration, hooks);
    return true;
  } catch {
    return false;
  }
};
