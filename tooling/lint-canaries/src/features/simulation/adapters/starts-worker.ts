// expect-not: no-restricted-globals
export function startWorker(url: URL): Worker {
  return new Worker(url, { type: "module" });
}
