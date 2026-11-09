/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import path from "node:path";

import type { Page, TestInfo } from "@playwright/test";

import {
  canvasHost,
  DEMO_PART,
  DEMO_PINS,
  DRAG_MOVES,
  expect,
  exportedProject,
  fingerDrag,
  touch,
  worldToPage,
} from "./support";
import type { ExportedFile, ExportedWire, Point } from "./support";
import { pressEditorTool } from "./toolbar-support";

/** Helpers for the wiring specs: pointers that tap and drag, and reading wires from an export. */

export const BUS = path.join(import.meta.dirname, "fixtures", "bus.json");
export const NAND_B = 1;
export const DEMO_WIRES = 3;
const MAX_TABS = 40;
const HALF = 0.5;

/** The phone and tablet projects play touch; the desktop ones use the mouse. */
export const usesTouch = (isMobile: boolean, testInfo: TestInfo): boolean =>
  isMobile || testInfo.project.name === "tablet-safari";

export interface Pointer {
  readonly tap: (at: Point) => Promise<void>;
  readonly drag: (from: Point, to: Point) => Promise<void>;
}

export const pointerFor = (page: Page, touches: boolean): Pointer =>
  touches
    ? {
        tap: (at) =>
          touch(page, [
            { type: "down", id: 1, at },
            { type: "up", id: 1, at },
          ]),
        drag: (from, to) => touch(page, fingerDrag(from, to)),
      }
    : {
        tap: (at) => page.mouse.click(at.x, at.y),
        drag: async (from, to) => {
          await page.mouse.move(from.x, from.y);
          await page.mouse.down();
          await page.mouse.move(to.x, to.y, { steps: DRAG_MOVES });
          await page.mouse.up();
        },
      };

export const wiresOf = (file: ExportedFile): readonly ExportedWire[] =>
  file.project.chips[0]?.draft.wires ?? [];

export const instanceIds = (file: ExportedFile): readonly string[] =>
  file.project.chips[0]?.draft.instances.map((instance) => instance.id) ?? [];

/** The demo wire into pin `pin` of the part `part` (see `DEMO_PART`). */
export const wireInto = (
  file: ExportedFile,
  part: number,
  pin: number,
): ExportedWire | undefined => {
  const id = instanceIds(file)[part];
  return wiresOf(file).find((item) => item.to.instanceId === id && item.to.pin === pin);
};

/** A demo wire's drawn polyline in world units: its pin, its waypoints, its other pin. */
export const polylineOf = (file: ExportedFile, wire: ExportedWire): readonly Point[] => {
  const ids = instanceIds(file);
  const anchor = (end: ExportedWire["from"]): Point => {
    const point =
      typeof end.pin === "number" ? DEMO_PINS[ids.indexOf(end.instanceId)]?.[end.pin] : undefined;
    if (point === undefined) {
      throw new Error("The wire's end is not a demo pin");
    }
    return point;
  };
  return [anchor(wire.from), ...wire.waypoints, anchor(wire.to)];
};

const lengthOf = (from: Point, to: Point): number =>
  Math.abs(to.x - from.x) + Math.abs(to.y - from.y);

/** The middle of a polyline's longest segment, clear of both pins. */
export const middleOf = (polyline: readonly Point[]): Point => {
  const segments = polyline.slice(1).map((to, index) => [polyline[index] ?? to, to] as const);
  const [from, to] = segments.toSorted(
    (first, second) => lengthOf(...second) - lengthOf(...first),
  )[0] ?? [polyline[0], polyline[0]];
  if (from === undefined || to === undefined) {
    throw new Error("The polyline is empty");
  }
  return { x: (from.x + to.x) * HALF, y: (from.y + to.y) * HALF };
};

/** The viewport point in the middle of a demo wire. */
export const wirePoint = (page: Page, file: ExportedFile, wire: ExportedWire): Promise<Point> =>
  worldToPage(page, middleOf(polylineOf(file, wire)));

export const isOrthogonal = (polyline: readonly Point[]): boolean =>
  polyline.every((point, index) => {
    const before = polyline[index - 1];
    return before === undefined || before.x === point.x || before.y === point.y;
  });

/** Selects the demo wire into `part`'s pin `pin` with a tap, and deletes it from the toolbar. */
export const deleteDemoWire = async (
  page: Page,
  pointer: Pointer,
  { part, pin }: { readonly part: number; readonly pin: number },
): Promise<void> => {
  const file = await exportedProject(page);
  const wire = wireInto(file, part, pin);
  if (wire === undefined) {
    throw new Error("The demo has no such wire");
  }
  await pointer.tap(await wirePoint(page, file, wire));
  await page
    .getByRole("toolbar", { name: "Editor tools" })
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect.poll(async () => wiresOf(await exportedProject(page)).length).toBe(DEMO_WIRES - 1);
};

/** The wire from Input B into the NAND's `b`, as the specs below draw it. */
export const inputBWire = (file: ExportedFile): ExportedWire | undefined => {
  const ids = instanceIds(file);
  return wiresOf(file).find(
    (item) =>
      item.from.instanceId === ids[DEMO_PART.inputB] &&
      item.to.instanceId === ids[DEMO_PART.nand] &&
      item.to.pin === NAND_B,
  );
};

export const importBus = async (page: Page): Promise<void> => {
  const chooserEvent = page.waitForEvent("filechooser");
  await pressEditorTool(page, "Import");
  const chooser = await chooserEvent;
  await chooser.setFiles(BUS);
  await expect(page.getByRole("heading", { level: 1, name: "Bus" })).toBeAttached();
};

/** Picks a swatch in the open colour dialog and saves; focus goes back to the canvas. */
export const saveColor = async (page: Page, title: string, color: string): Promise<void> => {
  const dialog = page.getByRole("dialog", { name: title });
  await expect(dialog).toBeVisible();
  // The radio itself is visually hidden under its swatch; press the swatch, as a user does.
  const radio = dialog.getByRole("radio", { name: color, exact: true });
  await dialog.getByText(color, { exact: true }).click();
  await expect(radio).toBeChecked();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toHaveCount(0);
};

/** Tabs until the canvas host has focus, as a keyboard user reaches it. */
export const tabToCanvas = async (page: Page): Promise<void> => {
  const host = canvasHost(page);
  for (let step = 0; step < MAX_TABS; step += 1) {
    await page.keyboard.press("Tab");
    if (await host.evaluate((element) => element === document.activeElement)) {
      return;
    }
  }
  throw new Error(`The canvas was not reached within ${String(MAX_TABS)} Tab presses`);
};

export const press = async (page: Page, key: string, times: number): Promise<void> => {
  for (let step = 0; step < times; step += 1) {
    await page.keyboard.press(key);
  }
};
