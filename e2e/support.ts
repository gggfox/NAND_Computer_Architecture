/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import { readFile } from "node:fs/promises";

import { expect, test as base } from "@playwright/test";
import type { Page } from "@playwright/test";
import { z } from "zod";

/** Every spec runs with reduced motion on, so no assertion races a transition (ADR 10). */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await use(page);
  },
});

export { expect } from "@playwright/test";

/** The editor adds its view (`?zoom=…&x=…&y=…`) to the URL. */
export const PROJECT_URL = /\/projects\/[0-9a-f-]{36}(?:\?|$)/u;

export type Theme = "Light" | "Dark" | "High contrast";
export const THEMES: readonly Theme[] = ["Light", "Dark", "High contrast"];

/** Opens the index and creates the demo project (two inputs into one NAND), landing on its page. */
export const createProject = async (page: Page): Promise<void> => {
  await page.goto("/");
  await page.getByRole("button", { name: "New project" }).click();
  await expect(page).toHaveURL(PROJECT_URL);
  await expect(output(page)).toHaveText(/Output: [01]/u);
};

type SwitchName = "Input A" | "Input B";

export const inputSwitch = (page: Page, name: SwitchName) => page.getByRole("switch", { name });

/** The summary's live region (the status `<output>` above the canvas is a different element). */
export const output = (page: Page) => page.getByText(/^Output: /u);

/** Picks a theme through the toolbar's Theme select (the user path, not localStorage). */
export const pickTheme = async (page: Page, theme: Theme): Promise<void> => {
  await page.getByRole("button", { name: /Theme$/u }).click();
  await page.getByRole("option", { name: theme, exact: true }).click();
  await expect(page.getByRole("listbox")).toBeHidden();
};

/**
 * Sets a switch the way a pointer user does: by pressing its visible label. The `<input
 * role="switch">` itself is visually hidden under the track, so it cannot be clicked directly.
 */
export const setSwitch = async (page: Page, name: SwitchName, on: boolean): Promise<void> => {
  const control = inputSwitch(page, name);
  if ((await control.isChecked()) !== on) {
    await page.locator("label").filter({ has: control }).click();
  }
  await expect(control).toBeChecked({ checked: on });
};

export const setInputs = async (page: Page, a: boolean, b: boolean): Promise<void> => {
  await setSwitch(page, "Input A", a);
  await setSwitch(page, "Input B", b);
};

/** The canvas host: the focusable `application` region that takes the keyboard map. */
export const canvasHost = (page: Page) => page.getByRole("application");

/** The canvas's polite live region, which speaks each selection, move, delete and pin. */
export const spoken = (page: Page) => canvasHost(page).locator("[aria-live=polite]");

interface Point {
  readonly x: number;
  readonly y: number;
}

/** Mirrors `SCREEN_PAD` in `domain/camera.ts`: world (x, y) at zoom 1 sits 48 px in. */
const SCREEN_PAD = 48;

/** The demo chip's parts in canvas order (Input A, Input B, the NAND, the output): world rects. */
const DEMO_LAYOUT = [
  { x: 0, y: 0, width: 40, height: 40 },
  { x: 0, y: 80, width: 40, height: 40 },
  { x: 160, y: 40, width: 120, height: 80 },
  { x: 320, y: 40, width: 40, height: 40 },
] as const;

/** The camera the URL holds (`?zoom=&x=&y=`), with the editor's defaults when absent. */
export const urlCamera = (page: Page): { readonly zoom: number } & Point => {
  const search = new URL(page.url()).searchParams;
  const read = (name: string, fallback: number): number => {
    const value = search.get(name);
    return value === null ? fallback : Number(value);
  };
  return { zoom: read("zoom", 1), x: read("x", 0), y: read("y", 0) };
};

/**
 * A world point as a viewport point, from the URL's camera and the drawing canvas's box. The
 * canvas is first scrolled to the top of the viewport, so the point can be pressed with the mouse;
 * that scroll is idempotent, so points measured one after another stay valid together.
 */
export const worldToPage = async (page: Page, world: Point): Promise<Point> => {
  const canvas = canvasHost(page).locator("canvas").first();
  await canvas.evaluate((element) => {
    element.scrollIntoView({ block: "start", inline: "nearest" });
  });
  const box = await canvas.boundingBox();
  if (box === null) {
    throw new Error("The canvas is not visible");
  }
  const camera = urlCamera(page);
  return {
    x: box.x + SCREEN_PAD + (world.x - camera.x) * camera.zoom,
    y: box.y + SCREEN_PAD + (world.y - camera.y) * camera.zoom,
  };
};

const HALF = 0.5;

/** The demo's parts by their index in canvas order, for `chipCenter`. */
export const DEMO_PART = { inputA: 0, inputB: 1, nand: 2, output: 3 } as const;

