import { describe, expect, it, vi } from "vitest";

import { setFocusReturn, takeFocusReturn } from "./focus-return";

const element = (isConnected: boolean) => ({ isConnected, focus: vi.fn() });

describe("focus return", () => {
  it("gives the named element once", () => {
    const named = element(true);
    setFocusReturn({ find: () => named });
    expect(takeFocusReturn()).toBe(named);
    expect(takeFocusReturn()).toBeUndefined();
  });

  it("gives nothing when the element left the page", () => {
    setFocusReturn({ find: () => element(false) });
    expect(takeFocusReturn()).toBeUndefined();
  });
});
