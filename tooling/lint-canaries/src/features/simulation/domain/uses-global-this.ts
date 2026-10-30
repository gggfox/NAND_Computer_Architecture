// expect: no-restricted-globals
export function hasWindow(): boolean {
  return "window" in globalThis;
}
