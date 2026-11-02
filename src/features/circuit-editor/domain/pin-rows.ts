import { pinDef } from "~/features/projects";
import type { BitWidth, Circuit, PinDef, PinDirection, Point } from "~/features/projects";
import { newInstanceId } from "~/shared/ids";
import type { InstanceId, PinId } from "~/shared/ids";

import type { Scene } from "./geometry";
import { columnPositions, nextPinNames } from "./pin-placement";

/** One row of the Pins panel. */
export interface PinRowModel {
  readonly pinId: PinId;
  readonly instanceId: InstanceId;
  readonly name: string;
  readonly width: BitWidth;
  /** 1-based position among the pins of the same direction. */
  readonly ordinal: number;
  /** Whether the row's piece is selected on the canvas. */
  readonly selected: boolean;
}

export interface PinRows {
  readonly inputs: readonly PinRowModel[];
  readonly outputs: readonly PinRowModel[];
}

const NIBBLE = 4;
const BYTE = 8;
const WORD = 16;
const BINARY = 2;

/** The widths a pin can have, in the order the width menus list them. */
export const PIN_WIDTHS: readonly BitWidth[] = [1, NIBBLE, BYTE, WORD];

const rowsOf = (
  circuit: Circuit,
  direction: PinDirection,
  selection: ReadonlySet<InstanceId>,
): readonly PinRowModel[] => {
  const pieces = new Map<PinId, InstanceId>();
  for (const item of circuit.instances) {
    if (item.kind.type === "pin") {
      pieces.set(item.kind.pinId, item.id);
    }
  }
  return circuit.pins
    .filter((pin) => pin.direction === direction)
    .flatMap((pin, index) => {
      const instanceId = pieces.get(pin.id);
      if (instanceId === undefined) {
        return [];
      }
      const { id: pinId, name, width } = pin;
      return [
        { pinId, instanceId, name, width, ordinal: index + 1, selected: selection.has(instanceId) },
      ];
    });
};

/** The Pins panel's rows, in `circuit.pins` order (the only source of pin order). */
export const pinRows = (circuit: Circuit, selection: ReadonlySet<InstanceId>): PinRows => ({
  inputs: rowsOf(circuit, "input", selection),
  outputs: rowsOf(circuit, "output", selection),
});

/** The row after `pinId`, running from the last input into the first output. */
export const rowAfter = (rows: PinRows, pinId: PinId): PinRowModel | undefined => {
  const all = [...rows.inputs, ...rows.outputs];
  const index = all.findIndex((row) => row.pinId === pinId);
  return index === -1 ? undefined : all[index + 1];
};

/** The row to go to when `pinId`'s row goes: the one after it, else the one before. */
export const rowNear = (rows: PinRows, pinId: PinId): PinRowModel | undefined => {
  const all = [...rows.inputs, ...rows.outputs];
  const index = all.findIndex((row) => row.pinId === pinId);
  return index === -1 ? undefined : (all[index + 1] ?? all[index - 1]);
};

/** A bit width from a width menu's key. */
export const widthOf = (key: string): BitWidth | undefined =>
  PIN_WIDTHS.find((width) => String(width) === key);

/** The largest value `width` bits hold. */
export const maxValueOf = (width: BitWidth): number => BINARY ** width - 1;

/** `value` in binary, `width` digits long, bit 0 rightmost. */
export const bitString = (value: number, width: BitWidth): string =>
  value.toString(BINARY).padStart(width, "0");

export interface NewPin {
  readonly pin: PinDef;
  readonly instanceId: InstanceId;
  readonly position: Point;
}

export interface PinsRequest {
  readonly direction: PinDirection;
  readonly count: number;
  readonly width: BitWidth;
}

/** `count` new pins with the next free names, stacked in their direction's column. */
export const newPins = (scene: Scene, request: PinsRequest): readonly NewPin[] => {
  const { direction, count, width } = request;
  const names = nextPinNames(scene.circuit, direction, count);
  const positions = columnPositions(
    scene,
    direction,
    names.map(() => width),
  );
  // Each position takes the name at its index; slicing pairs them without an unreachable fallback.
  return positions.flatMap((position, index) =>
    names.slice(index, index + 1).map((name) => ({
      pin: pinDef(name, direction, width),
      instanceId: newInstanceId(),
      position,
    })),
  );
};
