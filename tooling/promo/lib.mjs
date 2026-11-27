/*
 * Shared helpers for the promo capture: device presets, a visible pointer, paced pointer moves and
 * a frame recorder. The capture drives the real app with Playwright (see README.md).
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export const ROOT = import.meta.dirname;
export const OUT = path.join(ROOT, "out");
export const BASE_URL = process.env.PROMO_URL ?? "http://localhost:5173";

/** The three devices. `scale` is the device pixel ratio of the recorded frames. */
export const DEVICES = {
  desktop: { viewport: { width: 1280, height: 800 }, scale: 1.5, pointer: "arrow" },
  tablet: { viewport: { width: 1180, height: 820 }, scale: 1.5, pointer: "touch" },
  phone: { viewport: { width: 390, height: 844 }, scale: 3, pointer: "touch" },
};

export const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** Runs in the page: draws a pointer that follows the mouse, with a ring on each press. */
const pointerScript = (kind) => {
  const install = () => {
    if (document.querySelector("#promo-pointer") !== null) {
      return;
    }
    const pointer = document.createElement("div");
    pointer.id = "promo-pointer";
    const touch = kind === "touch";
    pointer.innerHTML = touch
      ? '<div class="dot"></div><div class="ring"></div>'
      : '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2 L4 20 L9 15.5 L12.2 22.5 L15 21.2 L11.8 14.4 L18.5 14.2 Z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg><div class="ring"></div>';
    const style = document.createElement("style");
    style.textContent = `
      #promo-pointer { position: fixed; left: 0; top: 0; z-index: 2147483647; pointer-events: none;
        opacity: 0; transition: opacity 120ms linear; will-change: transform; }
      #promo-pointer.on { opacity: 1; }
      #promo-pointer svg { position: absolute; left: -4px; top: -2px;
        filter: drop-shadow(0 2px 3px rgb(0 0 0 / 60%)); }
      #promo-pointer .dot { position: absolute; left: -17px; top: -17px; width: 34px; height: 34px;
        border-radius: 50%; background: rgb(255 255 255 / 28%); border: 2px solid rgb(255 255 255 / 85%);
        box-shadow: 0 0 12px rgb(0 0 0 / 50%); transition: transform 90ms ease-out; }
      #promo-pointer.down .dot { transform: scale(0.72); background: rgb(255 255 255 / 55%); }
      #promo-pointer .ring { position: absolute; left: -22px; top: -22px; width: 44px; height: 44px;
        border-radius: 50%; border: 2px solid #ffa31a; opacity: 0; }
      #promo-pointer.pulse .ring { animation: promo-ring 420ms ease-out; }
      @keyframes promo-ring { from { opacity: 0.9; transform: scale(0.3); } to { opacity: 0; transform: scale(1.25); } }
    `;
    document.documentElement.append(style, pointer);
    const move = (event) => {
      pointer.style.transform = `translate(${String(event.clientX)}px, ${String(event.clientY)}px)`;
    };
    globalThis.addEventListener("mousemove", move, true);
    globalThis.addEventListener(
      "mousedown",
      (event) => {
        move(event);
        pointer.classList.add("down");
        pointer.classList.remove("pulse");
        void pointer.offsetWidth;
        pointer.classList.add("pulse");
      },
      true,
    );
    globalThis.addEventListener("mouseup", () => pointer.classList.remove("down"), true);
    globalThis.promoPointer = (visible) => pointer.classList.toggle("on", visible);
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install);
  } else {
    install();
  }
};

/**
 * Opens a page for `device` with the visible pointer installed. `pace` slows every pointer move
 * and wait by that factor; the recorder divides the frame times by it. The recorder takes about
 * 19 frames each second, so a pace of 2 gives about 38 frames for each second of video.
 */
export const openDevice = async (browser, device, pace = 1) => {
  const { viewport, scale, pointer } = DEVICES[device];
  const context = await browser.newContext({ viewport, deviceScaleFactor: scale });
  const page = await context.newPage();
  await page.addInitScript(pointerScript, pointer);
  const state = { x: viewport.width / 2, y: viewport.height / 2 };
  return { page, context, state, device, viewport, pace };
};

/** Waits `ms` of video time. */
export const wait = (session, ms) => sleep(ms * session.pace);

const ease = (value) => (value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2);
const FRAME_MS = 16;

