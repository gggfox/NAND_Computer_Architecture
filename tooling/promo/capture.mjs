/*
 * Records the app footage for the promo video. Each clip drives the real app in Spanish, in the
 * Amber theme, on one device size. The dev server must run first (`pnpm dev --port 5173`).
 *
 * Run all clips:  node tooling/promo/capture.mjs
 * Run some clips: node tooling/promo/capture.mjs build dive
 */
import { chromium } from "@playwright/test";

import {
  drag,
  glide,
  importShowcase,
  longPress,
  newProject,
  openChipParts,
  openDevice,
  pins,
  press,
  record,
  showPointer,
  sleep,
  tool,
  toolbar,
  wait,
  worldToPage,
} from "./lib.mjs";

/** The URL keeps the camera; it is written a moment after the view changes. */
const CAMERA_SETTLE_MS = 350;

const at = async (page, world) => {
  await sleep(CAMERA_SETTLE_MS);
  return worldToPage(page, world);
};

/** The switch of the 1-bit input number `index` in the Pins panel, by its visible track. */
const inputSwitch = (page, index) =>
  page.getByRole("grid", { name: "Entradas" }).getByRole("switch").nth(index).locator("xpath=..");

/** Desktop: the 4-bit adder runs while the values of A and B go up. */
const sim = async (browser) => {
  const session = await openDevice(browser, "desktop", 2);
  const { page } = session;
  await importShowcase(page);
  await tool(page, "Fit", "Ajustar");
  const inputs = page.getByRole("grid", { name: "Entradas" });
  const more = inputs.getByRole("button", { name: "Aumentar" });
  await more.first().scrollIntoViewIfNeeded();
  await glide(session, await at(page, { x: 760, y: 560 }), 100);
  await showPointer(session);
  const clip = await record(session, "sim");
  await wait(session, 400);
  clip.mark("a");
  for (let count = 0; count < 5; count += 1) {
    await press(session, more.first(), { ms: count === 0 ? 500 : 60, after: 230 });
  }
  clip.mark("b");
  for (let count = 0; count < 6; count += 1) {
    await press(session, more.nth(1), { ms: count === 0 ? 380 : 60, after: 230 });
  }
  clip.mark("carry");
  await press(session, inputSwitch(page, 0), { ms: 420, after: 500 });
  for (let count = 0; count < 5; count += 1) {
    await press(session, more.first(), { ms: count === 0 ? 420 : 60, after: 230 });
  }
  await wait(session, 700);
  await clip.stop();
  await session.context.close();
};

/** Fails the capture when the simulation gives a wrong value: the video must show a true result. */
const expectOutput = async (page, name, value) => {
  const wanted = `Salida ${name}: ${String(value)}`;
  const shown = page.getByText(new RegExp(`^Salida ${name}: `, "u")).first();
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if ((await shown.textContent()) === wanted) {
      return;
    }
    await sleep(50);
  }
  throw new Error(`Expected "${wanted}", but the app shows "${String(await shown.textContent())}"`);
};

/** Desktop: tests the 4-bit adder. 5 + 3 = 8, then carry in gives 9, then 5 + 10 + 1 overflows. */
const test = async (browser) => {
  const session = await openDevice(browser, "desktop", 2);
  const { page } = session;
  await importShowcase(page);
  await tool(page, "Fit", "Ajustar");
  const inputs = page.getByRole("grid", { name: "Entradas" });
  // The panel then shows the inputs and the outputs together.
  await inputs.evaluate((grid) => {
    grid.scrollIntoView({ block: "start" });
  });
  const more = inputs.getByRole("button", { name: "Aumentar" });
  await glide(session, await at(page, { x: 560, y: 600 }), 100);
  await showPointer(session);
  const clip = await record(session, "test");
  await wait(session, 400);
  const add = async (which, times, firstMs) => {
    for (let count = 0; count < times; count += 1) {
      await press(session, more.nth(which), { ms: count === 0 ? firstMs : 60, after: 240 });
    }
  };
  clip.mark("a");
  await add(0, 5, 500);
  clip.mark("b");
  await add(1, 3, 380);
  await expectOutput(page, "SUMA", 8);
  await wait(session, 800);
  clip.mark("carry");
  await press(session, inputSwitch(page, 0), { ms: 420, after: 300 });
  await expectOutput(page, "SUMA", 9);
  await wait(session, 600);
  clip.mark("overflow");
  await add(1, 7, 420);
  await expectOutput(page, "SUMA", 0);
  await expectOutput(page, "ACARREO", 1);
  await wait(session, 1000);
  await clip.stop();
  await session.context.close();
};

