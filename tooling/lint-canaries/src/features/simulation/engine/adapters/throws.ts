// expect: no-throw-in-domain
// Only src/features/simulation/adapters/ is exempt; an `adapters` folder deeper in simulation is not.
export function parseTick(value: number): number {
  if (value < 0) {
    throw new Error("negative tick");
  }
  return value;
}
