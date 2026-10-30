/** Marks unreachable cases. The only place in src/shared allowed to throw. */
export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
