import { describe, expect, it, vi } from "vitest";

import { flushOnHide } from "./flush-on-hide";

const makeFlush = () => vi.fn<() => void>();

const makeTargets = () => {
  const win = new EventTarget();
  const doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
  return { win, doc };
};

describe("flushOnHide", () => {
  it("flushes a pending save when the page becomes hidden", () => {
    const { win, doc } = makeTargets();
    const flush = makeFlush();
    flushOnHide(flush, win, doc);
    doc.visibilityState = "hidden";
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("does not flush when the page becomes visible", () => {
    const { win, doc } = makeTargets();
    const flush = makeFlush();
    flushOnHide(flush, win, doc);
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(flush).not.toHaveBeenCalled();
  });

  it("still flushes on pagehide", () => {
    const { win, doc } = makeTargets();
    const flush = makeFlush();
    flushOnHide(flush, win, doc);
    win.dispatchEvent(new Event("pagehide"));
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("removes both listeners on cleanup", () => {
    const { win, doc } = makeTargets();
    const flush = makeFlush();
    const stop = flushOnHide(flush, win, doc);
    stop();
    doc.visibilityState = "hidden";
    doc.dispatchEvent(new Event("visibilitychange"));
    win.dispatchEvent(new Event("pagehide"));
    expect(flush).not.toHaveBeenCalled();
  });
});