/** Moves the pointer to `to` in `ms` of video time, with an ease. */
export const glide = async (session, to, ms = 450) => {
  const { page, state } = session;
  const from = { ...state };
  const steps = Math.max(2, Math.round((ms * session.pace) / FRAME_MS));
  for (let step = 1; step <= steps; step += 1) {
    const share = ease(step / steps);
    await page.mouse.move(from.x + (to.x - from.x) * share, from.y + (to.y - from.y) * share);
    await sleep(FRAME_MS);
  }
  state.x = to.x;
  state.y = to.y;
};

export const showPointer = (session, visible = true) =>
  session.page.evaluate((on) => globalThis.promoPointer?.(on), visible);

/** The centre of a locator, as a viewport point. */
export const centreOf = async (locator) => {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error(`Not visible: ${String(locator)}`);
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

const pointOf = (target) => ("x" in target ? target : centreOf(target));

/** Glides to a point or locator, then presses there. */
export const press = async (session, target, { ms = 450, hold = 70, after = 250 } = {}) => {
  await glide(session, await pointOf(target), ms);
  await session.page.mouse.down();
  await wait(session, hold);
  await session.page.mouse.up();
  await wait(session, after);
};

/** Glides to a point, holds like a long press, then opens the context menu there. */
export const longPress = async (session, target, { ms = 450, hold = 380, after = 350 } = {}) => {
  const at = await pointOf(target);
  await glide(session, at, ms);
  const setDown = (down) =>
    session.page.evaluate(
      (on) => document.querySelector("#promo-pointer")?.classList.toggle("down", on),
      down,
    );
  await setDown(true);
  await wait(session, hold);
  await session.page.mouse.click(at.x, at.y, { button: "right" });
  await setDown(false);
  await wait(session, after);
};

/** Glides to `from`, presses, drags to `to` and releases. */
export const drag = async (session, from, to, { ms = 450, dragMs = 700, after = 250 } = {}) => {
  await glide(session, from, ms);
  await session.page.mouse.down();
  await wait(session, 90);
  await glide(session, to, dragMs);
  await wait(session, 90);
  await session.page.mouse.up();
  await wait(session, after);
};

/** Mirrors `SCREEN_PAD` in `domain/camera.ts`: world (0, 0) at zoom 1 sits 48 px in. */
const SCREEN_PAD = 48;

/** A world point as a viewport point, from the camera in the URL and the canvas box. */
export const worldToPage = async (page, world) => {
  const box = await page.getByRole("application").locator("canvas").first().boundingBox();
  if (box === null) {
    throw new Error("The canvas is not visible");
  }
  const search = new URL(page.url()).searchParams;
  const read = (name, fallback) =>
    search.get(name) === null ? fallback : Number(search.get(name));
  const zoom = read("zoom", 1);
  return {
    x: box.x + SCREEN_PAD + (world.x - read("x", 0)) * zoom,
    y: box.y + SCREEN_PAD + (world.y - read("y", 0)) * zoom,
  };
};

/**
 * The parts of the open chip's draft, read from the app's own storage (IndexedDB). A drag snaps
 * to the grid, so the capture reads the real positions before it wires the parts.
 */
export const openChipParts = async (page) => {
  await sleep(500);
  const url = new URL(page.url());
  const projectId = url.pathname.split("/").at(-1);
  const chipId = url.searchParams.get("chip");
  return page.evaluate(
    async ({ project, chip }) => {
      const request = (source) =>
        new Promise((resolve, reject) => {
          source.addEventListener("success", () => resolve(source.result));
          source.addEventListener("error", () => reject(source.error));
        });
      for (const { name } of await indexedDB.databases()) {
        const db = await request(indexedDB.open(name));
        const found = db.objectStoreNames.contains("projects")
          ? await request(db.transaction("projects").objectStore("projects").get(project))
          : undefined;
        db.close();
        if (typeof found === "string") {
          const { chips, lastOpenedChipId } = JSON.parse(found).project;
          const open = chips.find((item) => item.id === (chip ?? lastOpenedChipId));
          return open?.draft.instances ?? [];
        }
      }
      return [];
    },
    { project: projectId, chip: chipId },
  );
};

/** Pin anchors in world units, by part position (see `domain/chip-layout.ts`). */
export const pins = {
  nand: ({ x, y }) => ({
    a: { x, y: y + 20 },
    b: { x, y: y + 60 },
    out: { x: x + 120, y: y + 40 },
    body: { x: x + 60, y: y + 40 },
  }),
  input: ({ x, y }) => ({ pin: { x: x + 40, y: y + 20 }, body: { x: x + 20, y: y + 20 } }),
  output: ({ x, y }) => ({ pin: { x, y: y + 20 }, body: { x: x + 20, y: y + 20 } }),
};

/**
 * Records the page as JPEG frames at the device's pixel density, with the video time of each
 * frame. The rate is not fixed, so `frames.json` keeps each frame's time.
 */
export const record = async (session, name) => {
  const dir = path.join(OUT, "clips", name);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const cdp = await session.context.newCDPSession(session.page);
  const { viewport, scale } = DEVICES[session.device];
  const clip = { x: 0, y: 0, ...viewport, scale };
  const frames = [];
  const marks = {};
  const writes = [];
  const start = Date.now();
  const now = () => Number(((Date.now() - start) / 1000 / session.pace).toFixed(3));
  let running = true;
  const loop = (async () => {
    while (running) {
      const time = now();
      // The clip rectangle is in page coordinates, so it must follow the page when it scrolls.
      const scroll = await cdp
        .send("Runtime.evaluate", { expression: "globalThis.scrollY", returnByValue: true })
        .catch(() => undefined);
      clip.y = scroll?.result.value ?? 0;
      // The page closes under the loop when a clip fails; the clip's own error is the useful one.
      const shot = await cdp
        .send("Page.captureScreenshot", {
          format: "jpeg",
          quality: 92,
          optimizeForSpeed: true,
          clip,
        })
        .catch(() => undefined);
      if (shot === undefined) {
        return;
      }
      const file = `f${String(frames.length).padStart(5, "0")}.jpg`;
      frames.push({ file, t: time });
      writes.push(writeFile(path.join(dir, file), Buffer.from(shot.data, "base64")));
    }
  })();
  return {
    /** Names the current video time, so the storyboard can cut on it. */
    mark: (label) => {
      marks[label] = now();
    },
    stop: async () => {
      const duration = now();
      running = false;
      await loop;
      await Promise.all(writes);
      const meta = { name, device: session.device, viewport, scale, duration, marks, frames };
      await writeFile(path.join(dir, "frames.json"), JSON.stringify(meta));
      console.log(`${name}: ${String(frames.length)} frames, ${duration.toFixed(1)} s`, marks);
    },
  };
};

const either = (english, spanish) => new RegExp(`^(${english}|${spanish})$`, "u");

export const toolbar = (page) =>
  page.getByRole("toolbar", { name: either("Editor tools", "Herramientas del editor") });

/** Presses a toolbar tool; on a phone it can be in the More tools menu. */
export const tool = async (page, english, spanish) => {
  const name = either(english, spanish);
  const more = toolbar(page).getByRole("button", {
    name: either("More tools", "Más herramientas"),
  });
  if (await more.isVisible()) {
    await more.click();
    await page.getByRole("menuitem", { name }).click();
    return;
  }
  await toolbar(page).getByRole("button", { name }).click();
};

/** Sets the app language to Spanish and the theme to Amber (Amber is the default). */
export const useSpanish = async (page) => {
  await page.getByRole("button", { name: /(Language|Idioma)$/u }).click();
  await page.getByRole("option", { name: "Español" }).click();
  await page.getByRole("button", { name: /Idioma$/u }).waitFor();
};

/** Opens the index, switches to Spanish and creates the demo project. */
export const newProject = async (page) => {
  await page.goto(`${BASE_URL}/`);
  await page.getByRole("button", { name: either("New project", "Nuevo proyecto") }).waitFor();
  await useSpanish(page);
  await page.getByRole("button", { name: "Nuevo proyecto" }).click();
  await page.waitForURL(/\/projects\//u);
  await page.getByRole("application").waitFor();
};

/** Creates a project, then imports `showcase.json` through the toolbar. */
export const importShowcase = async (page) => {
  await newProject(page);
  const chooser = page.waitForEvent("filechooser");
  await tool(page, "Import", "Importar");
  await (await chooser).setFiles(path.join(ROOT, "showcase.json"));
  await page.getByRole("heading", { level: 1, name: "Calculadora NAND" }).waitFor({
    state: "attached",
  });
  await sleep(400);
};
