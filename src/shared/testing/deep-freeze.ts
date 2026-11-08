/* oxlint-disable typescript/prefer-readonly-parameter-types -- the helper exists to mutate (freeze) its mutable input */
const isObject = (value: unknown): value is object =>
  (typeof value === "object" && value !== null) || typeof value === "function";

const throwFrozen = (): never => {
  throw new TypeError("Cannot modify a frozen collection");
};

const MUTATORS = ["set", "add", "delete", "clear"];

/** `Object.freeze` does not protect Map and Set contents, so replace their mutating methods. */
const lockCollection = (collection: Map<unknown, unknown> | Set<unknown>): void => {
  for (const method of MUTATORS) {
    if (method in collection) {
      Object.defineProperty(collection, method, { value: throwFrozen });
    }
  }
};

/** The values a freeze must reach: own properties, plus the entries of a Map or Set. */
const childrenOf = (value: object): unknown[] => {
  const own = Reflect.ownKeys(value).map((key): unknown => Reflect.get(value, key));
  if (value instanceof Map) {
    return [...own, ...value.keys(), ...value.values()];
  }
  return value instanceof Set ? [...own, ...value] : own;
};

const freezeInto = (value: unknown, seen: Set<object>): void => {
  if (!isObject(value) || seen.has(value)) {
    return;
  }
  seen.add(value);
  if (value instanceof Map || value instanceof Set) {
    lockCollection(value);
  }
  Object.freeze(value);
  for (const child of childrenOf(value)) {
    freezeInto(child, seen);
  }
};

/**
 * Freeze a value and everything it reaches. Use it in tests: a frozen input makes
 * any mutation throw a TypeError in strict mode, so the test fails loudly.
 */
export const deepFreeze = <T>(value: T): T => {
  freezeInto(value, new Set<object>());
  return value;
};
