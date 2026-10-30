import { describe, expect, it, vi } from "vitest";

import { flushPendingWrites, registerPendingWrite } from "./pending-writes";

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
