/**
 * Search memory reused from search to search, so a search allocates nothing per state. An entry
 * counts only when its stamp is the current search's `generation`, so nothing is cleared between.
 */
export interface Scratch {
  best: Float64Array;
  parent: Int32Array;
  /** The generation that last set `best` and `parent`. */
  seen: Int32Array;
  /** The generation that expanded the state. */
  closed: Int32Array;
  generation: number;
}

export const createScratch = (): Scratch => ({
  best: new Float64Array(0),
  parent: new Int32Array(0),
  seen: new Int32Array(0),
  closed: new Int32Array(0),
  generation: 0,
});

/** Grows the scratch to `size` states if needed and starts a new generation. */
export const prepare = (scratch: Scratch, size: number) => {
  if (scratch.best.length < size) {
    scratch.best = new Float64Array(size);
    scratch.parent = new Int32Array(size);
    scratch.seen = new Int32Array(size);
    scratch.closed = new Int32Array(size);
  }
  scratch.generation += 1;
};
