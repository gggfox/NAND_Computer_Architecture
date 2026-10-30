/*
 * Post-build step (ADR 7): writes the web manifest and the Workbox service worker into dist/client.
 * It runs after `vite build` because TanStack Start writes the SPA shell (`_shell.html`) during
 * prerendering, after every bundler hook, so only a post-build step can precache it.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { generateSW } from "workbox-build";

import { themes } from "../src/features/theming/domain/themes.ts";

const CLIENT_DIR = path.resolve(import.meta.dirname, "..", "dist", "client");
const SHELL = "/_shell.html";
const JSON_INDENT = 2;
const { dark } = themes;

const manifest = {
  name: "NAND Computer Architecture",
  short_name: "NAND Sim",
  description: "Build a computer from NAND gates, offline in your browser.",
  start_url: "/",
  scope: "/",
  display: "standalone",
  theme_color: dark.colorBackground,
  background_color: dark.colorBackground,
  icons: [
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
  ],
};

mkdirSync(CLIENT_DIR, { recursive: true });
writeFileSync(
  path.join(CLIENT_DIR, "manifest.webmanifest"),
  `${JSON.stringify(manifest, undefined, JSON_INDENT)}\n`,
);

const { count, size, warnings } = await generateSW({
  globDirectory: CLIENT_DIR,
  globPatterns: ["**/*.{js,css,html,svg,png,webmanifest,woff2}"],
  swDest: path.join(CLIENT_DIR, "sw.js"),
  // Every route is client-rendered from the one shell; _shell.html is not an asset URL, so no `index.html` mapping applies.
  navigateFallback: SHELL,
  cleanupOutdatedCaches: true,
  // AutoUpdate: a new worker takes over immediately instead of waiting for every tab to close.
  skipWaiting: true,
  clientsClaim: true,
});

for (const warning of warnings) {
  console.warn(`[pwa] ${warning}`);
}
console.log(`[pwa] precached ${String(count)} files (${String(size)} bytes), fallback ${SHELL}`);
