// expect: no-throw-in-domain
export function rename(name: string): string {
  if (name.length === 0) {
    throw new Error("empty name");
  }
  return name;
}
