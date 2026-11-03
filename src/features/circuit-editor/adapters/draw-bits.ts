import type { PinDef } from "~/features/projects";

import { bitCells, bitOf } from "../domain/bit-grid";
import type { Rect } from "../domain/chip-layout";
import type { Level } from "../domain/signals";
import { levelColor } from "./frame";
import type { Frame } from "./frame";

const SWITCH_RADIUS = 3;
const LOW_DASH_PX = 2;
const LOW_DASH: readonly number[] = [LOW_DASH_PX, LOW_DASH_PX];
const SOLID: readonly number[] = [];

const drawSwitch = (frame: Frame, rect: Rect, level: Level | undefined): void => {
  const { ctx } = frame;
  ctx.fillStyle = levelColor(frame.palette, level);
  ctx.setLineDash(level === 0 ? LOW_DASH : SOLID);
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.width, rect.height, SWITCH_RADIUS);
  ctx.fill();
  ctx.stroke();
};

/**
 * A wide input's switches, one per bit in its level colour; a low one is outlined dashed, as a
 * low pin tab is, so level is not colour alone. Before the value is known they are all unlit.
 */
export const drawBits = (
  frame: Frame,
  { rect, def, value }: { readonly rect: Rect; readonly def: PinDef; readonly value?: number },
): void => {
  frame.ctx.lineWidth = 1;
  frame.ctx.strokeStyle = frame.palette.text;
  for (const cell of bitCells(rect, def.width)) {
    drawSwitch(frame, cell.rect, value === undefined ? undefined : bitOf(value, cell.bit));
  }
  frame.ctx.setLineDash(SOLID);
};
