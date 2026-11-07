type Flush = () => Promise<void>;

const flushes = new Set<Flush>();

/**
 * Registers work that must finish before the app reloads itself (language switch, app update).
 * A `pagehide` flush is fire-and-forget and may not commit; an in-app reload can wait instead.
 * Returns the unregister function.
 */
export const registerPendingWrite = (flush: Flush): (() => void) => {
  flushes.add(flush);
  return () => {
    flushes.delete(flush);
  };
};

/** The longest wait for the flushes. A stuck flush must not block a reload or a language switch. */
export const FLUSH_TIMEOUT_MS = 2000;

/** Runs every registered flush and resolves once all of them settle, or after `FLUSH_TIMEOUT_MS`. */
export const flushPendingWrites = async (): Promise<void> => {
  let id: ReturnType<typeof setTimeout> | undefined = undefined;
  // oxlint-disable-next-line promise/avoid-new -- a timer has no promise API in the browser
  const timeout = new Promise<void>((resolve) => {
    id = setTimeout(resolve, FLUSH_TIMEOUT_MS);
  });
  try {
    await Promise.race([Promise.allSettled([...flushes].map((flush) => flush())), timeout]);
  } finally {
    clearTimeout(id);
  }
};
