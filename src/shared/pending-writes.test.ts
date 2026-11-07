import { afterEach, describe, expect, it, vi } from "vitest";

import { FLUSH_TIMEOUT_MS, flushPendingWrites, registerPendingWrite } from "./pending-writes";

describe("pending writes", () => {
  it("awaits every registered flush", async () => {
    const order: string[] = [];
    const unregister = registerPendingWrite(async () => {
      await Promise.resolve();
      order.push("flushed");
    });
    await flushPendingWrites();
    order.push("after");
    expect(order).toEqual(["flushed", "after"]);
    unregister();
  });

  it("forgets a flush once unregistered", async () => {
    const flush = vi.fn<() => Promise<void>>(() => Promise.resolve());
    registerPendingWrite(flush)();
    await flushPendingWrites();
    expect(flush).not.toHaveBeenCalled();
  });

  it("resolves with nothing registered", async () => {
    await expect(flushPendingWrites()).resolves.toBeUndefined();
  });
});

const flushAndMark = (): { readonly pending: Promise<void>; readonly isDone: () => boolean } => {
  let done = false;
  const pending = (async (): Promise<void> => {
    await flushPendingWrites();
    done = true;
  })();
  return { pending, isDone: () => done };
};

describe("pending writes timeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves after the timeout when a flush never settles", async () => {
    vi.useFakeTimers();
    // oxlint-disable-next-line promise/avoid-new -- a flush that never settles
    const unregister = registerPendingWrite(() => new Promise<void>(() => {}));
    const { pending, isDone } = flushAndMark();
    await vi.advanceTimersByTimeAsync(FLUSH_TIMEOUT_MS - 1);
    expect(isDone()).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(isDone()).toBe(true);
    unregister();
  });

  it("clears the timer when every flush settles", async () => {
    vi.useFakeTimers();
    const unregister = registerPendingWrite(() => Promise.resolve());
    await flushPendingWrites();
    expect(vi.getTimerCount()).toBe(0);
    unregister();
  });
});
