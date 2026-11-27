/*
 * The promo video, as data. Edit this file to change the text, the timing or the camera, then
 * run `node tooling/promo/render.mjs`. The footage comes from `capture.mjs` (see README.md).
 *
 * Times are in seconds. A pose places one device in the frame:
 *   w        screen width, as a share of the frame width (more than 1 is a close view)
 *   u, v     a point on the device screen (0 to 1 from its left and top)
 *   x, y     where that point sits in the frame (0 to 1 from the frame's left and top)
 *   rx ry rz the device's rotation in degrees
 * Each device moves from `from` to `to` during its scene.
 *
 * A device can have an `inset`: a close view of one part of its screen. `crop` is that part
 * (shares of the screen), `at` is when it shows (seconds into the scene), and each format gives
 * its centre (`x`, `y`) and its width (`w`) as shares of the frame.
 */

export const FPS = 30;

/** The three master files. `safe` is the area that holds text, in pixels (Meta's Reels numbers). */
export const FORMATS = {
  "9x16": { width: 1080, height: 1920, safe: { top: 269, bottom: 672, side: 65 } },
  "4x5": { width: 1080, height: 1350, safe: { top: 68, bottom: 68, side: 54 } },
  "16x9": { width: 1920, height: 1080, safe: { top: 54, bottom: 54, side: 96 } },
};

export const BRAND = {
  name: "Gerardo Galan Garzafox",
  tagline: "Desarrollo de software y apps web",
  /** The end card. `*word*` marks the words in the accent colour. */
  cta: "¿Tienes una idea? *La construimos.*",
  /** The contact lines of the end card. */
  contacts: [
    { label: "WhatsApp", value: "+52 81 1490 6208" },
    { label: "Correo", value: "gerardogalangarzafox@gmail.com" },
  ],
  badges: ["Tiempo real", "Sin conexión", "Accesible", "Español · Inglés"],
};

/** The Pins panel of the desktop clips, as shares of the screen: the switches and the outputs. */
const BUILD_PANEL = { x: 0.722, y: 0.5, w: 0.262, h: 0.335 };
const TEST_PANEL = { x: 0.722, y: 0.257, w: 0.262, h: 0.53 };

