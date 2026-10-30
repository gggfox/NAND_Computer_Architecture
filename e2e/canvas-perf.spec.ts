/* oxlint-disable eslint/id-length -- `x` and `y` are coordinate names */
import path from "node:path";

import { devices } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  canvasHost,
  createProject,
  expect,
  spoken,
  test,
  TOUCH_ID_BASE,
  worldToPage,
} from "./support";

/*
 * The drag budget (Phase 2 plan, Task 13): a 50-chip selection dragged for 2 s on a 300-chip,
 * 600-wire circuit, on an emulated Pixel 7 with the CPU slowed 4×, keeps the 95th-percentile
 * frame within 20 ms. Too noisy for shared CI runners: run it with `pnpm e2e:perf`.
 */

const FIXTURE = path.join(import.meta.dirname, "fixtures", "300-chips.json");
const CPU_SLOWDOWN = 4;
const DRAG_MS = 2000;
const BUDGET_MS = 20;
const P95 = 0.95;
const ZOOM_OUT_PRESSES = 8;
const SELECTED = 50;
/** The fixture lays NANDs (120 × 80) out 20 to a row, 200 apart across and 120 down. */
const COLUMNS = 20;
const PITCH = { x: 200, y: 120 };
const NAND_CENTRE = { x: 60, y: 40 };
/** The drag sweeps this far right and back once a second, and ends this far right. */
const SWEEP_PX = 80;

/* CPU throttling needs the Chrome DevTools Protocol; skipping here keeps the Pixel 7 emulation
 * below off every other project. */
test.skip(({ browserName }) => browserName !== "chromium", "Needs the Chrome DevTools Protocol");

const { defaultBrowserType: _browser, ...pixel7 } = devices["Pixel 7"];
test.use(pixel7);

const percentile = (values: readonly number[], rank: number): number => {
  const sorted = values.toSorted((first, second) => first - second);
  return sorted[Math.min(sorted.length - 1, Math.floor(rank * sorted.length))] ?? Infinity;
};

const importFixture = async (page: Page): Promise<void> => {
  const chooserEvent = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import" }).click();
  const chooser = await chooserEvent;
  await chooser.setFiles(FIXTURE);
  await expect(page.getByText("NAND gate 300", { exact: true })).toBeAttached();
};

/** Zooms right out, then selects the first chips in canvas order: `]`, then Shift+`]` (`}`). */
const selectFirstChips = async (page: Page): Promise<void> => {
  await canvasHost(page).focus();
  for (let press = 0; press < ZOOM_OUT_PRESSES; press += 1) {
    await page.keyboard.press("-");
  }
  await page.keyboard.press("]");
  for (let press = 1; press < SELECTED; press += 1) {
    await page.keyboard.press("}");
  }
  await expect(spoken(page)).toHaveText(new RegExp(`Items selected: ${String(SELECTED)}`, "u"));
};

interface DragPlan {
  readonly at: { readonly x: number; readonly y: number };
  readonly durationMs: number;
  readonly sweep: number;
  readonly touchId: number;
}

/**
 * Runs in the page: one finger drags from `at` for `durationMs`, moving once per animation frame,
 * and the time between frames is sampled. Pointer capture is stubbed, as in `touch`.
 */
const dragAndSample = async (
  canvas: HTMLElement,
  { at, durationMs, sweep, touchId }: DragPlan,
): Promise<readonly number[]> => {
  const second = 1000;
  canvas.setPointerCapture = () => {
    // A synthetic pointer cannot be captured; the events go to this canvas anyway.
  };
  const fire = (type: string, x: number): void => {
    canvas.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: touchId,
        pointerType: "touch",
        isPrimary: true,
        buttons: type === "pointerup" ? 0 : 1,
        clientX: x,
        clientY: at.y,
      }),
    );
  };
  fire("pointerdown", at.x);
  const samples: number[] = [];
  const start = performance.now();
  let previous = start;
  const { promise, resolve } = Promise.withResolvers<void>();
  const frame = (now: number): void => {
    samples.push(now - previous);
    previous = now;
    // A triangle wave: out to `sweep` and back each second.
    const phase = ((now - start) % second) / second;
    fire("pointermove", at.x + sweep * (1 - Math.abs(1 - phase - phase)));
    if (now - start < durationMs) {
      requestAnimationFrame(frame);
    } else {
      resolve();
    }
  };
  requestAnimationFrame(frame);
  await promise;
  // End to the right of the grab, so the drag lands as a real move.
  fire("pointermove", at.x + sweep);
  fire("pointerup", at.x + sweep);
  // The first sample is the wait for the first frame, not a frame.
  return samples.slice(1);
};

test(
  "dragging 50 of 300 chips keeps p95 frames within 20 ms",
  { tag: "@perf" },
  async ({ page }, testInfo) => {
    await createProject(page);
    await importFixture(page);
    await selectFirstChips(page);

    // The last chip selected was brought into view; grab it by its centre.
    const last = SELECTED - 1;
    const grab = await worldToPage(page, {
      x: (last % COLUMNS) * PITCH.x + NAND_CENTRE.x,
      y: Math.floor(last / COLUMNS) * PITCH.y + NAND_CENTRE.y,
    });

    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_SLOWDOWN });
    const deltas = await canvasHost(page)
      .locator("canvas")
      .first()
      .evaluate(dragAndSample, {
        at: grab,
        durationMs: DRAG_MS,
        sweep: SWEEP_PX,
        touchId: TOUCH_ID_BASE + 1,
      });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });

    await expect(spoken(page)).toHaveText(new RegExp(`Chips moved: ${String(SELECTED)}`, "u"));
    const p95 = percentile(deltas, P95);
    const summary = `frames ${String(deltas.length)}, p95 ${p95.toFixed(1)} ms, max ${Math.max(...deltas).toFixed(1)} ms`;
    testInfo.annotations.push({ type: "drag frames", description: summary });
    console.log(`@perf drag: ${summary}`);
    expect(p95).toBeLessThanOrEqual(BUDGET_MS);
  },
);
