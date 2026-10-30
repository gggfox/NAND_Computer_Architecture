/* oxlint-disable typescript/prefer-readonly-parameter-types -- chips and pin refs carry branded ids (mutable object types); none is mutated */
import { newChipId, newInstanceId, newPinId, newProjectId, newWireId } from "~/shared/ids";

import type {
  BitWidth,
  Chip,
  ChipInstance,
  Circuit,
  InstanceKind,
  PinDef,
  PinDirection,
  PinRef,
  Point,
  Project,
  Wire,
} from "./model";

export const DEFAULT_CHIP_COLOR = "#3b82f6";

export const EMPTY_CIRCUIT: Circuit = { pins: [], instances: [], wires: [] };

/* oxlint-disable-next-line eslint/id-length -- `x` and `y` are coordinate names */
const ORIGIN: Point = { x: 0, y: 0 };

export const pinDef = (name: string, direction: PinDirection, width: BitWidth = 1): PinDef => ({
  id: newPinId(),
  name,
  width,
  direction,
});

export const piece = (kind: InstanceKind, position: Point = ORIGIN): ChipInstance => ({
  id: newInstanceId(),
  kind,
  position,
});

/** The canvas piece of one of the chip's own pins. */
export const pinPiece = (def: PinDef, position: Point = ORIGIN): ChipInstance =>
  piece({ type: "pin", pinId: def.id }, position);

export const wire = (from: PinRef, to: PinRef, bitWidth: BitWidth = 1): Wire => ({
  id: newWireId(),
  from,
  to,
  bitWidth,
  waypoints: [],
  manualWaypoints: false,
});

interface NewChipOptions {
  /** Publishes the draft as the saved version too. */
  readonly saved?: boolean;
  readonly color?: string;
}

export const newChip = (
  name: string,
  draft: Circuit = EMPTY_CIRCUIT,
  options: NewChipOptions = {},
): Chip => ({
  id: newChipId(),
  name,
  color: options.color ?? DEFAULT_CHIP_COLOR,
  ...(options.saved === true ? { saved: draft } : {}),
  draft,
  tags: [],
});

/** A project that opens on its first chip. */
export const projectWith = (
  name: string,
  chips: readonly [Chip, ...Chip[]],
  seed = 1,
): Project => ({
  id: newProjectId(),
  name,
  seed,
  chips,
  lastOpenedChipId: chips[0].id,
  folders: [],
});
