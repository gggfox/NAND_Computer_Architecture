/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { ChipInstance, PinDef } from "~/features/projects";
import { readableTextOn } from "~/shared/contrast";

import { hasBitGrid, valueArea } from "../domain/bit-grid";
import type { ChipLayout, Rect } from "../domain/chip-layout";
import { layoutIn } from "../domain/geometry";
import { panelNumber } from "../domain/io-layout";
import { instanceLevel, pieceValue, pinLevelKey, pinValue } from "../domain/signals";
import type { Level } from "../domain/signals";
import { drawBits } from "./draw-bits";
import { traceBox } from "./draw-box";
import { inPart, intersects, levelColor } from "./frame";
import type { Frame } from "./frame";

const CHIP_RADIUS = 6;
const CORNER = 4;
/** In the bevel style: how far a part's and a pin piece's corners are cut, world px. */
const PART_BEVEL = 8;
const PIECE_BEVEL = 6;
const HALF = 0.5;
const TITLE_FONT = "600 14px system-ui, sans-serif";
/** Matches `CHAR_WIDTH` in the layout: labels are measured, not guessed. */
const LABEL_FONT = "13px ui-monospace, SFMono-Regular, Menlo, monospace";
const LABEL_INSET = 10;
/** A wide value (four or five digits) on a one-grid-wide pin piece. */
const WIDE_VALUE_FONT = "600 11px system-ui, sans-serif";
const WIDE_VALUE = 1000;
/** The order badge: a number in a small circle at the body's top-left. */
const BADGE_FONT = "600 9px system-ui, sans-serif";
const BADGE_RADIUS = 6;
const BADGE_INSET = 8;
const FULL_TURN = Math.PI + Math.PI;
/** Shown on an input or output body before the engine has reported a level. */
const UNKNOWN_LEVEL = "?";
/** While a pin is armed, pins it cannot reach are drawn this faint. */
const DIM_ALPHA = 0.35;

interface BodyStyle {
  readonly fill: string;
  readonly radius: number;
  readonly bevel: number;
}

const drawBody = (frame: Frame, rect: Rect, { fill, radius, bevel }: BodyStyle): void => {
  const { ctx, palette } = frame;
  ctx.fillStyle = fill;
  ctx.strokeStyle = palette.text;
  ctx.lineWidth = 1;
  ctx.beginPath();
  traceBox(ctx, rect, { corners: palette.corners, radius, bevel });
  ctx.fill();
  ctx.stroke();
};

type PinLayout = ChipLayout["pins"][number];

const NO_LEVEL: Level | undefined = undefined;
const TAB_RADIUS = 2;
const LOW_TAB_DASH_PX = 2;
const LOW_TAB_DASH: readonly number[] = [LOW_TAB_DASH_PX, LOW_TAB_DASH_PX];
const SOLID: readonly number[] = [];

/** The level on a 1-bit pin: probed, else (for a pin piece) the level the main thread knows. */
const tabLevel = (frame: Frame, instance: ChipInstance, pin: PinLayout): Level | undefined => {
  const value = pinValue(frame.known, instance.id, pin.key);
  if (pin.width !== 1 || value === undefined) {
    return pin.width === 1 ? instanceLevel(frame.circuit, frame.known, instance) : NO_LEVEL;
  }
  return value === 0 ? 0 : 1;
};

/** One pin tab in its level colour; a low tab is outlined dashed, so level is not colour alone. */
const drawTab = (frame: Frame, tab: Rect, level: Level | undefined): void => {
  const { ctx, palette } = frame;
  ctx.fillStyle = levelColor(palette, level);
  ctx.strokeStyle = palette.text;
  ctx.setLineDash(level === 0 ? LOW_TAB_DASH : SOLID);
  ctx.beginPath();
  traceBox(ctx, tab, { corners: palette.corners, radius: TAB_RADIUS, bevel: 0 });
  ctx.fill();
  ctx.stroke();
};

