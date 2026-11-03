/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { Point } from "~/features/projects";

import type { Size } from "./chip-layout";
import { GRID } from "./geometry";

export type ArrayDirection = "row" | "column" | "grid";

/** What the Array dialog asks for: `count` copies laid out from the originals. */
export interface ArrayRequest {
  readonly count: number;
  readonly direction: ArrayDirection;
  /** Used only by "grid". */
  readonly columns: number;
  /** Gap between copies, in grid steps. */
  readonly spacing: number;
}

export const ARRAY_LIMITS = {
  count: { min: 1, max: 64 },
  columns: { min: 1, max: 16 },
  spacing: { min: 0, max: 8 },
} as const;

const clamp = (value: number, { min, max }: { min: number; max: number }): number =>
  Math.min(max, Math.max(min, Math.round(value)));

/** The distance between copies along one axis: the extent rounded up to whole grid steps, plus the gap. */
const stepOf = (extent: number, spacing: number): number =>
  Math.ceil(extent / GRID) * GRID + spacing * GRID;

/** Columns of the whole block, originals included. */
const columnsOf = ({ direction, count, columns }: ArrayRequest): number => {
  if (direction === "row") {
    return count + 1;
  }
  if (direction === "column") {
    return 1;
  }
  return Math.min(columns, count + 1);
};

const clamped = (request: ArrayRequest): ArrayRequest => ({
  ...request,
  count: clamp(request.count, ARRAY_LIMITS.count),
  columns: clamp(request.columns, ARRAY_LIMITS.columns),
  spacing: clamp(request.spacing, ARRAY_LIMITS.spacing),
});

/** World offsets of copies 1…count from the originals, snapped to GRID. */
export const arrayDeltas = (request: ArrayRequest, bounds: Size): readonly Point[] => {
  const safe = clamped(request);
  const across = stepOf(bounds.width, safe.spacing);
  const down = stepOf(bounds.height, safe.spacing);
  const columns = columnsOf(safe);
  return Array.from({ length: safe.count }, (_, index) => {
    const cell = index + 1;
    return { x: (cell % columns) * across, y: Math.floor(cell / columns) * down };
  });
};

/** Columns and rows of the whole block, originals included. */
export const arraySummary = (
  request: ArrayRequest,
): { readonly columns: number; readonly rows: number; readonly chips: number } => {
  const safe = clamped(request);
  const chips = safe.count + 1;
  const columns = columnsOf(safe);
  return { columns, rows: Math.ceil(chips / columns), chips };
};

/** ⌈√(count + 1)⌉, clamped to the column limits. */
export const defaultColumns = (count: number): number =>
  clamp(Math.ceil(Math.sqrt(count + 1)), ARRAY_LIMITS.columns);
