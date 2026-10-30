import { defineConfig, devices } from "@playwright/test";

/*
 * E2E against the production build (ADR 21, 32, 34). The service worker only exists after
 * `pnpm build`, so the offline test needs the preview server, not `vite dev`.
 */
const PORT = 4319;
// Matches `preview.host` in vite.config.ts.
const BASE_URL = `http://127.0.0.1:${String(PORT)}`;
const isCI = "CI" in process.env;
const CI_RETRIES = 2;
const BUILD_TIMEOUT_MS = 300_000;
const VISUAL_SPEC = "visual.spec.ts";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? CI_RETRIES : 0,
  reporter: isCI ? [["list"], ["html", { open: "never" }]] : "list",
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] }, testIgnore: VISUAL_SPEC },
    { name: "webkit", use: { ...devices["Desktop Safari"] }, testIgnore: VISUAL_SPEC },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] }, testIgnore: VISUAL_SPEC },
    { name: "mobile-safari", use: { ...devices["iPhone 15"] }, testIgnore: VISUAL_SPEC },
    { name: "tablet-safari", use: { ...devices["iPad Pro 11"] }, testIgnore: VISUAL_SPEC },
  ],
  webServer: {
    command: `pnpm build && pnpm preview --port ${String(PORT)} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !isCI,
    timeout: BUILD_TIMEOUT_MS,
  },
});