/** The pin tabs; while a pin is armed, the ones it cannot reach are faint. */
const drawTabs = (frame: Frame, instance: ChipInstance, layout: ChipLayout): void => {
  const { ctx, armed } = frame;
  ctx.lineWidth = 1;
  for (const pin of layout.pins) {
    const key = pinLevelKey(instance.id, pin.key);
    const dim = armed !== undefined && key !== armed.key && !armed.legal.has(key);
    ctx.globalAlpha = dim ? DIM_ALPHA : 1;
    drawTab(frame, pin.tab, tabLevel(frame, instance, pin));
  }
  ctx.globalAlpha = 1;
  ctx.setLineDash(SOLID);
};

/** Pin names inside the body, beside their pins (spec §5.1). */
const drawLabels = (frame: Frame, layout: ChipLayout, color: string): void => {
  const { ctx } = frame;
  ctx.font = LABEL_FONT;
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  for (const pin of layout.pins) {
    const left = pin.side === "left";
    ctx.textAlign = left ? "left" : "right";
    ctx.fillText(pin.label, pin.anchor.x + (left ? LABEL_INSET : -LABEL_INSET), pin.anchor.y);
  }
};

const centerText = (frame: Frame, text: string, rect: Rect): void => {
  const { ctx } = frame;
  ctx.font = TITLE_FONT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, rect.x + rect.width * HALF, rect.y + rect.height * HALF);
};

/** The widest label on one side, as drawn (the label font must be set). */
const labelColumn = (frame: Frame, layout: ChipLayout, side: "left" | "right"): number =>
  Math.max(
    0,
    ...layout.pins
      .filter((pin) => pin.side === side)
      .map((pin) => frame.ctx.measureText(pin.label).width + LABEL_INSET),
  );

/** The body less its label columns, so the title is centred between the pin names. */
const titleRect = (frame: Frame, layout: ChipLayout): Rect => {
  frame.ctx.font = LABEL_FONT;
  const left = labelColumn(frame, layout, "left");
  const right = labelColumn(frame, layout, "right");
  const { rect } = layout;
  return { ...rect, x: rect.x + left, width: rect.width - left - right };
};

/** A part: its colour, title, pin labels and tabs. Built-ins use the theme's chip colours. */
const drawPart = (frame: Frame, instance: ChipInstance, layout: ChipLayout): void => {
  const { palette, project } = frame;
  const { kind } = instance;
  const custom =
    kind.type === "custom" ? project.chips.find((chip) => chip.id === kind.chipId) : undefined;
  const fill = custom?.color ?? palette["chip-nand"];
  const text = custom === undefined ? palette["chip-text"] : readableTextOn(custom.color);
  drawBody(frame, layout.rect, { fill, radius: CORNER, bevel: PART_BEVEL });
  frame.ctx.fillStyle = text;
  centerText(frame, layout.title, titleRect(frame, layout));
  drawLabels(frame, layout, text);
  drawTabs(frame, instance, layout);
};

/** A pin piece's name, where the layout puts it: outside the body, away from its pin. */
const drawPieceName = (frame: Frame, layout: ChipLayout): void => {
  const { ctx } = frame;
  const { name } = layout;
  if (name === undefined) {
    return;
  }
  // An input's name ends at the gap before its body, so it is right-aligned there.
  const facesRight = layout.pins[0]?.side !== "left";
  ctx.font = LABEL_FONT;
  ctx.fillStyle = frame.palette.text;
  ctx.textAlign = facesRight ? "right" : "left";
  ctx.fillText(
    layout.title,
    facesRight ? name.x + name.width : name.x,
    name.y + name.height * HALF,
  );
};

/** The badge's outline: a circle, or a square when the theme bevels its bodies. */
const traceBadge = (frame: Frame, rect: Rect): void => {
  const { ctx, palette } = frame;
  const centreX = rect.x + BADGE_INSET;
  const centreY = rect.y + BADGE_INSET;
  if (palette.corners === "bevel") {
    const side = BADGE_RADIUS + BADGE_RADIUS;
    ctx.rect(centreX - BADGE_RADIUS, centreY - BADGE_RADIUS, side, side);
    return;
  }
  ctx.arc(centreX, centreY, BADGE_RADIUS, 0, FULL_TURN);
};

