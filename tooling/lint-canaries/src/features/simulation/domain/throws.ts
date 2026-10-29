// expect: no-throw-in-domain
export function parseTick(value: number): number {
  if (value < 0) {
    throw new Error("negative tick");
  }
  return value;
}
