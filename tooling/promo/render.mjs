/*
 * Renders the promo video from `storyboard.mjs` and the recorded clips.
 *
 * All formats:   node tooling/promo/render.mjs
 * One format:    node tooling/promo/render.mjs 9x16
 * Still frames:  node tooling/promo/render.mjs 9x16 --still 1.5,5,9.5
 *
 * Each frame is drawn by `stage.html` in a headless browser, then ffmpeg encodes the frames as
 * H.264 MP4 at 30 fps with a silent AAC track (the common upload format; see the research note
 * in docs/research/2026-11-18-short-promo-video.md).
 */
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

import { chromium } from "@playwright/test";

import { BRAND, DURATION, FORMATS, FPS, SCENES } from "./storyboard.mjs";

const ROOT = import.meta.dirname;
const MODULES = path.join(ROOT, "..", "..", "node_modules");
const FONT_DIRS = {
  orbitron: path.join(MODULES, "@fontsource-variable", "orbitron", "files"),
  "chakra-petch": path.join(MODULES, "@fontsource", "chakra-petch", "files"),
};
const TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
};

/** Maps a request path to a file under this folder, or under a font package for `/fonts/`. */
const fileFor = (requestPath) => {
  const parts = decodeURIComponent(requestPath).split("/").filter(Boolean);
  if (parts.some((part) => part.startsWith(".."))) {
    return undefined;
  }
  if (parts[0] === "fonts") {
    const dir = FONT_DIRS[parts[1]];
    return dir === undefined || parts.length !== 3 ? undefined : path.join(dir, parts[2]);
  }
  return path.join(ROOT, ...parts);
};

/** Serves the stage, the clips and the fonts to the headless browser, on a free local port. */
const serve = () =>
  new Promise((resolve) => {
    const server = createServer(async (request, response) => {
      const file = fileFor(new URL(request.url, "http://localhost").pathname);
      const found = file === undefined ? undefined : await stat(file).catch(() => undefined);
      if (found === undefined || !found.isFile()) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, {
        "content-type": TYPES[path.extname(file)] ?? "application/octet-stream",
        "cache-control": "no-store",
      });
      createReadStream(file).pipe(response);
    });
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, origin: `http://127.0.0.1:${String(server.address().port)}` });
    });
  });

const loadClips = async () => {
  const names = new Set(SCENES.flatMap((scene) => scene.devices.map((device) => device.clip)));
  const clips = {};
  for (const name of names) {
    const file = path.join(ROOT, "out", "clips", name, "frames.json");
    const text = await readFile(file, "utf8").catch(() => {
      throw new Error(`Clip "${name}" is missing. Run: node tooling/promo/capture.mjs ${name}`);
    });
    clips[name] = JSON.parse(text);
  }
  return clips;
};

const encoder = (target) => {
  const args = [
    "-y",
    "-loglevel",
    "error",
    "-f",
    "image2pipe",
    "-framerate",
    String(FPS),
    "-i",
    "-",
    "-f",
    "lavfi",
    "-i",
    "anullsrc=channel_layout=stereo:sample_rate=48000",
    "-shortest",
    // The screenshots are full-range JPEG; video players expect limited-range BT.709.
    "-vf",
    "scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p",
    "-color_range",
    "tv",
    "-colorspace",
    "bt709",
    "-color_primaries",
    "bt709",
    "-color_trc",
    "bt709",
    "-c:v",
    "libx264",
    "-profile:v",
    "high",
    "-preset",
    "slow",
    "-crf",
    "13",
    "-maxrate",
    "12M",
    "-bufsize",
    "24M",
    "-g",
    String(FPS * 2),
    "-flags",
    "+cgop",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    target,
  ];
  const child = spawn("ffmpeg", args, { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg failed with code ${String(code)}`));
      }
    });
  });
  const write = (buffer) =>
    new Promise((resolve) => {
      if (child.stdin.write(buffer)) {
        resolve();
      } else {
        child.stdin.once("drain", resolve);
      }
    });
  return { write, finish: () => (child.stdin.end(), done) };
};

const renderFormat = async ({ browser, origin, clips, format, stills }) => {
  const { width, height } = FORMATS[format];
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on("pageerror", (error) => {
    console.error(`stage error: ${error.message}`);
  });
  await page.goto(`${origin}/stage.html`);
  await page.evaluate((input) => globalThis.setup(input), {
    format,
    formats: FORMATS,
    brand: BRAND,
    scenes: SCENES,
    clips,
  });
  const cdp = await context.newCDPSession(page);
  const frame = async (time, type) => {
    await page.evaluate((at) => globalThis.renderFrame(at), time);
    const shot = await cdp.send("Page.captureScreenshot", {
      format: type,
      ...(type === "jpeg" ? { quality: 97 } : {}),
    });
    return Buffer.from(shot.data, "base64");
  };
  const out = path.join(ROOT, "out");
  if (stills !== undefined) {
    await mkdir(path.join(out, "stills"), { recursive: true });
    for (const time of stills) {
      const target = path.join(out, "stills", `${format}-${time.toFixed(2)}.png`);
      await writeFile(target, await frame(time, "png"));
      console.log(target);
    }
  } else {
    const target = path.join(out, `promo-${format}.mp4`);
    const video = encoder(target);
    const total = Math.round(DURATION * FPS);
    for (let index = 0; index < total; index += 1) {
      await video.write(await frame(index / FPS, "jpeg"));
      if (index % 90 === 0) {
        console.log(`${format}: frame ${String(index)} of ${String(total)}`);
      }
    }
    await video.finish();
    console.log(target);
  }
  await context.close();
};

const args = process.argv.slice(2);
const stillAt = args.indexOf("--still");
const stills = stillAt === -1 ? undefined : args[stillAt + 1].split(",").map(Number);
const named = args.filter((arg, index) => arg in FORMATS && index !== stillAt + 1);
const formats = named.length === 0 ? Object.keys(FORMATS) : named;

const { server, origin } = await serve();
const browser = await chromium.launch();
try {
  const clips = await loadClips();
  for (const format of formats) {
    await renderFormat({ browser, origin, clips, format, stills });
  }
} finally {
  await browser.close();
  server.close();
}
