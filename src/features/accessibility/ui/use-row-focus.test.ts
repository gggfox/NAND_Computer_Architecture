import { describe, expect, it, vi } from "vitest";

import { focusFirst } from "./use-row-focus";

/** A small stand-in for an element. The tests run without a DOM. */
const node = (isConnected = true) => ({ isConnected, focus: vi.fn() });

describe("focusFirst", () => {
  it("focuses the first element that is still in the page", () => {
    const gone = node(false);
    const next = node();
    const later = node();
    focusFirst([gone, next, later]);
    expect(gone.focus).not.toHaveBeenCalled();
    expect(next.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(later.focus).not.toHaveBeenCalled();
  });

  it("does nothing when no element is left", () => {
    const gone = node(false);
    focusFirst([gone]);
    expect(gone.focus).not.toHaveBeenCalled();
  });
});
