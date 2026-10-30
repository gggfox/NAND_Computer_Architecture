# Editor Phase 2: Canvas Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the canvas a real editor surface. This covers a pointer-gesture layer (tap, drag, long-press, pinch, two-finger pan), hit-testing with 24 px targets, chip anatomy (pin names inside the chip, bus tabs, grid-rule sizing, signal colours with the dashed low cue), a pin card and a chip menu, selection with box and lasso, moving with grid snap, delete and undo, the Pan/Select tool switch, a minimap, and keyboard equivalents for all of it. Before any of that, the Phase 1 carry-over (issue #13 comment): near-linear flattening and a performance budget.

**Architecture:** Every rule is a pure function in `circuit-editor/domain`, so it falls under the 95% branch gate:
- `chip-layout` turns an instance into a rect plus pin anchors;
- `hit-test` answers "what is under this world point" from a bucketed spatial index;
- `camera` converts between screen and world coordinates;
- `gestures` is a pointer state machine with injected time;
- `interaction` is the canvas state machine: tool, selection, hover, drag preview, marquee, open menu and card.

Two thin adapters connect these to the DOM:
- `pointer-input` turns DOM `PointerEvent`s and timers into recognizer inputs;
- `canvas-renderer` draws a frame from the editor, simulation and interaction stores.

A drag never dispatches per frame. The renderer draws a *preview* offset, and one `moveChips` action commits on release, so undo sees one step and the engine never reloads mid-drag. Selection and the other transient state live in a separate `InteractionStore`, outside undo history. The camera lives in that store while a gesture runs and is written back to the URL (`replace`) when the gesture ends (ADR 16).

