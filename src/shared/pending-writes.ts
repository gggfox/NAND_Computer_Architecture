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

/** Runs every registered flush and resolves once all of them have settled. */
export const flushPendingWrites = async (): Promise<void> => {
  await Promise.allSettled([...flushes].map((flush) => flush()));
};