export const SCENES = [
  {
    id: "hook",
    start: 0,
    end: 2.7,
    kicker: "Apps web a medida",
    title: "Software que se siente *vivo*",
    devices: [
      {
        device: "desktop",
        clip: "sim",
        play: [{ from: 0.3, to: 6.6, dur: 2.7 }],
        "9x16": {
          from: { w: 1.5, u: 0.4, v: 0.5, x: 0.5, y: 0.56, rx: 10, ry: -24, rz: 2 },
          to: { w: 1.32, u: 0.47, v: 0.5, x: 0.5, y: 0.56, rx: 5, ry: -10, rz: 0 },
        },
        "4x5": {
          from: { w: 1.4, u: 0.42, v: 0.5, x: 0.5, y: 0.6, rx: 10, ry: -24, rz: 2 },
          to: { w: 1.22, u: 0.5, v: 0.5, x: 0.5, y: 0.6, rx: 5, ry: -10, rz: 0 },
        },
        "16x9": {
          from: { w: 0.66, u: 0.5, v: 0.5, x: 0.64, y: 0.5, rx: 10, ry: -26, rz: 2 },
          to: { w: 0.6, u: 0.5, v: 0.5, x: 0.66, y: 0.5, rx: 5, ry: -12, rz: 0 },
        },
      },
    ],
  },
  {
    id: "build",
    start: 2.5,
    end: 7.1,
    kicker: "01 · Construye",
    title: "Arrastra, conecta, *prueba*",
    devices: [
      {
        device: "desktop",
        clip: "build",
        play: [
          { from: 0.2, to: 3.8, dur: 1.2 },
          { from: 3.8, to: 9.5, dur: 1.1 },
          { from: 9.5, to: 15.9, dur: 1.4 },
          { from: 15.9, to: 18.8, dur: 0.9 },
        ],
        inset: {
          label: "Entradas → salida",
          crop: BUILD_PANEL,
          at: 3.6,
          "9x16": { x: 0.64, y: 0.43, w: 0.46 },
          "4x5": { x: 0.66, y: 0.43, w: 0.42 },
          "16x9": { x: 0.86, y: 0.63, w: 0.2 },
        },
        "9x16": {
          from: { w: 1.75, u: 0.27, v: 0.42, x: 0.5, y: 0.56, rx: 6, ry: 16, rz: -1.5 },
          to: { w: 1.6, u: 0.3, v: 0.42, x: 0.5, y: 0.56, rx: 3, ry: 5, rz: 0 },
        },
        "4x5": {
          from: { w: 1.7, u: 0.27, v: 0.42, x: 0.5, y: 0.6, rx: 6, ry: 16, rz: -1.5 },
          to: { w: 1.55, u: 0.3, v: 0.42, x: 0.5, y: 0.6, rx: 3, ry: 5, rz: 0 },
        },
        "16x9": {
          from: { w: 0.62, u: 0.5, v: 0.5, x: 0.665, y: 0.5, rx: 6, ry: 18, rz: -1.5 },
          to: { w: 0.58, u: 0.5, v: 0.5, x: 0.675, y: 0.5, rx: 3, ry: 8, rz: 0 },
        },
      },
    ],
  },
  {
    id: "test",
    start: 6.9,
    end: 11.3,
    kicker: "02 · Prueba",
    title: "Cambia entradas, mira la *salida*",
    devices: [
      {
        device: "desktop",
        clip: "test",
        // 5 + 3 = 8, then the carry input gives 9, then 5 + 10 + 1 sets the carry output.
        play: [
          { from: 0.3, to: 5.4, dur: 1.9 },
          { from: 5.4, to: 6.2, dur: 0.6 },
          { from: 6.2, to: 8.05, dur: 0.7 },
          { from: 8.05, to: 12.8, dur: 1.2 },
        ],
        inset: {
          label: "Entradas → salidas",
          crop: TEST_PANEL,
          at: 0.35,
          "9x16": { x: 0.7, y: 0.505, w: 0.465 },
          "4x5": { x: 0.72, y: 0.62, w: 0.42 },
          "16x9": { x: 0.855, y: 0.5, w: 0.2 },
        },
        "9x16": {
          from: { w: 1.22, u: 0.34, v: 0.5, x: 0.3, y: 0.56, rx: 6, ry: 12, rz: -1 },
          to: { w: 1.15, u: 0.34, v: 0.5, x: 0.28, y: 0.56, rx: 3, ry: 4, rz: 0 },
        },
        "4x5": {
          from: { w: 1.16, u: 0.34, v: 0.5, x: 0.3, y: 0.62, rx: 6, ry: 12, rz: -1 },
          to: { w: 1.1, u: 0.34, v: 0.5, x: 0.28, y: 0.62, rx: 3, ry: 4, rz: 0 },
        },
        "16x9": {
          from: { w: 0.54, u: 0.5, v: 0.5, x: 0.61, y: 0.5, rx: 6, ry: 14, rz: -1 },
          to: { w: 0.5, u: 0.5, v: 0.5, x: 0.62, y: 0.5, rx: 3, ry: 6, rz: 0 },
        },
      },
    ],
  },
  {
    id: "reuse",
    start: 11.1,
    end: 14.3,
    kicker: "03 · Reutiliza",
    title: "Cada chip es una *pieza*",
    devices: [
      {
        device: "tablet",
        clip: "place",
        play: [{ from: 0.2, to: 10.8, dur: 3.2 }],
        "9x16": {
          from: { w: 1.34, u: 0.36, v: 0.5, x: 0.5, y: 0.56, rx: 8, ry: -18, rz: 2 },
          to: { w: 1.2, u: 0.42, v: 0.5, x: 0.5, y: 0.56, rx: 4, ry: -6, rz: 0 },
        },
        "4x5": {
          from: { w: 1.2, u: 0.38, v: 0.5, x: 0.5, y: 0.6, rx: 8, ry: -18, rz: 2 },
          to: { w: 1.08, u: 0.44, v: 0.5, x: 0.5, y: 0.6, rx: 4, ry: -6, rz: 0 },
        },
        "16x9": {
          from: { w: 0.62, u: 0.5, v: 0.5, x: 0.64, y: 0.5, rx: 8, ry: -20, rz: 2 },
          to: { w: 0.56, u: 0.5, v: 0.5, x: 0.66, y: 0.5, rx: 4, ry: -8, rz: 0 },
        },
      },
    ],
  },
  {
    id: "mobile",
    start: 14.1,
    end: 19.9,
    kicker: "04 · En tu móvil",
    title: "Todo el poder, *en tu mano*",
    devices: [
      {
        device: "phone",
        clip: "dive",
        // Three levels down to the NAND gates, then the Pins sheet opens and the switches test XOR.
        play: [
          { from: 0.3, to: 10.3, dur: 3 },
          { from: 10.3, to: 13.35, dur: 0.9 },
          { from: 13.35, to: 18.2, dur: 1.9 },
        ],
        "9x16": {
          from: { w: 0.45, u: 0.5, v: 0.5, x: 0.5, y: 0.635, rx: 8, ry: 24, rz: -3 },
          to: { w: 0.485, u: 0.5, v: 0.5, x: 0.5, y: 0.635, rx: 3, ry: -10, rz: 0 },
        },
        "4x5": {
          from: { w: 0.36, u: 0.5, v: 0.5, x: 0.5, y: 0.645, rx: 8, ry: 24, rz: -3 },
          to: { w: 0.385, u: 0.5, v: 0.5, x: 0.5, y: 0.645, rx: 3, ry: -10, rz: 0 },
        },
        "16x9": {
          from: { w: 0.2, u: 0.5, v: 0.5, x: 0.7, y: 0.5, rx: 8, ry: 26, rz: -3 },
          to: { w: 0.215, u: 0.5, v: 0.5, x: 0.7, y: 0.5, rx: 3, ry: -12, rz: 0 },
        },
      },
    ],
  },
  {
    id: "everywhere",
    start: 19.7,
    end: 22.3,
    kicker: "05 · Un solo código",
    title: "Todas las *pantallas*",
    devices: [
      {
        device: "desktop",
        clip: "test",
        play: [{ from: 8.05, to: 12.8, dur: 2.6 }],
        "9x16": {
          from: { w: 0.8, u: 0.5, v: 0.5, x: 0.5, y: 0.47, rx: 6, ry: -10, rz: 0 },
          to: { w: 0.84, u: 0.5, v: 0.5, x: 0.5, y: 0.46, rx: 4, ry: -4, rz: 0 },
        },
        "4x5": {
          from: { w: 0.74, u: 0.5, v: 0.5, x: 0.5, y: 0.5, rx: 6, ry: -10, rz: 0 },
          to: { w: 0.78, u: 0.5, v: 0.5, x: 0.5, y: 0.49, rx: 4, ry: -4, rz: 0 },
        },
        "16x9": {
          from: { w: 0.4, u: 0.5, v: 0.5, x: 0.66, y: 0.44, rx: 6, ry: -10, rz: 0 },
          to: { w: 0.42, u: 0.5, v: 0.5, x: 0.66, y: 0.43, rx: 4, ry: -4, rz: 0 },
        },
      },
      {
        device: "tablet",
        clip: "place",
        play: [{ from: 4.4, to: 10.8, dur: 2.6 }],
        "9x16": {
          from: { w: 0.52, u: 0.5, v: 0.5, x: 0.3, y: 0.7, rx: 6, ry: 14, rz: -2 },
          to: { w: 0.55, u: 0.5, v: 0.5, x: 0.31, y: 0.69, rx: 4, ry: 8, rz: -1 },
        },
        "4x5": {
          from: { w: 0.47, u: 0.5, v: 0.5, x: 0.3, y: 0.78, rx: 6, ry: 14, rz: -2 },
          to: { w: 0.5, u: 0.5, v: 0.5, x: 0.31, y: 0.77, rx: 4, ry: 8, rz: -1 },
        },
        "16x9": {
          from: { w: 0.25, u: 0.5, v: 0.5, x: 0.5, y: 0.7, rx: 6, ry: 14, rz: -2 },
          to: { w: 0.265, u: 0.5, v: 0.5, x: 0.505, y: 0.69, rx: 4, ry: 8, rz: -1 },
        },
      },
      {
        device: "phone",
        clip: "dive",
        play: [{ from: 13.35, to: 18.2, dur: 2.6 }],
        "9x16": {
          from: { w: 0.26, u: 0.5, v: 0.5, x: 0.78, y: 0.67, rx: 6, ry: -16, rz: 2 },
          to: { w: 0.275, u: 0.5, v: 0.5, x: 0.77, y: 0.66, rx: 4, ry: -9, rz: 1 },
        },
        "4x5": {
          from: { w: 0.21, u: 0.5, v: 0.5, x: 0.79, y: 0.72, rx: 6, ry: -16, rz: 2 },
          to: { w: 0.225, u: 0.5, v: 0.5, x: 0.78, y: 0.71, rx: 4, ry: -9, rz: 1 },
        },
        "16x9": {
          from: { w: 0.105, u: 0.5, v: 0.5, x: 0.875, y: 0.62, rx: 6, ry: -16, rz: 2 },
          to: { w: 0.11, u: 0.5, v: 0.5, x: 0.87, y: 0.61, rx: 4, ry: -9, rz: 1 },
        },
      },
    ],
  },
  { id: "cta", start: 22.1, end: 25.8, card: true, devices: [] },
];

export const DURATION = Math.max(...SCENES.map((scene) => scene.end));
