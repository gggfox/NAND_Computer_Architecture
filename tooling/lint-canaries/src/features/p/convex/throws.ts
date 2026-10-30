// expect-not: no-throw-in-domain
// The convex/ rule applies to the root convex/ folder only, not to any folder named `convex`.
export function rename(name: string): string {
  if (name.length === 0) {
    throw new Error("empty name");
  }
  return name;
}
