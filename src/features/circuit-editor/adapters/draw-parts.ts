/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import type { ChipInstance, Point } from "~/features/projects";
import { readableTextOn } from "~/shared/contrast";

import type { ChipLayout, Rect } from "../domain/chip-layout";
import { layoutIn, wireRoute } from "../domain/geometry";
import { instanceLevel, pinValue, wireDash, wireLevel } from "../domain/signals";
import type { Level } from "../domain/signals";
import { intersects, levelColor } from "./frame";
import type { Frame } from "./frame";

const WIRE_WIDTH = 3;
const CHIP_RADIUS = 6;
const CORNER = 4;
const HALF = 0.5;
const TITLE_FONT = "600 14px system-ui, sans-serif";
/** Matches `CHAR_WIDTH` in the layout: labels are measured, not guessed. */
const LABEL_FONT = "13px ui-monospace, SFMono-Regular, Menlo, monospace";
const LABEL_INSET = 10;
const NAME_GAP = 8;
/** Shown on an input or output body before the engine has reported a level. */
const UNKNOWN_LEVEL = "?";
/** Wires drawn later sit on top: high signals stay readable where wires cross (as in DLS). */
const LEVEL_ORDER: readonly (Level | undefined)[] = [undefined, 0, 1];

const boundsOfPoints = (points: readonly Point[]): Rect => {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const [x, y] = [Math.min(...xs), Math.min(...ys)];
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
};

const drawPolyline = (ctx: CanvasRenderingContext2D, points: readonly Point[]): void => {
  ctx.beginPath();
  for (const [index, point] of points.entries()) {
    if (index === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  }
  ctx.stroke();
};

const drawWireGroup = (
  frame: Frame,
  level: Level | undefined,
  routes: readonly Point[][],
): void => {
  const { ctx } = frame;
  ctx.strokeStyle = levelColor(frame.palette, level);
  ctx.setLineDash(wireDash(level));
  for (const route of routes) {
    drawPolyline(ctx, route);
  }
};

type Routes = Map<Level | undefined, Point[][]>;

/** The routes of the wires on screen, by level. */
const visibleRoutes = (frame: Frame): Routes => {
  const groups: Routes = new Map();
  for (const wire of frame.circuit.wires) {
    const route = wireRoute(frame, wire);
    if (route.length > 0 && intersects(boundsOfPoints(route), frame.visible)) {
      const level = wireLevel(frame.circuit, frame.known, wire);
      const group = groups.get(level);
      if (group === undefined) {
        groups.set(level, [[...route]]);
      } else {
        group.push([...route]);
      }
    }
  }
  return groups;
};

/** Visible wires, grouped by level so each colour is set once and high wires end on top. */
export const drawWires = (frame: Frame): void => {
  const groups = visibleRoutes(frame);
  const { ctx } = frame;
  ctx.lineWidth = WIRE_WIDTH;
  ctx.lineJoin = "round";
  for (const level of LEVEL_ORDER) {
    drawWireGroup(frame, level, groups.get(level) ?? []);
  }
  ctx.setLineDash(wireDash());
};

interface BodyStyle {
  readonly fill: string;
  readonly radius: number;
}

const drawBody = (frame: Frame, rect: Rect, { fill, radius }: BodyStyle): void => {
  const { ctx } = frame;
  ctx.fillStyle = fill;
  ctx.strokeStyle = frame.palette.text;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.width, rect.height, radius);
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
  ctx.roundRect(tab.x, tab.y, tab.width, tab.height, TAB_RADIUS);
  ctx.fill();
  ctx.stroke();
};

const drawTabs = (frame: Frame, instance: ChipInstance, layout: ChipLayout): void => {
  frame.ctx.lineWidth = 1;
  for (const pin of layout.pins) {
    drawTab(frame, pin.tab, tabLevel(frame, instance, pin));
  }
  frame.ctx.setLineDash(SOLID);
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
  drawBody(frame, layout.rect, { fill, radius: CORNER });
  frame.ctx.fillStyle = text;
  centerText(frame, layout.title, titleRect(frame, layout));
  drawLabels(frame, layout, text);
  drawTabs(frame, instance, layout);
};

/** A pin piece's name, outside its body on the side away from its pin. */
const drawPieceName = (frame: Frame, layout: ChipLayout): void => {
  const { ctx } = frame;
  const { rect } = layout;
  const facesRight = layout.pins[0]?.side !== "left";
  ctx.font = LABEL_FONT;
  ctx.fillStyle = frame.palette.text;
  ctx.textAlign = facesRight ? "right" : "left";
  const x = facesRight ? rect.x - NAME_GAP : rect.x + rect.width + NAME_GAP;
  ctx.fillText(layout.title, x, rect.y + rect.height * HALF);
};

/** A pin piece: its level on the body, its name outside, its tab. */
const drawPiece = (frame: Frame, instance: ChipInstance, layout: ChipLayout): void => {
  const { palette } = frame;
  const level = instanceLevel(frame.circuit, frame.known, instance);
  drawBody(frame, layout.rect, { fill: levelColor(palette, level), radius: CHIP_RADIUS });
  frame.ctx.fillStyle = palette[level === 0 ? "chip-text-low" : "chip-text"];
  centerText(frame, level === undefined ? UNKNOWN_LEVEL : String(level), layout.rect);
  drawPieceName(frame, layout);
  drawTabs(frame, instance, layout);
};

/** Every chip that is at least partly on screen. */
export const drawChips = (frame: Frame): void => {
  for (const instance of frame.circuit.instances) {
    const layout = layoutIn(frame, instance);
    if (intersects(layout.rect, frame.visible)) {
      (instance.kind.type === "pin" ? drawPiece : drawPart)(frame, instance, layout);
    }
  }
};
