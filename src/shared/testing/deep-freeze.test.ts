import { describe, expect, it } from "vitest";

import { deepFreeze } from "./deep-freeze";

interface Box {
  count: number;
}

describe("deepFreeze", () => {
  it("returns the same value", () => {
    const value = { count: 1 };
    expect(deepFreeze(value)).toBe(value);
  });

  it("makes nested objects and arrays throw on mutation", () => {
    const value = deepFreeze({ list: [{ count: 1 }] as Box[], inner: { count: 1 } });
    expect(() => {
      value.inner.count = 2;
    }).toThrow(TypeError);
    expect(() => {
      value.list.push({ count: 2 });
    }).toThrow(TypeError);
    expect(() => {
      const [first] = value.list;
      if (first) {
        first.count = 3;
      }
    }).toThrow(TypeError);
  });

  it("makes Map and Set throw on mutation", () => {
    const value = deepFreeze({
      map: new Map<string, Box>([["key", { count: 1 }]]),
      set: new Set([1]),
    });
    expect(() => {
      value.map.set("other", { count: 2 });
    }).toThrow(TypeError);
    expect(() => {
      value.set.add(2);
    }).toThrow(TypeError);
    expect(() => {
      value.set.clear();
    }).toThrow(TypeError);
    expect(() => {
      const entry = value.map.get("key");
      if (entry) {
        entry.count = 5;
      }
    }).toThrow(TypeError);
  });

  it("handles cycles", () => {
    const node: { self?: unknown } = {};
    node.self = node;
    expect(Object.isFrozen(deepFreeze(node))).toBe(true);
  });
});