/** The demo project's parts, in world units (see `e2e/support.ts`). */
const DEMO = {
  nand: { x: 160, y: 40 },
  output: { x: 320, y: 60 },
  added: { x: 480, y: 0 },
};
const BUILT = { nand: { x: 360, y: 40 }, output: { x: 640, y: 60 } };

/** Desktop: turns the demo NAND into an AND gate: add a NAND, move parts, wire, test. */
const build = async (browser) => {
  const session = await openDevice(browser, "desktop", 3);
  const { page } = session;
  await newProject(page);
  const point = (world) => at(page, world);
  await glide(session, await point({ x: 420, y: 300 }), 100);
  await showPointer(session);
  const clip = await record(session, "build");
  await wait(session, 300);

  clip.mark("add");
  await press(session, toolbar(page).getByRole("button", { name: "Añadir NAND" }));

  clip.mark("unwire");
  await press(session, await point({ x: 300, y: 80 }));
  await press(session, toolbar(page).getByRole("button", { name: "Eliminar", exact: true }));

  clip.mark("move");
  await drag(
    session,
    await point(pins.output(DEMO.output).body),
    await point(pins.output(BUILT.output).body),
  );
  await drag(
    session,
    await point(pins.nand(DEMO.added).body),
    await point(pins.nand(BUILT.nand).body),
  );

  clip.mark("wire");
  const parts = await openChipParts(page);
  const moved = (type, near) =>
    parts
      .filter((part) => part.kind.type === type)
      .toSorted(
        (one, two) => Math.abs(one.position.x - near.x) - Math.abs(two.position.x - near.x),
      )[0].position;
  const first = pins.nand(DEMO.nand);
  const second = pins.nand(moved("nand", BUILT.nand));
  const out = pins.output(moved("pin", BUILT.output));
  for (const [from, to] of [
    [first.out, second.a],
    [first.out, second.b],
    [second.out, out.pin],
  ]) {
    await press(session, await point(from), { ms: 380, after: 120 });
    await press(session, await point(to), { ms: 380, after: 200 });
  }

  clip.mark("test");
  await press(session, inputSwitch(page, 0), { ms: 500, after: 350 });
  await press(session, inputSwitch(page, 1), { ms: 300, after: 900 });
  await clip.stop();
  await session.context.close();
};

const libraryToggle = (page) => page.getByRole("button", { name: "Biblioteca", exact: true });
const libraryRow = (page, name) =>
  page.getByRole("treegrid", { name: "Chips" }).getByRole("row").filter({ hasText: name });

