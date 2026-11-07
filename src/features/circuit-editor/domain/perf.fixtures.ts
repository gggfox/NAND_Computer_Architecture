const MICROSECONDS_PER_MS = 1000;
const DEFAULT_WARM_UPS = 3;

/**
 * Vitest timeout for a test that uses `fastestCpuMs`, in ms of wall-clock time.
 *
 * The budgets in the tests count CPU time, but the Vitest timeout counts wall-clock time. When
 * parallel `pnpm check` runs load the machine, the OS gives a test only a small share of the CPU.
 * A test that needs 1 s of CPU time can then need more than the default 5 s. This limit is large,
 * so the load does not stop the test. A test that hangs still fails.
 *
 * The limit does not make the budgets or the ratio limits looser.
 */
export const PERF_TIMEOUT_MS = 120_000;

/** CPU time that this thread has used so far, in ms. */
const threadCpuMs = (): number => {
  const { user, system } = process.threadCpuUsage();
  return (user + system) / MICROSECONDS_PER_MS;
};

/**
 * The fastest of `runs` timed runs of `work`, in ms of CPU time of the current thread, after
 * `warmUps` runs that are not timed.
 *
 * Performance tests use this in place of wall-clock time. Wall-clock time also counts the time
 * slices that the OS gives to other processes, so it grows when other work (for example, parallel
 * `pnpm check` runs) loads the machine. CPU time of the thread does not count those slices. The
 * minimum removes the remaining noise (cache misses, garbage collection) and keeps real cost: a
 * slower algorithm is slower in every run, so its fastest run is slower too.
 */
export const fastestCpuMs = (
  runs: number,
  work: () => void,
  warmUps: number = DEFAULT_WARM_UPS,
): number => {
  for (let run = 0; run < warmUps; run += 1) {
    work();
  }
  let fastest = Number.POSITIVE_INFINITY;
  for (let run = 0; run < runs; run += 1) {
    const start = threadCpuMs();
    work();
    fastest = Math.min(fastest, threadCpuMs() - start);
  }
  return fastest;
};