/** One grid step in world units (`GRID` in `domain/chip-layout.ts`). */
export const GRID = 40;
/** Where the demo NAND starts, and where it is after a move of two grid steps right. */
export const NAND_AT: Point = { x: 160, y: 40 };
export const NAND_MOVED: Point = { x: 240, y: 40 };

/** The viewport point at the centre of the demo's part `instanceIndex` (see `DEMO_PART`). */
export const chipCenter = (page: Page, instanceIndex: number): Promise<Point> => {
  const rect = DEMO_LAYOUT[instanceIndex];
  if (rect === undefined) {
    throw new Error(`The demo has no part ${String(instanceIndex)}`);
  }
  return worldToPage(page, { x: rect.x + rect.width * HALF, y: rect.y + rect.height * HALF });
};

/**
 * Touch pointer ids start here, clear of the mouse's id 1: WebKit's phone emulation sends a real
 * mouse move when the page scrolls, which must not be mistaken for the finger.
 */
export const TOUCH_ID_BASE = 10;

export type TouchStep =
  | { readonly type: "down" | "move" | "up"; readonly id: number; readonly at: Point }
  | { readonly type: "wait"; readonly ms: number };

/**
 * Plays touch `PointerEvent`s (`pointerType: "touch"`) at viewport points on the drawing canvas,
 * the element the editor listens on. Synthetic events behave the same in Chromium, WebKit and
 * Firefox, where real multi-touch cannot be emulated. A synthetic pointer is not one the browser
 * tracks, so pointer capture is stubbed on this canvas (it would throw `NotFoundError`).
 */
export const touch = async (page: Page, steps: readonly TouchStep[]): Promise<void> => {
  // No scrolling here: the points were measured by `worldToPage`, and a scroll would move them.
  await canvasHost(page)
    .locator("canvas")
    .first()
    .evaluate(
      async (element, { played, touchIdBase }) => {
        element.setPointerCapture = () => {
          // Synthetic pointers cannot be captured; the events go to this canvas anyway.
        };
        const kinds = { down: "pointerdown", move: "pointermove", up: "pointerup" } as const;
        for (const step of played) {
          if (step.type === "wait") {
            const { promise, resolve } = Promise.withResolvers<void>();
            setTimeout(resolve, step.ms);
            await promise;
          } else {
            element.dispatchEvent(
              new PointerEvent(kinds[step.type], {
                bubbles: true,
                cancelable: true,
                composed: true,
                pointerId: touchIdBase + step.id,
                pointerType: "touch",
                isPrimary: step.id === 1,
                button: step.type === "move" ? -1 : 0,
                buttons: step.type === "up" ? 0 : 1,
                clientX: step.at.x,
                clientY: step.at.y,
              }),
            );
          }
        }
      },
      { played: steps, touchIdBase: TOUCH_ID_BASE },
    );
};

/** Enough moves for a drag to read as one, well past the 10 px touch slop. */
const DRAG_MOVES = 8;

/** One finger from `from` to `to` in `DRAG_MOVES` even moves. */
export const fingerDrag = (from: Point, to: Point): readonly TouchStep[] => [
  { type: "down", id: 1, at: from },
  ...Array.from({ length: DRAG_MOVES }, (_unused, index): TouchStep => {
    const share = (index + 1) / DRAG_MOVES;
    return {
      type: "move",
      id: 1,
      at: { x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share },
    };
  }),
  { type: "up", id: 1, at: to },
];

/** Only what the specs read from an exported project file. */
const InstanceSchema = z.object({
  kind: z.object({ type: z.string() }),
  position: z.object({ x: z.number(), y: z.number() }),
});
const ChipSchema = z.object({
  name: z.string(),
  draft: z.object({ instances: z.array(InstanceSchema) }),
});
const ExportedFileSchema = z.object({ project: z.object({ chips: z.array(ChipSchema) }) });

type ExportedFile = z.output<typeof ExportedFileSchema>;

/** Exports the project through the toolbar and reads the downloaded JSON. */
export const exportedProject = async (page: Page): Promise<ExportedFile> => {
  /*
   * WebKit's phone emulation leaves the page panned once the canvas takes focus from Tab, and the
   * next click on the toolbar then misses its press; start from the top.
   */
  await page.evaluate(() => {
    globalThis.scrollTo(0, 0);
  });
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export" }).click();
  const download = await downloadEvent;
  const text = await readFile(await download.path(), "utf-8");
  return ExportedFileSchema.parse(JSON.parse(text));
};

/** The demo NAND's position in an exported project. */
export const nandPosition = (file: ExportedFile): Point | undefined =>
  file.project.chips[0]?.draft.instances.find((instance) => instance.kind.type === "nand")
    ?.position;