/** Tablet: opens the library and places two saved chips in a new chip. */
const place = async (browser) => {
  const session = await openDevice(browser, "tablet", 2);
  const { page } = session;
  await importShowcase(page);
  await libraryToggle(page).click();
  await page.getByRole("button", { name: "Nuevo chip", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Nuevo chip" });
  await dialog.getByRole("textbox").first().fill("ALU");
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await dialog.waitFor({ state: "detached" });
  if ((await libraryToggle(page).getAttribute("aria-expanded")) === "true") {
    await libraryToggle(page).click();
  }
  await sleep(400);
  await glide(session, { x: 600, y: 560 }, 100);
  await showPointer(session);
  const clip = await record(session, "place");
  await wait(session, 300);

  clip.mark("library");
  await press(session, libraryToggle(page), { after: 400 });
  await press(session, libraryRow(page, "Aritmética"), { after: 350 });
  clip.mark("arm");
  await press(session, libraryRow(page, "Sumador completo"), { after: 400 });
  clip.mark("place");
  await press(session, await at(page, { x: 140, y: 80 }), { after: 350 });
  await press(session, await at(page, { x: 140, y: 280 }), { after: 350 });
  await press(session, page.getByRole("button", { name: "Listo", exact: true }), { after: 300 });
  clip.mark("close");
  await press(session, libraryToggle(page), { after: 900 });
  await clip.stop();
  await session.context.close();
};

/** How far the phone clip scrolls the page before it opens the Pins sheet, in CSS pixels. */
const SHEET_SCROLL_PX = 230;
const SCROLL_MS = 600;
const STEP_MS = 16;

/** Scrolls the page to `top` like a swipe: the pointer moves up while the page follows. */
const swipeTo = async (session, top) => {
  const { page, state, pace } = session;
  const from = await page.evaluate(() => globalThis.scrollY);
  const steps = Math.round((SCROLL_MS * pace) / STEP_MS);
  const start = { x: 300, y: 620 };
  await glide(session, start, 300);
  for (let step = 1; step <= steps; step += 1) {
    const share = 1 - (1 - step / steps) ** 3;
    await page.evaluate(
      (to) => {
        globalThis.scrollTo(0, to);
      },
      from + (top - from) * share,
    );
    await page.mouse.move(start.x, start.y - 220 * share);
    await sleep(STEP_MS);
  }
  state.x = start.x;
  state.y = start.y - 220;
  await wait(session, 200);
};

/** Where to press in each chip to look inside the next one, in world units. */
const DIVE_STEPS = [
  { mark: "full-adder", at: { x: 380, y: 260 } },
  { mark: "half-adder", at: { x: 230, y: 60 } },
  { mark: "xor", at: { x: 200, y: 60 } },
];

/** Fits the circuit in the view with the `0` key. */
const fit = async (page) => {
  await page.getByRole("application").focus();
  await page.keyboard.press("0");
};

/** Phone: looks inside the adder, three levels down, to the NAND gates. */
const dive = async (browser) => {
  const session = await openDevice(browser, "phone", 2);
  const { page } = session;
  await importShowcase(page);
  await fit(page);
  await glide(session, { x: 200, y: 700 }, 100);
  await showPointer(session);
  const clip = await record(session, "dive");
  await wait(session, 500);
  for (const step of DIVE_STEPS) {
    clip.mark(step.mark);
    await longPress(session, await at(page, step.at));
    await press(session, page.getByRole("menuitem", { name: "Ver por dentro" }), { after: 150 });
    await fit(page);
    await wait(session, 700);
  }
  // Scroll, so the gates stay in view above the Pins sheet, then open the sheet.
  clip.mark("panel");
  await swipeTo(session, SHEET_SCROLL_PX);
  await press(session, page.getByRole("button", { name: /^Pines \d+$/u }), { after: 450 });

  // The truth table of XOR: 1 and 0 give 1; 1 and 1 give 0; 0 and 1 give 1.
  clip.mark("test");
  await press(session, inputSwitch(page, 0), { ms: 420, after: 250 });
  await expectOutput(page, "OUT", 1);
  await wait(session, 450);
  await press(session, inputSwitch(page, 1), { ms: 320, after: 250 });
  await expectOutput(page, "OUT", 0);
  await wait(session, 450);
  await press(session, inputSwitch(page, 0), { ms: 320, after: 250 });
  await expectOutput(page, "OUT", 1);
  await wait(session, 900);
  await clip.stop();
  await session.context.close();
};

const CLIPS = { sim, build, test, place, dive };

const wanted = process.argv.slice(2);
const names = wanted.length === 0 ? Object.keys(CLIPS) : wanted;
const browser = await chromium.launch();
try {
  for (const name of names) {
    const run = CLIPS[name];
    if (run === undefined) {
      throw new Error(`Unknown clip "${name}". Clips: ${Object.keys(CLIPS).join(", ")}`);
    }
    await run(browser);
  }
} finally {
  await browser.close();
}
