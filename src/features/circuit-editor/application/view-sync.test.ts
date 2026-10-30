/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Camera } from "../domain/camera";
import { createViewSync } from "./view-sync";

/** A camera told apart by its horizontal offset. */
const camera = (offset: number): Camera => ({ zoom: 1, x: offset, y: 0 });
const DELAY = 200;

describe("createViewSync", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes a burst of changes once, after the quiet delay", () => {
    const write = vi.fn<(value: Camera) => void>();
    const sync = createViewSync(write, DELAY);
    sync.changed(camera(1));
    vi.advanceTimersByTime(DELAY - 1);
    sync.changed(camera(2));
    vi.advanceTimersByTime(DELAY - 1);
    expect(write).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(write.mock.calls).toEqual([[camera(2)]]);
  });

  it("settle writes the latest camera now, and only once", () => {
    const write = vi.fn<(value: Camera) => void>();
    const sync = createViewSync(write);
    sync.changed(camera(3));
    sync.settle();
    sync.settle();
    vi.runAllTimers();
    expect(write.mock.calls).toEqual([[camera(3)]]);
  });

  it("dispose drops what is pending", () => {
    const write = vi.fn<(value: Camera) => void>();
    const sync = createViewSync(write);
    sync.changed(camera(4));
    sync.dispose();
    vi.runAllTimers();
    sync.settle();
    expect(write).not.toHaveBeenCalled();
  });
});
