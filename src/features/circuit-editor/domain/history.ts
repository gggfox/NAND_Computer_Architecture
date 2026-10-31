/** Snapshot-based undo history; `past` is oldest-first. */
export interface History<S> {
  readonly past: readonly S[];
  readonly present: S;
  readonly future: readonly S[];
}

const DEFAULT_HISTORY_CAP = 200;

export const createHistory = <S>(present: S): History<S> => ({ past: [], present, future: [] });

export const pushHistory = <S>(
  history: History<S>,
  next: S,
  cap = DEFAULT_HISTORY_CAP,
): History<S> => ({
  past: [...history.past, history.present].slice(-cap),
  present: next,
  future: [],
});

export const undo = <S>(history: History<S>): History<S> => {
  const previous = history.past.at(-1);
  if (previous === undefined) {
    return history;
  }
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
};

export const redo = <S>(history: History<S>): History<S> => {
  const [next, ...rest] = history.future;
  if (next === undefined) {
    return history;
  }
  return { past: [...history.past, history.present], present: next, future: rest };
};

const same = <S>(first: readonly S[], second: readonly S[]): boolean =>
  first.every((snapshot, index) => snapshot === second[index]);

/** Maps every snapshot; when `fn` returns each one unchanged, the history itself is unchanged. */
export const mapHistory = <S>(history: History<S>, fn: (snapshot: S) => S): History<S> => {
  const mapped = {
    past: history.past.map((snapshot) => fn(snapshot)),
    present: fn(history.present),
    future: history.future.map((snapshot) => fn(snapshot)),
  };
  return mapped.present === history.present &&
    same(mapped.past, history.past) &&
    same(mapped.future, history.future)
    ? history
    : mapped;
};