**Tech Stack:** TypeScript 7, React 19 + React Compiler, React Aria Components (behind `src/shared/ui`), Zustand (vanilla), Canvas 2D, Vitest (v8 coverage), Paraglide JS, Playwright + axe. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-29-circuit-editor-design.md` §5.1, §5.3, §5.8 (and §7 builder calls), roadmap `docs/superpowers/plans/2026-10-29-circuit-editor-roadmap.md` (Phase 2), issue #13 and its Phase 1 carry-over comment.

## Global Constraints

- The template's rules stand (see `CLAUDE.md`):
  - features expose only `index.ts`;
  - `simulation` imports no React or DOM;
  - `shared` imports no feature;
  - no `throw` in `domain/` or in `simulation` outside `adapters/` (return `Result`);
  - Zod only at trust boundaries;
  - only `src/shared/ui` imports `react-aria-components`.
- Every user string goes through Paraglide in `en` and `es`, including canvas text that is not a chip or pin name (`?`, the pin card, the menu, announcements).
- Every edit is an `EditorAction` (ADR 8). Selection, hover, the camera and the tool are **not** edits and never enter undo history.
- **No target smaller than 24 px** (spec §3). Hit radii are in screen pixels and divided by zoom, never fixed in world units.
- **Nothing is hover-only or right-click-only** (spec §3). Every hover has a long-press equivalent, every right-click has a long-press and a keyboard equivalent, and every gesture has a keyboard equivalent.
- `prefers-reduced-motion`: no animated camera moves (fit, minimap jump) when it is set.
- Canvas drawing stays outside React (ADR 20). React components never subscribe to per-frame state (hover, preview, marquee).
- 95% per-file branch coverage on `src/features/*/domain/**`, `src/features/simulation/**` (except `adapters/`), and `src/shared/**/*.ts` (`vitest.config.ts`).
- Existing E2E specs keep passing unchanged, with these accessible names: `Input A`, `Input B`, `Output: 1`, `NAND gate 1`, `Add NAND`, `Undo`, `Redo`.
- Visual baselines change in Task 5. Regenerate them only with `pnpm e2e:visual:docker` (Linux image); never commit macOS baselines.
- knip runs in `pnpm check`: export nothing without a consumer.
- Conventional Commits, one commit per task at least, never bypass hooks (ADR 13, 31).

## Review Focus

1. **Gesture disambiguation.** These must each be recognised correctly:
   - tap vs drag (slop);
   - drag vs long-press (time and slop);
   - one finger vs two (a second finger turns any pending or active one-finger gesture into a pinch, and commits any drag in progress first);
   - mouse right-click vs long-press;
   - a cancelled pointer (`pointercancel`, `lostpointercapture`) ends cleanly.
   Owned by Task 6 (`gestures.test.ts`) and verified on devices in Task 0.
2. **One drag is one undo step and zero engine reloads.** Dragging N selected chips dispatches exactly one `moveChips`. No action is dispatched before release, and the engine is not reloaded (Phase 1 skips reloads when the netlist is unchanged). Owned by Task 8 (`moveChips`), Task 9 (`interaction drag`) and Task 13 (E2E undo).
3. **Hit-test priority and 24 px targets.** A pin beats a chip body, a chip body beats a wire, and a wire beats empty canvas. The nearest pin wins when several are within reach. Reach is `max(12 px, half the drawn size) / zoom`. Owned by Task 7.
4. **Selection survives undo/redo safely.** After an undo that removes a selected chip, the selection drops that id. Delete then undo restores the chips and wires but not the selection. Owned by Task 9 (`prune on history change`).
5. **Smooth drag at scale.** With 300 chips and 600 wires:
   - a drag frame does no allocation proportional to the circuit beyond the moved set;
   - hit-testing touches only nearby buckets;
   - the flattener is not on the drag path.
   Owned by Task 1 (budget), Task 7 (index), Task 5 (layout cache) and Task 13 (`@perf`).

---

## Decisions this plan fixes (builder calls, spec §7)

- **Gesture thresholds** (Task 0 may tune them):
  - drag slop: 4 px for a mouse, 10 px for touch and pen;
  - long-press: 500 ms within slop;
  - no double-tap.
  - A mouse secondary button (`button === 2`) is an immediate `contextMenu`; `contextmenu` DOM events are prevented on the canvas.
- **Second finger during a one-finger drag:** commit the drag so far (one `moveChips`), then pinch. Nothing typed or dragged is ever lost to a mode change (spec §3).
- **Wheel:**
  - plain wheel and trackpad scroll pan;
  - `Ctrl`/`⌘` + wheel zooms at the cursor (trackpad pinch arrives this way);
  - `Shift` + wheel pans horizontally.
  This follows the Figma and Excalidraw conventions and matches "two-finger drag pans" on touch. **Space** + drag pans with any tool.
- **Tool switch** (`pan` | `select`, default `select` with a fine pointer and `pan` with a coarse pointer). It is a session preference held in the interaction store. It is not in the URL and not saved. One finger dragging a **chip** always moves it, whatever the tool.
- **Box and lasso selection:**
  - a drag on empty canvas in the Select tool draws a box;
  - with `Alt` held, or after a long-press on empty canvas in the Select tool, it draws a lasso;
  - a chip is selected when its **centre** is inside the box or lasso (as in DLS);
  - a wire is selected when both of its end chips are selected;
  - `Shift` (or the additive toggle in the keyboard map) adds to the selection.
- **Snap:** chip positions snap to `GRID` (40 world px) on commit and in the preview. Wires whose two ends both move translate their manual waypoints by the same delta. Other wires keep their waypoints; Phase 3's router owns re-routing.
- **Chip anatomy grid:**
  - one pin cell is `GRID / 2` (20 world px);
  - a 1-, 4-, 8- or 16-bit pin takes 2, 3, 4 or 5 cells;
  - height is `max(sum of slots per side, 3 cells)`, and slack is spread evenly between pins (a single pin is centred);
  - width is `ceil((title + widest left label + widest right label + padding) / GRID) * GRID`, with a minimum of `2 * GRID`;
  - text width comes from a deterministic `CHAR_WIDTH` (pin labels use a monospace font, so this is exact), so the domain needs no DOM.
- **Pin pieces** keep a `GRID × GRID` body. A bus piece becomes `GRID × (cells * PIN_CELL)`. The multi-bit display is Phase 4.
- **The NAND keeps 80 × 80 world px** (4 cells tall, two 1-bit inputs). It is drawn with the `chip-nand` token. Custom chips use `Chip.color`; their text is black or white, whichever has the higher WCAG contrast (theming's `contrastRatio`, which moves to `src/shared/contrast.ts` so the editor can use it).
- **Live levels everywhere:** the engine reports the levels of probed signals, every bit of every pin of every top-level instance. Pins and wires then show real levels, and the pin card shows a live value. Unknown levels (invalid circuit) draw in the `wire` colour with the `?` text.
- **Chip menu items:**
  - Delete (every part);
  - for custom chips only: Rename chip…, Recolour chip… and Look inside. These are `renameChip`/`recolorChip`/`openChip` on the chip *definition*, and the menu says so ("Rename chip").
  - Duplicate is **not shown** until Phase 5 adds the action.
- **Flattening stays on the main thread.** After Task 1 it is near-linear and memoised per saved chip, and a drag commits once per gesture. Moving it into the worker would add a protocol round-trip for no measured gain. This is revisited if the Task 1 budget fails at 82k NANDs.
- **The camera** is `EditorSearch` (`zoom`, `x`, `y`; zoom 0.25–4). During a gesture the live camera is in the interaction store. On gesture end (and 200 ms after the last wheel event) it is written to the URL with `replace: true`, so back/forward is not flooded.
- **Minimap:** a 160 × 120 CSS px overlay in the canvas's bottom-right corner, `aria-hidden`. A tap or drag centres the camera there. It is hidden while the canvas is narrower than 360 px. Fit and the zoom buttons are its accessible equivalent.
- **Keyboard map** (the canvas host is focusable; Tab always leaves it, so there is no trap):

  | Key | Does |
  |---|---|
  | `]` / `[` | select next / previous chip (canvas order); `Shift` adds to the selection |
  | `Ctrl`/`⌘`+`A` | select all chips |
  | `Escape` | close the card or menu, else clear the selection |
  | Arrows | move the selection one grid step (`Shift`: 4); with nothing selected, pan one grid step |
  | `Delete` / `Backspace` | delete the selection |
  | `Ctrl`/`⌘`+`Z`, `Ctrl`/`⌘`+`Shift`+`Z`, `Ctrl`+`Y` | undo, redo, redo |
  | `+` / `=`, `-`, `0` | zoom in, zoom out (about the centre), fit |
  | `Enter`, `Shift`+`F10`, `ContextMenu` | open the chip menu for a single selected chip |
  | `P` / `Shift`+`P` | step through the selected chip's pins; shows the pin card and announces it |
  | `V`, `H` | Select tool, Pan tool |
  | `?` | open the keyboard help dialog |

---

## File Structure

```
src/shared/contrast.ts                 MOVED from theming/domain/contrast.ts (+ readableTextOn)
src/shared/group-by.ts                 NEW  (Task 1)
src/shared/ui/
  SegmentedControl.tsx (+ .module.css)  NEW  RAC ToggleButtonGroup, single selection
  PointMenu.tsx (+ .module.css)         NEW  RAC Popover + Menu anchored at a client point
  PromptDialog.tsx (+ .module.css)      NEW  RAC Dialog + TextField (rename)
  SwatchPicker.tsx (+ .module.css)      NEW  RAC RadioGroup of colour swatches (recolour)
  KeyboardHelp.tsx (+ .module.css)      NEW  RAC Dialog listing a key map
src/features/circuit-editor/domain/
  flatten-index.ts    NEW  per-circuit indexes (wires by sink, instances by id, pieces by pin), WeakMap-memoised
  flatten-walk.ts     validation memoised per circuit, PerFrame maps
  to-netlist-source.ts uses flatten-index; + probes
  probes.ts           NEW  withProbes (append probed signals to outputs), probeLevels
  chip-layout.ts      NEW  layoutOf, PinLayout, ChipLayout, CHAR_WIDTH, PIN_CELL
  geometry.ts         rectOf/pinPosition/wireRoute take a LayoutSource; freeNandPosition kept
  camera.ts           NEW  Camera, screenToWorld, worldToScreen, zoomAt, panBy, fitBounds, clampZoom
  hit-test.ts         NEW  SpatialIndex, buildIndex, hitTest, nearestPin, Hit
  gestures.ts         NEW  recognizer state machine
  selection.ts        NEW  Selection, select/toggle/clear, inBox, inLasso, prune
  move.ts             NEW  snap, previewPositions, movesFor
  interaction.ts      NEW  canvas state machine (tool, selection, hover, preview, marquee, menu, card)
  keymap.ts           NEW  key → InteractionCommand
  pin-info.ts         NEW  pin card model (name, width, value text, connections)
  circuit-edits.ts    + moveChips, removeItems
  actions.ts, reducer.ts, editor-error-messages.ts   + the two actions
  signals.ts          levels from probes
src/features/circuit-editor/application/
  interaction-store.ts NEW zustand store around domain/interaction, pruned on history change
  simulation-bridge.ts + probes → levels
  view-sync.ts        NEW  camera ↔ URL (replace, on gesture end)
src/features/circuit-editor/adapters/
  pointer-input.ts    NEW  DOM PointerEvent/WheelEvent → gestures inputs, long-press timer, capture
  canvas-renderer.ts  anatomy, levels, selection, preview, marquee, layout cache
  minimap-renderer.ts NEW
src/features/circuit-editor/ui/
  CircuitCanvas.tsx   focusable host, overlays, keyboard, live region
  CanvasOverlays.tsx  NEW  PinCard, ChipMenu, dialogs
  EditorToolbar.tsx   + tool switch, Delete, Zoom in/out, Fit, Keyboard shortcuts
src/features/accessibility/ui/CircuitSummary.tsx   selected state
tooling/spikes/gestures.html           NEW  device spike harness (Task 0)
docs/research/2026-10-30-gesture-spike.md   NEW  spike results
docs/adr/0042-canvas-gestures-and-tools.md  NEW
docs/adr/0043-interaction-state-outside-history.md NEW
e2e/canvas-pointer.spec.ts, e2e/canvas-touch.spec.ts, e2e/canvas-keyboard.spec.ts, e2e/canvas-perf.spec.ts  NEW
e2e/support.ts  + touch/pointer helpers, exportedProject
messages/en.json, messages/es.json, GLOSSARY.md
```

---

### Task 0: Spike — gesture disambiguation on real devices ✅ done

**Files:**
- Create: `tooling/spikes/gestures.html` (self-contained, no build step; served with `python3 -m http.server 8000 --directory tooling/spikes`, because the app's dev server routes every path to the SPA)
- Create: `docs/research/2026-10-30-gesture-spike.md`

The harness:
- logs raw Pointer Events (type, id, pointerType, button(s), pressure, coalesced count, timestamps);
- runs a candidate recognizer with adjustable slop and long-press sliders, and shows the recognised gesture big on screen;
- has a test scene of 300 rects to drag, with a frame-time readout (p50/p95 of rAF deltas).

- [x] **Step 1:** Write the harness. Set `touch-action: none` on the surface, use `setPointerCapture` on down, and handle `pointercancel` and `lostpointercapture`. Prevent `contextmenu`, and set `-webkit-touch-callout: none` and `user-select: none`, so iOS long-press shows neither the callout nor a text selection.
- [x] **Step 2 (owner, on devices):** On iOS Safari (iPhone) and Android Chrome (mid-range phone), run the checklist in the research doc:
  - tap;
  - drag at 3 speeds;
  - long-press, both still and with tremor;
  - pinch;
  - two-finger pan;
  - a second finger added mid-drag;
  - an edge swipe (back gesture);
  - a palm or extra touch;
  - a stylus if one is available;
  - 300-rect drag fps.
  Record what each produced, and the slop and duration that felt right.
- [x] **Step 3:** Fill in the doc's findings table, then update the thresholds in "Decisions" above and Task 6's constants if they differ. Note any iOS edge-swipe conflict. Mitigation: ignore pointers that start within 16 px of the left or right edge on iOS.
- [x] **Step 4: Commit** `docs(research): gesture disambiguation spike harness and findings`. The owner confirmed iOS Safari and Android Chrome work as intended with the defaults, which stay.

---

### Task 1: Near-linear flattening and a performance budget (Phase 1 carry-over) ✅ done

**Files:**
- Create: `src/shared/group-by.ts` (+ test), `src/features/circuit-editor/domain/flatten-index.ts`, `src/features/circuit-editor/domain/to-netlist-source-perf.test.ts`
- Modify: `src/features/projects/domain/wiring.ts`, `src/features/circuit-editor/domain/{flatten-walk,to-netlist-source}.ts`, `to-netlist-source-errors.test.ts`

**What was quadratic:**
- `findInvalidWire` ran `checkConnection` once per wire, and each run scanned every instance and every wire;
- `drive` ran `wires.find` once per sink bit;
- every memo key joined the full instance path, which made deep hierarchies GC-bound.

**As built:**
- `findInvalidWire` is linear. It looks instances up through a `Map`, and the single-driver check compares only the wires into the same pin (`groupBy`). `checkConnection` keeps its behaviour and error order.
- `indexOf(circuit)` (`instances` by id, `sinks` by `${instanceId}:${pin}`, `pieces` by pin) is memoised in a module `WeakMap<Circuit, CircuitIndex>`. Circuits are immutable, and a saved version is one object shared by every instance, so it is indexed once.
- `Walk.checked` memoises `findInvalidWire` per circuit for one flatten. A saved chip is therefore validated once per flatten, however often it is placed.
- `PerFrame<Key, Value> = Map<Frame, Map<Key, Value>>` replaces path-joined string keys for `nandIndex`, `frames`, `memo` and `active`.

**Measured** (this container, median):

| Case | Before | After |
|---|---|---|
| 2000-NAND chain | 232 ms | 10 ms |
| 4000 / 1000 chain ratio | ≈ 16 | ≈ 3 |
| 4⁸ = 65 536-NAND hierarchy | 2 400 ms | 690 ms |

**Budget tests:**
- the chain ratio is < 8;
- the 2000-NAND chain is < 80 ms;
- the 65k hierarchy is < 1500 ms.
These catch a return to the old cost without flaking on CI.

The remaining hierarchy cost is lookups across about 22k nested frames. If a later phase needs more, expand each saved chip once into a template and offset its NAND indices per instance.

- [x] Budget tests written and confirmed failing; fix implemented; `pnpm check` green.
- [x] **Commit** `perf(circuit-editor): index wires by sink and memoise per saved chip when flattening`

---

### Task 2: Live levels via engine probes ✅ done

**As built.** No protocol change was needed: the probed signals are appended to the netlist's `outputs`, so the engine, session and worker are untouched.

**Files:**
- Modify: `src/features/projects/domain/pins.ts`, which gains `pinKeys(project, instance)`: every pin in drawing order, and a custom chip's saved pins in Pins-panel order.
- Modify: `src/features/circuit-editor/domain/to-netlist-source.ts`. `Flattened` gains `probes: { instanceId; pin; bits: SignalRef[] }[]`, covering every pin of every top-level instance whose bits all resolve. Unresolvable pins (for example an unused MERGE) are left out, and that is not an error.
- Create: `src/features/circuit-editor/domain/probes.ts`:
  - `withProbes(flattened)` gives `{ source, slots }`. Each distinct probed signal is appended once to `source.outputs`, and a signal that is already an output reuses its slot;
  - `probeLevels(slots, bits)` gives a `Map` keyed by `pinLevelKey`, with bits packed bit 0 first.
- Modify: `src/features/circuit-editor/domain/signals.ts`:
  - `KnownLevels.levels?` is new;
  - `pinLevelKey` and `pinValue` are new;
  - `wireLevel` prefers the probed level. A tap reads its bit, and a whole bus has no single level.
- Modify: `src/features/circuit-editor/application/simulation-bridge.ts`. It loads `withProbes(...).source` and keeps a `Readout` (`layout` and `slots`). `SimulationState.levels` keeps its identity while values are unchanged, and is cleared when the circuit cannot be compiled.
- Modify: `src/features/circuit-editor/ui/CircuitCanvas.tsx`, which passes `levels` to the renderer. NAND-to-NAND wires now show their level.
- Tests: `probes.test.ts` (new), plus `pins.test.ts`, `signals.test.ts` and `simulation-bridge.test.ts`.

- [x] **Commit** `feat(circuit-editor): probe every pin on the open chip so wires and pins show live levels`

---

### Task 3: Chip anatomy layout (domain) ✅ done

**Files:**
- Create: `src/features/circuit-editor/domain/chip-layout.ts`, `chip-layout.test.ts`
- Move: `src/features/theming/domain/contrast.ts` → `src/shared/contrast.ts` (+ test). Add `readableTextOn(background: string): "#000000" | "#ffffff"`.
- Modify: `src/features/circuit-editor/domain/geometry.ts` (+ test), and every caller of `rectOf`/`pinPosition`/`wireRoute`

**Interfaces:**
- `PIN_CELL = GRID / 2`, `CHAR_WIDTH = 8` (13 px monospace), `PIN_SLOT_CELLS: Record<BitWidth, number> = {1:2, 4:3, 8:4, 16:5}`
- `interface PinLayout { key: PinKey; name: string; width: BitWidth; side: "left" | "right"; anchor: Point /* on the chip edge, world */; tab: Rect /* drawn pin shape: 1-bit square 12×12, bus 12×(cells*PIN_CELL-8) */; label: string /* "a" or "d[4]" */ }`
- `interface ChipLayout { rect: Rect; title: string; pins: readonly PinLayout[] }`
- `interface LayoutSource { project: Project; circuit: Circuit }`
- `layoutOf(source, instance): ChipLayout`. Its pins are, by part:
  - NAND: `a`, `b` left and `out` right, at 80×80;
  - clock: `out` right, titled `CLK`;
  - split n: `in[n]` left, then `0..n-1` right;
  - merge n: `0..n-1` left, `out[n]` right;
  - custom: the saved pins in Pins-panel order, inputs left and outputs right; a missing or unsaved chip has no pins and a `2*GRID` square;
  - a pin piece: one pin, on the right for an input and on the left for an output, with its `PinDef` name.
- `createLayoutCache(): (source, instance) => ChipLayout`. This is memoised by `instance` identity plus the custom chip's `saved` identity, so the renderer and hit-test share it.
- `geometry.ts`: `rectOf(source, instance)`, `pinPosition(source, instance, pin)` (the anchor) and `wireRoute(source, wire, positions?: ReadonlyMap<InstanceId, Point>)`. The optional `positions` override feeds the drag preview. `freeNandPosition` uses `layoutOf`.

**As built (differences from the above):**
- The NAND is **120 × 80**, not 80 × 80. Its pin labels (`a`, `b`, `out`) sit inside the body beside the title, and the grid rule rounds the width up. Relative to its position, its anchors are `a` (0, 20), `b` (0, 60) and `out` (120, 40).
- `GRID`, `Rect`, `Size` and `PIN_CELL` now live in `chip-layout.ts`; `geometry.ts` re-exports `GRID`, `Rect` and `Size`.
- `layoutOfKind(source, kind, position)` lays out a part that is not placed yet. `freeNandPosition` uses it.
- Every geometry function takes a `Scene` (`LayoutSource` plus an optional `layout` cache and an optional drag-preview `positions` map). A dragged chip's cached layout is shifted, not rebuilt.
- `pinPosition` returns `undefined` for a pin the instance does not have, and `wireRoute` then routes nothing.
- `readableTextOn`/moving `contrast.ts` is deferred to Task 5, where the renderer first needs it.
- `adapters/watch-environment.ts` was split out of `canvas-renderer.ts` (file-length limit).

- [x] **Step 1: Failing tests:**
  - NAND: rect 80×80 with anchors `a` (0,20), `b` (0,60) and `out` (80,40), relative to the position;
  - a custom chip with inputs `a,b,c` (1 bit) and an output `sum` (4 bit): the left side has 3 slots of 2 cells = 120 tall; the right side's single pin is centred; height 120;
  - slack is spread evenly when one side is shorter (anchors at evenly spaced slot centres);
  - width grows with the title and labels, is a multiple of `GRID`, and is at least `2*GRID`;
  - bus label `d[4]`, with the tab taller than a 1-bit tab;
  - split 4 / merge 8 pin order and labels;
  - a pin piece of each direction;
  - an unsaved custom chip has no pins;
  - the cache returns the same object for the same instance and saved version, and a new one after the saved version changes;
  - `readableTextOn("#3b82f6")` picks the colour with contrast ≥ 4.5 where one exists, else the higher one.
- [x] **Step 2: Implement.** Update the callers mechanically: `canvas-renderer`, `freeNandPosition` and the geometry tests. `pnpm vitest run` stays green. The demo's positions are unchanged, because its NAND's anchors move only vertically within the body.
- [x] **Step 3: Commit** `feat(circuit-editor): chip anatomy layout from the pin grid rule`

---

### Task 4: Camera (domain) and view sync (application) ✅ done

**Files:**
- Create: `src/features/circuit-editor/domain/camera.ts` (+ test), `src/features/circuit-editor/application/view-sync.ts` (+ test)
- Modify: `src/features/circuit-editor/domain/view-search.ts` (export `MIN_ZOOM`, `MAX_ZOOM`), `adapters/canvas-renderer.ts` (use `camera` for the transform; `PAD` moves into `camera.ts` as `SCREEN_PAD`)

**Interfaces:**
- `type Camera = Pick<EditorSearch, "zoom" | "x" | "y">`
- `worldToScreen(camera, p)` and `screenToWorld(camera, p)`, which are exact inverses (`SCREEN_PAD` included);
- `clampZoom(z)`;
- `zoomAt(camera, screenPoint, factor)`, which keeps the world point under `screenPoint` fixed;
- `panBy(camera, screenDelta)`;
- `fitBounds(bounds: Rect | undefined, viewport: Size, margin = 48): Camera`. An empty circuit gives the default camera, and zoom is clamped;
- `boundsOf(layouts: Iterable<ChipLayout>): Rect | undefined`.
- `createViewSync({ read: () => Camera; write: (camera: Camera) => void; delayMs = 200 })` returns `{ changed(camera), settle() }`. `changed` debounces; `settle` writes now. The route passes `write = (c) => navigate({ search: (s) => ({ ...s, ...c }), replace: true })`.

- [ ] **Step 1: Failing tests:**
  - a round-trip property over a grid of cameras and points;
  - `zoomAt` keeps the anchor fixed and clamps at 0.25 and 4;
  - `fitBounds` centres the bounds;
  - `view-sync` writes once after a burst, and immediately on `settle` (fake timers).
- [x] **Step 2: Implement.** **Step 3: Commit** `feat(circuit-editor): camera transforms and debounced URL view sync`. `fitBounds` uses a fixed 48 px margin, and `createViewSync(write, delayMs)` also has `dispose()`. The route wires `write` in Task 10.

---

### Task 5: Renderer — anatomy, levels and layout cache ✅ done (overlays moved to Task 9)

**Files:**
- Modify: `src/features/circuit-editor/adapters/canvas-renderer.ts`, `src/features/theming/tokens.css` and the token data (`pnpm tokens`) to add `--color-selection` and `--color-pin`. Add contrast tests for the new tokens in `theming/domain/themes.test.ts`.
- Modify: `e2e/visual.spec.ts-snapshots/*` (regenerated with `pnpm e2e:visual:docker`)

**Behaviour:**
- **Chip:** a rounded rect in its colour (NAND token, `Chip.color`, or the pin-piece level colour). The title is centred in a bold 14 px system font, with `readableTextOn` for custom chips. Pin labels are drawn inside the edge in 12 px monospace, with the `chip-text` colour on built-ins.
- **Pins:** each tab is filled with its level colour. A low pin also gets a dashed 1 px outline, so its state is never shown by colour alone (WCAG 1.4.1). Bus tabs show their label beside the tab.
- **Wires** are drawn with their level from probes. Drawing order is low wires first, then high, then unknown, so high wires sit on top (DLS).
- **Selection:** a 2 px `--color-selection` outline 4 px outside each selected chip, and selected wires drawn 2 px wider in `--color-selection` under the wire.
- **Hover/focus pin:** a ring of radius 12 screen px at the anchor.
- **Preview:** while dragging, chips use `positions` from the interaction state, and wires use `wireRoute(..., positions)`.
- **Marquee:** a dashed `--color-selection` box or lasso polygon, in screen space.
- **Culling:** skip chips and wires whose bounds are outside the viewport.
- `RenderState` gains `interaction: InteractionView` (Task 9's read-only slice) and `levels`. The renderer subscribes to the interaction store, and keeps `createLayoutCache()` for its lifetime.
- **Grid dots** are skipped when `GRID * zoom < 8` px; then every 4th dot is drawn.

**As built:**
- The renderer is split into `adapters/frame.ts` (palette, `Frame`, `levelColor`, `intersects`), `adapters/draw-parts.ts` (wires, parts, pieces) and `canvas-renderer.ts` (grid, viewport, culling, scheduling). `contrast.ts` moved to `src/shared/contrast.ts` and gained `readableTextOn`.
- Titles are centred *between* the label columns (measured with `measureText`), so a long label never runs into the title.
- A pin piece draws its name outside its body, on the side away from its pin. This replaces the A/B letters, and the demo's pins are named A, B and OUT.
- **Moved to Task 9:** selection outlines, the hover/focus pin ring, drawing the drag preview, the marquee, and the `--color-selection` token. They need the interaction state, which Task 9 creates. `wireRoute`/`layoutIn` already accept the preview `positions`.
- The visual baselines were regenerated with `--update-snapshots=all`: the new labels and tabs are under the 1% pixel tolerance, so a plain update would have kept the old images.
- Checked by eye on a production build, with a custom chip (Half adder), a NAND, a SPLIT 4 and a 4-bit input.

- [x] **Step 1:** Implement, and run `pnpm dev` to check each theme by eye (light, dark, high-contrast).
- [x] **Step 2:** Run `pnpm e2e:visual:docker -- --update-snapshots=all`. Review the three PNG diffs and commit only those.
- [x] **Step 3: Commit** `feat(circuit-editor): draw chip anatomy, live pin levels, selection and drag preview`

---

### Task 6: Gesture recognizer (domain) ✅ done

**Files:**
- Create: `src/features/circuit-editor/domain/gestures.ts`, `gestures.test.ts`

**Interfaces:**
- `type PointerKind = "mouse" | "touch" | "pen"`
- `type PointerInput = { type: "down" | "move" | "up" | "cancel"; id: number; kind: PointerKind; button: number /* 0 primary, 2 secondary */; point: Point /* screen */; time: number; modifiers: { shift; alt; ctrlOrMeta; space } } | { type: "timer"; time: number }` (in `gesture-types.ts`)
- `type Gesture =`
  - `| { type: "hover"; point }` (mouse only, no button down)
  - `| { type: "tap"; point; kind; modifiers }`
  - `| { type: "longPress"; point; kind }`
  - `| { type: "contextMenu"; point }`
  - `| { type: "dragStart"; origin; point; kind; modifiers; afterLongPress: boolean } | { type: "dragMove"; point } | { type: "dragEnd"; point } | { type: "dragCancel" }`
  - `| { type: "pinchStart"; center } | { type: "pinch"; center; scale /* since last */; pan /* screen delta since last */ } | { type: "pinchEnd" }`
- `interface GestureState` (opaque) and `INITIAL_GESTURES`.
- `recognize(state, input): { state: GestureState; gestures: readonly Gesture[]; timerAt?: number }`. `timerAt` asks the adapter to send a `timer` input at that time; it is used for long-press.
- Constants: `MOUSE_SLOP = 4`, `TOUCH_SLOP = 10`, `LONG_PRESS_MS = 500`.

- [ ] **Step 1: Failing tests** (`describe("disambiguation")`, Review Focus 1):
  - mouse down/up within 4 px is a `tap`; beyond 4 px it is `dragStart`, then `dragMove`s, then `dragEnd`;
  - touch within 10 px stays a tap; a 7 px move is still a tap for touch but a drag for a mouse;
  - touch held 500 ms within slop gives `longPress` at the `timer` input; a later move beyond slop gives `dragStart{afterLongPress:true}`; the release gives no tap;
  - a move beyond slop before 500 ms cancels the long-press, so a late `timer` emits nothing;
  - mouse `button 2` on down gives an immediate `contextMenu` and nothing else for that pointer;
  - a second touch before the drag starts gives `pinchStart`; a second touch during a drag gives `dragEnd`, then `pinchStart`;
  - pinch scale and pan follow the two-finger distance and centroid;
  - lifting one finger gives `pinchEnd`, and the remaining finger does nothing until it lifts (no stray tap);
  - `cancel` during a drag gives `dragCancel`, and `cancel` during a pinch gives `pinchEnd`;
  - a third finger is ignored;
  - a mouse move with no button down gives `hover`, and touch never hovers;
  - the `space` modifier is carried on `dragStart`;
  - `recognize` is pure: the same inputs give the same outputs, and the input state is not mutated.
- [x] **Step 2: Implement** as a discriminated `phase` union: `idle | pressed | longPressed | dragging | pinching | draining | secondary`. **Step 3: Commit** `feat(circuit-editor): pointer gesture recognizer with tap, drag, long-press and pinch`

**As built:**
- The input and gesture types live in `domain/gesture-types.ts`, and the machine lives in `domain/gestures.ts`.
- A press tracks its current point, so a second finger mid-drag ends the drag where the first finger is.
- A pinch holds exactly two `{ id, point }` fingers.
- Long-press is touch and pen only. A mouse never asks for the timer, and ignores a stray one.
- The 16 px edge guard needs the element's width, so the pointer adapter (Task 10) drops touches that start near the left or right edge; the recognizer stays width-free.
- 25 tests; 96% branches (only the `assertNever` defaults are uncovered).

---

### Task 7: Hit-testing and the spatial index (domain)

**Files:**
- Create: `src/features/circuit-editor/domain/hit-test.ts`, `hit-test.test.ts`

**Interfaces:**
- `BUCKET = 4 * GRID`
- `buildIndex(source: LayoutSource, layout: (source, instance) => ChipLayout, positions?: ReadonlyMap<InstanceId, Point>): SpatialIndex`. It buckets chip rects, pin anchors and wire segment bounding boxes.
- `type Hit = { type: "pin"; instanceId; pin: PinKey; anchor: Point } | { type: "chip"; instanceId } | { type: "wire"; wireId } | { type: "empty" }`
- `TARGET_PX = 24`. `hitTest(index, world, zoom): Hit` uses `reach = max(TARGET_PX / 2, drawnHalfSize * zoom) / zoom` world units.
- `nearestPin(index, world, reach, accept?: (pin) => boolean)`. Phase 3 passes legality as `accept`.
- `instancesIn(index, rect)` gives candidates for box select.

- [ ] **Step 1: Failing tests** (Review Focus 3):
  - a point on a pin anchor is a `pin` hit, and a point 11 screen px away still is at zoom 1 and at zoom 0.25;
  - 13 px away on the chip body is a `chip` hit;
  - two pins 20 px apart, with the point 6 px from the second: the second pin wins;
  - a pin overlapping a wire beats the wire;
  - within 12 px of a wire segment and off any chip is a `wire` hit;
  - otherwise `empty`;
  - with `positions` overrides, the moved chip is hit at its new place;
  - an index over 300 chips answers `hitTest` touching ≤ 9 buckets (assert via an instrumented counter exported for tests only, kept off `index.ts`).
- [ ] **Step 2: Implement. Step 3: Commit** `feat(circuit-editor): bucketed hit-testing with 24 px targets and nearest-pin snapping`

---

### Task 8: Selection, moving and the batch actions (domain)

**Files:**
- Create: `src/features/circuit-editor/domain/selection.ts`, `move.ts` (+ tests)
- Modify: `domain/actions.ts`, `domain/circuit-edits.ts` (+ test), `domain/reducer.ts`, `domain/editor-error-messages.ts`, `messages/{en,es}.json`

**Interfaces:**
- `interface Selection { instances: ReadonlySet<InstanceId>; wires: ReadonlySet<WireId> }`, `EMPTY_SELECTION`
- `selectOnly`, `toggle`, `addAll`, `clear`
- `inBox(layouts, rect)` and `inLasso(layouts, polygon)`, both by chip centre;
- `withInnerWires(circuit, instances)` adds every wire whose ends are both selected;
- `prune(selection, circuit)` drops ids no longer present.
- `snap(p: Point): Point` (to `GRID`), `previewPositions(circuit, selection, worldDelta): ReadonlyMap<InstanceId, Point>` (snapped)
- `movesFor(...)` gives `readonly { instanceId; position }[]`, containing only the chips that really moved.
- New `EditorAction`s:
  - `{ type: "moveChips"; chipId; moves: readonly { instanceId; position }[] }`. All the moves apply, or none do. Any unknown id gives `InstanceNotFound`. Wires whose two ends both move translate their waypoints by that instance's delta. An empty `moves` gives the error `NothingToMove` (the UI never sends one).
  - `{ type: "removeItems"; chipId; instanceIds: readonly InstanceId[]; wireIds: readonly WireId[] }`. It removes the wires, then the instances (and their wires and pin definitions, via `withoutInstance`). Unknown ids give `InstanceNotFound` / `WireNotFound`; empty gives `NothingToRemove`.
- Messages:

| key | en | es |
|---|---|---|
| `editor_error_nothing_to_move` | Select something to move first. | Primero selecciona algo para mover. |
| `editor_error_nothing_to_remove` | Select something to delete first. | Primero selecciona algo para eliminar. |

- [ ] **Step 1: Failing tests:**
  - box selection by centre (half-in chips are excluded unless their centre is inside);
  - lasso on a concave polygon;
  - `withInnerWires`;
  - `prune`;
  - snapping rounds to the nearest grid point for negative coordinates too;
  - `moveChips` moves three chips in one project change and translates the manual waypoints of an inner wire only;
  - `moveChips` with one unknown id changes nothing;
  - `removeItems` removes the chips, their wires and a pin piece's definition;
  - a reducer round-trip;
  - messages exist for every new error (the existing `messages.test.ts` enumerates them).
- [ ] **Step 2: Implement. Step 3: Commit** `feat(circuit-editor): selection, snapped moves and batch move/remove actions`

---

### Task 9: Interaction state machine (domain) and store (application)

**Files:**
- Create: `src/features/circuit-editor/domain/interaction.ts` (+ test), `src/features/circuit-editor/domain/pin-info.ts` (+ test), `src/features/circuit-editor/application/interaction-store.ts` (+ test)

**Interfaces:**
- `type Tool = "pan" | "select"`
- `interface InteractionState { tool; selection: Selection; camera: Camera; hover?: Hit; drag?: { kind: "move"; origin: Point; delta: Point } | { kind: "pan" } | { kind: "marquee"; shape: "box" | "lasso"; points: readonly Point[]; additive: boolean }; menu?: { instanceId; screen: Point }; card?: { instanceId; pin: PinKey; screen: Point; pinned: boolean } }`
- `type InteractionInput = { type: "gesture"; gesture: Gesture } | { type: "command"; command: InteractionCommand } | { type: "historyChanged"; circuit: Circuit }`
- `type Effect = { type: "dispatch"; action: EditorAction } | { type: "undo" } | { type: "redo" } | { type: "cameraSettled" } | { type: "announce"; message: AnnouncementKey }`
- `interact(state, input, context: { index: SpatialIndex; circuit; chipId; viewport: Size }): { state; effects: readonly Effect[] }`

  | Gesture | On | Result |
  |---|---|---|
  | `tap` | chip | select only (with `Shift`, toggle) |
  | `tap` | pin | select its chip and open the card (touch); a mouse just selects |
  | `tap` | wire | select the wire |
  | `tap` | empty | clear the selection, close the menu and card |
  | `hover` | pin | open the card (mouse, not pinned); leaving closes it |
  | `longPress` | chip | open the menu |
  | `longPress` | pin | open a pinned card |
  | `longPress` | empty, Select tool | arm the lasso; the next drag draws it |
  | `contextMenu` | chip | open the menu |
  | `contextMenu` | elsewhere | nothing (the quick-add menu is Phase 4) |
  | `dragStart` | chip | if the chip is unselected, select only it; then start a move preview |
  | `dragStart` | empty | Select tool without `space`: marquee; Pan tool or `space`: pan |
  | `dragMove` | — | move: update `delta`; pan: `panBy`; marquee: append or replace points |
  | `dragEnd` | — | move: `dispatch moveChips` (if anything moved); marquee: select; pan: `cameraSettled` |
  | `dragCancel` | — | drop the preview; nothing is dispatched |
  | `pinch*` | — | `zoomAt` + `panBy`; `pinchEnd` gives `cameraSettled` |

- `InteractionCommand` covers the keyboard map in Decisions, plus the toolbar buttons (`setTool`, `deleteSelection`, `zoomIn`, `zoomOut`, `fit`).
- `pinInfo(source, levels, instanceId, pin): { name; width; value?: number; valueText /* "0101 = 5" or "?" */; connections: readonly { instanceTitle; pinName }[] }`
- `createInteractionStore(editor: EditorStore, initialCamera)` returns a zustand store with `send(input)`, which applies effects. `dispatch`, `undo` and `redo` go to the editor; `cameraSettled` calls the view-sync. It subscribes to editor history and sends `historyChanged` (prune).

- [ ] **Step 1: Failing tests** (Review Focus 2 and 4):
  - a drag of two selected chips previews both, dispatches nothing until `dragEnd`, then exactly one `moveChips`;
  - a drag of an unselected chip replaces the selection;
  - `dragCancel` dispatches nothing;
  - marquee box select, additive with `Shift`;
  - a lasso after long-press;
  - the Pan tool pans on an empty-canvas drag but still moves on a chip drag;
  - `space` pans in the Select tool;
  - a pinch changes zoom about its centre and settles once;
  - menu and card open and close rules;
  - `deleteSelection` dispatches one `removeItems` with inner wires, and nothing when empty;
  - arrow commands dispatch `moveChips` by one grid step (4 with `Shift`), or pan when nothing is selected;
  - `]` / `[` cycle in canvas order and wrap;
  - `prune on history change`: undo removes a selected chip and the selection drops it;
  - `pinInfo` gives `"0101 = 5"` for a 4-bit value 5, `"?"` when unknown, and lists the connections by wire.
- [ ] **Step 2: Implement. Step 3: Commit** `feat(circuit-editor): canvas interaction state machine and store`

---

### Task 10: Pointer adapter and the focusable canvas host

**Files:**
- Create: `src/features/circuit-editor/adapters/pointer-input.ts`
- Modify: `src/features/circuit-editor/ui/CircuitCanvas.tsx` (+ `.module.css`), `src/features/circuit-editor/ui/use-editor-session.ts` (owns the interaction store), `src/routes/projects.$projectId.tsx` (view-sync `write`)
- Modify: `messages/{en,es}.json`

**Behaviour:**
- `attachPointerInput(element, onGesture, { now = performance.now })` covers these:
  - `pointerdown`/`move`/`up`/`cancel`/`lostpointercapture` (capture on down);
  - it drains `getCoalescedEvents()` to the last point per frame;
  - it manages one `setTimeout` for `timerAt`;
  - `wheel` (`passive: false`, `preventDefault`) maps to pinch-equivalent gestures: `Ctrl`/`⌘` zooms, the rest pans;
  - `contextmenu` is prevented;
  - `Space` is tracked by key state on the host.
  It returns `detach`.
- The host is a `<div>` with `tabIndex={0}`, `role="application"`, `aria-roledescription` = `m.canvas_roledescription()` ("circuit canvas"), `aria-label` = the chip's name, and `aria-describedby` pointing at a visually hidden one-line hint ("Use ] and [ to select chips, arrows to move, ? for all shortcuts"). It has a visible focus ring. The `<canvas>` inside stays `aria-hidden`.
- **Keyboard:** `keydown` → `keymap` → `send({type:"command"})`. Only keys in the map call `preventDefault`, and Tab is never handled.
- **Live region:** a visually hidden `aria-live="polite"` region shows the latest `announce` effect, e.g. "NAND gate 2 selected", "2 chips moved", "3 items deleted", or the pin card text.
- Messages (en / es) for the role description, the hint, and each announcement: `canvas_selected_one`, `canvas_selected_many`, `canvas_moved`, `canvas_deleted`, `canvas_selection_cleared`, `canvas_tool_pan`, `canvas_tool_select`.

- [ ] **Step 1:** Implement. Run `pnpm dev`, then check by hand: a mouse drag moves the NAND; undo restores it; a wheel with Ctrl zooms; touch emulation in devtools long-presses.
- [ ] **Step 2: Verify** with `pnpm check`. **Step 3: Commit** `feat(circuit-editor): pointer and keyboard input on a focusable canvas host`

---

### Task 11: Toolbar, chip menu, pin card and dialogs (UI)

**Files:**
- Create: `src/shared/ui/{SegmentedControl,PointMenu,PromptDialog,SwatchPicker,KeyboardHelp}.tsx` (+ CSS modules), exported from `src/shared/ui/index.ts`
- Create: `src/features/circuit-editor/ui/CanvasOverlays.tsx` (+ CSS)
- Modify: `src/features/circuit-editor/ui/EditorToolbar.tsx`, `messages/{en,es}.json`

**Behaviour:**
- **Toolbar** (it keeps the existing buttons):
  - `SegmentedControl` labelled "Drag on empty canvas", with options Pan and Select;
  - Delete (disabled with an empty selection);
  - Zoom out, Zoom in, Fit;
  - Keyboard shortcuts (opens `KeyboardHelp`).
  Every control is ≥ 44 px tall on coarse pointers and ≥ 24 px otherwise.
- **`PointMenu`:** RAC `Popover` with `triggerRef` set to a 1×1 absolutely positioned anchor at the menu's screen point, and `Menu` items. Focus moves into the menu and Escape returns focus to the canvas host. The items, labels in en/es, are Delete, then (custom only) Rename chip…, Recolour chip… and Look inside. Rename opens `PromptDialog` → `renameChip`. Recolour opens `SwatchPicker` with 8 swatches from the theming palette → `recolorChip`. Look inside → `openChip`.
- **Pin card:** a positioned, non-focusable `div`, `aria-hidden` (its text reaches screen readers through the live region). It shows the name, width, `valueText` and connections, and is kept inside the canvas bounds. A pinned card has a close button and closes on Escape or a tap elsewhere.

- [ ] **Step 1:** Implement the shared components, each with its own story in an existing E2E or a dev check. These are UI-only and excluded from coverage.
- [ ] **Step 2:** Implement the overlays and toolbar. Run `pnpm check`.
- [ ] **Step 3: Commit** `feat(circuit-editor): tool switch, chip menu, pin card and keyboard help`

---

### Task 12: Minimap

**Files:**
- Create: `src/features/circuit-editor/domain/minimap.ts` (+ test), `src/features/circuit-editor/adapters/minimap-renderer.ts`
- Modify: `src/features/circuit-editor/ui/CircuitCanvas.tsx` (+ CSS)

**Interfaces:**
- `minimapTransform(content: Rect | undefined, viewportWorld: Rect, size: Size): { scale; offset }`. It fits the union of content and viewport with a 10% margin.
- `minimapToCamera(transform, point, camera, viewport): Camera` centres the camera on the point.
- The renderer draws chip rects in their colours (no labels) and the viewport rect outline in `--color-selection`. It redraws on the same invalidation as the main canvas, throttled to every other frame during a drag.

- [ ] **Step 1: Failing tests** for the transform and the centring. **Step 2: Implement.** It is hidden below 360 px of canvas width and on `prefers-reduced-motion` the jump is instant (it is always instant; no animation is used). **Step 3: Commit** `feat(circuit-editor): minimap with tap-to-centre`

---

### Task 13: Accessibility summary, E2E, axe and performance

**Files:**
- Modify: `src/features/accessibility/ui/CircuitSummary.tsx` (a selected entry shows "selected"; Phase 6 builds the full structure)
- Modify: `e2e/support.ts`:
  - `touch(page, steps)` dispatches `PointerEvent`s with `pointerType: "touch"` on the canvas host. This is identical across Chromium, WebKit and Firefox;
  - `chipCenter(page, instanceIndex)` computes the screen point from the demo layout and the URL camera;
  - `exportedProject(page)` reads the downloaded JSON.
- Create: `e2e/canvas-pointer.spec.ts`, `e2e/canvas-touch.spec.ts`, `e2e/canvas-keyboard.spec.ts`, `e2e/canvas-perf.spec.ts`, `e2e/fixtures/300-chips.json`
- Modify: `e2e/a11y.spec.ts`, `package.json` (`e2e` greps out `@visual|@perf`; add `e2e:perf`)

**Tests:**
- **Pointer** (desktop projects):
  - drag the NAND 2 grid steps right; the exported position is +80; Undo restores it; the Redo button is enabled;
  - right-click NAND → Delete; `NAND gate 1` leaves the summary; Undo brings it back;
  - box-select both inputs, then Delete, then Undo.
- **Touch** (mobile-chrome, mobile-safari, tablet-safari):
  - a tap selects (announcement);
  - a one-finger drag on the NAND moves it;
  - a long-press on the NAND opens the menu; Delete; Undo;
  - a long-press on pin `a` shows a card with "a", "1 bit" and a value;
  - a two-pointer pinch changes the URL `zoom`;
  - with the Pan tool, a one-finger drag on empty canvas changes `x`/`y`.
- **Keyboard:**
  - Tab to the canvas, press `]` → "NAND gate 1 selected"; ArrowRight ×2 moves it; `Ctrl+Z` undoes;
  - `Delete` removes it, and `Ctrl+Shift+Z` redoes;
  - `Enter` opens the menu, `Escape` returns focus to the canvas;
  - `P` announces the pin;
  - `?` opens help; Tab leaves the canvas (no trap).
- **Axe:** run in each theme with a selection, the menu open, the pinned card open and the help dialog open.
- **Perf `@perf`** (chromium, Pixel 7 emulation, CDP `Emulation.setCPUThrottlingRate {rate: 4}`):
  - import `300-chips.json` (300 chips and 600 wires);
  - drag a 50-chip selection for 2 s while sampling rAF deltas in the page;
  - p95 must be ≤ 20 ms (60 fps target with headroom).
  - Run it locally and in the Task 0 device check; it is not part of the CI gate (too noisy on shared runners).

- [ ] **Step 1:** Write the specs. **Step 2:** `pnpm build && pnpm e2e` (all projects) and `pnpm e2e:perf`. **Step 3: Commit** `test(e2e): touch, pointer and keyboard canvas flows, axe states and a drag budget`

---

### Task 14: ADRs, glossary and the roadmap

**Files:**
- Create: `docs/adr/0042-canvas-gestures-and-tools.md`: the thresholds, the wheel convention, the tool switch, and committing a drag on a second finger.
- Create: `docs/adr/0043-interaction-state-outside-history.md`: selection, camera and tool are not edits; a drag is one action; flattening stays on the main thread (with the Task 1 numbers).
- Modify: `GLOSSARY.md`, adding:
  - **Tool**: what a one-finger drag on empty canvas does;
  - **Selection**;
  - **Marquee**: the box or lasso being drawn;
  - **Pin card**;
  - **Chip menu**;
  - **Camera**: the canvas's zoom and offset;
  - **Minimap**;
  - **Probe**: a signal whose level the engine reports to the main thread.
- Modify: `docs/superpowers/plans/2026-10-29-circuit-editor-roadmap.md`, setting the Phase 2 plan file name.

- [ ] **Step 1:** Write them. **Step 2: Commit** `docs: record canvas gesture and interaction-state decisions`

---

## Done when (issue #13)

- [ ] A chip can be selected, dragged, deleted and undone with touch, mouse and keyboard (Task 13 specs green on every Playwright project).
- [ ] Axe passes in every theme and overlay state.
- [ ] The `@perf` drag budget holds locally, and the Task 0 device check shows a smooth 300-chip drag on a mid-range Android phone and an iPhone.
- [ ] `pnpm check`, `pnpm e2e` and `pnpm e2e:visual:docker` pass. The flattening budget (Task 1) holds in CI.