/** The piece's 1-based place in its direction's Pins-panel list, in a badge at the top-left. */
const drawBadge = (frame: Frame, rect: Rect, def: PinDef | undefined): void => {
  if (def === undefined) {
    return;
  }
  const { ctx, palette } = frame;
  // `drawBody` has just set the 1 px line width this outline uses.
  ctx.fillStyle = palette["chip-nand"];
  ctx.strokeStyle = palette["chip-text"];
  ctx.beginPath();
  traceBadge(frame, rect);
  ctx.fill();
  ctx.stroke();
  drawBadgeNumber(frame, rect, panelNumber(frame.circuit.pins, def.id));
};

/** The badge's number, in the chip text colour on the chip fill, so it reads in every theme. */
const drawBadgeNumber = (frame: Frame, rect: Rect, place: number): void => {
  const { ctx, palette } = frame;
  ctx.fillStyle = palette["chip-text"];
  ctx.font = BADGE_FONT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(place), rect.x + BADGE_INSET, rect.y + BADGE_INSET);
};

/** The piece's value: one level on a 1-bit body, the decimal value on a wider one. */
const drawValue = (frame: Frame, rect: Rect, value: number | undefined): void => {
  const { ctx } = frame;
  ctx.font = value !== undefined && value >= WIDE_VALUE ? WIDE_VALUE_FONT : TITLE_FONT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const text = value === undefined ? UNKNOWN_LEVEL : String(value);
  ctx.fillText(text, rect.x + rect.width * HALF, rect.y + rect.height * HALF);
};

/** The value on the body; a wide input shows it above its switches. */
const drawPieceValue = (
  frame: Frame,
  rect: Rect,
  { def, value }: { readonly def: PinDef | undefined; readonly value: number | undefined },
): void => {
  if (def === undefined || !hasBitGrid(def)) {
    drawValue(frame, rect, value);
    return;
  }
  drawValue(frame, valueArea(rect, def.width), value);
  drawBits(frame, { rect, def, ...(value === undefined ? {} : { value }) });
};

const defOf = (frame: Frame, instance: ChipInstance): PinDef | undefined => {
  const { kind } = instance;
  return kind.type === "pin" ? frame.circuit.pins.find((pin) => pin.id === kind.pinId) : undefined;
};

/** A 1-bit piece's level, as `instanceLevel` reads it, without looking the instance up again. */
const levelOfPiece = (def: PinDef | undefined, value: number | undefined): Level | undefined => {
  if (def?.width !== 1 || value === undefined) {
    return NO_LEVEL;
  }
  return value === 0 ? 0 : 1;
};

/** A pin piece: its value (and a wide input's switches) on the body, its badge, name and tab. */
const drawPiece = (frame: Frame, instance: ChipInstance, layout: ChipLayout): void => {
  const { palette } = frame;
  const def = defOf(frame, instance);
  const value = def === undefined ? undefined : pieceValue(frame.known, def);
  const level = levelOfPiece(def, value);
  drawBody(frame, layout.rect, {
    fill: levelColor(palette, level),
    radius: CHIP_RADIUS,
    bevel: PIECE_BEVEL,
  });
  frame.ctx.fillStyle = palette[level === 0 ? "chip-text-low" : "chip-text"];
  drawPieceValue(frame, layout.rect, { def, value });
  drawBadge(frame, layout.rect, def);
  drawPieceName(frame, layout);
  drawTabs(frame, instance, layout);
};

const drawIfVisible = (frame: Frame, instance: ChipInstance): void => {
  const layout = layoutIn(frame, instance);
  if (intersects(layout.rect, frame.visible)) {
    (instance.kind.type === "pin" ? drawPiece : drawPart)(frame, instance, layout);
  }
};

/** Every chip (in the frame's part) that is at least partly on screen. */
export const drawChips = (frame: Frame): void => {
  for (const instance of frame.circuit.instances) {
    if (inPart(frame, [instance.id])) {
      drawIfVisible(frame, instance);
    }
  }
};
