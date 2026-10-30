# Editor Phase 3: Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Status

Tasks 1-11 are done. Controller rulings that changed the plan:

- The router routes a batch around settled wires only, so stale routes of pending batch members are not obstacles.
- An edit re-routes only wires newly blocked, per instance, by an instance it placed, moved or resized; wires already blocked elsewhere stay until Re-route or Tidy wires.
- A hand-bent wire whose ends move apart keeps its bends; exactly one end moving re-routes it; both ends moving by the same delta translates it.
- In the Pan tool a drag on a wire pans; branching by drag needs the Select tool, or Branch in the wire menu.
- Keyboard bend editing: `]`/`[` choose a segment and the arrow keys move it.
- Keyboard wire selection: `n`/`N` step through the selected chip's wires.

Known follow-ups:

- Multi-select of wires on touch.
- `n` does not pan the camera to the wire.
- `canvas_hint` does not mention N.
- Glow cost is not measured in CI.
- Chips can be dropped overlapping (carried over from Phase 2).

**Goal:** Let the owner draw, route, colour, branch and reshape wires on the canvas, with routes that go around chips and never lie on top of other wires.

**Architecture:**

- **Router.** A pure, deterministic orthogonal router in `circuit-editor/domain/routing/`: A* on the 20 px pin-cell lattice, with chips as obstacles and an occupancy map of the other wires. It writes each route's bends into `Wire.waypoints`, so drawing never routes.
- **Where routing runs.** Edits that affect wires (connect, move, place, resize, save, re-route, tidy) call the router inside the reducer. The router's output is part of the same single undo step.
- **Interaction.** It gains an *armed pin*, a *wire drag*, a *segment drag* (bend editing), a *bit picker*, a wire menu and a canvas menu. All of these are transient interaction state, outside undo history (ADR 43).
- **Renderer.** It draws per-wire colours (mockup B), a glow on high wires, junction dots, the armed highlight and the drag preview.

**Tech Stack:** TypeScript 7, React 19 + React Compiler, React Aria Components (behind `src/shared/ui`), Zustand (vanilla), Canvas 2D, Zod (trust boundary only), Vitest (v8 coverage), Paraglide JS, Playwright + axe. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-30-editor-phase-3-wiring-design.md`, which builds on `docs/superpowers/specs/2026-10-29-circuit-editor-design.md` §5.2, §5.10 and §5.11 and amends ADR 37.

## Global Constraints

- **Template rules stand** (`CLAUDE.md`):
  - features expose only `index.ts`;
  - `simulation` imports no React or DOM;
  - `shared` imports no feature;
  - no `throw` in `domain/` (return `Result`; lint rule `local/no-throw-in-domain`);
  - Zod only at trust boundaries;
  - only `src/shared/ui` imports `react-aria-components`.
- **Strings:** every user string goes through Paraglide in `en` and `es`. Wire menu strings are `wire_menu_*`, canvas menu strings `canvas_menu_*`, announcements `canvas_*`, and colour names reuse `color_*`.
- **Edits and undo:** every edit is one `EditorAction`, and therefore one undo step (ADR 8). Routing triggered by an edit happens inside that action. The armed pin, the bit picker, bend mode, the menus and the next wire colour are not edits.
- **Targets and gestures:**
  - No target smaller than 24 px. Hit reach is `12 / zoom` world px, as in Phase 2.
  - Nothing is hover-only or right-click-only.
  - Every gesture has a keyboard equivalent.
- **Motion:** under `prefers-reduced-motion`, the new-wire animation is skipped.
- **Route shape:**
  - Routes are orthogonal on the `PIN_CELL` (20 world px) lattice.
  - A route leaves a pin in its side's outward direction: `side: "right"` exits +x, `side: "left"` exits −x.
  - A route never enters a chip rectangle inflated by `PIN_CELL`, except for the one-cell stub at each of its own pins.
- **Spacing:**
  - Two wires of different *signals* never share a lattice edge, and never turn or end on each other's lattice nodes. They may cross at right angles.
  - A signal is `source instanceId + pin + bit + colour`.
  - Wires of the same signal may share edges: that is a trunk, drawn once, with junction dots.
- **The router never moves a wire the edit did not affect** (owner). The only exception is Tidy wires, which re-routes every automatic wire in the open chip on request.
- **Hand bends** (`manualWaypoints: true`):
  - They are dropped and re-routed when exactly one end chip moves.
  - They are translated when both ends move by the same delta.
  - Otherwise they are never changed by the router.
- **Wire colours:**
  - The palette keys are `blue, red, orange, yellow, green, teal, purple, pink`. A missing key means default.
  - A default wire keeps `signal-high`, or dashed `signal-low`.
  - A coloured wire is drawn in full colour when on, and in muted, dashed colour when off.
  - Unknown levels stay as today: the `wire` token, solid.
- **Glow:** high wires get a glow (a wide, low-alpha stroke, not `shadowBlur`). There is no glow below zoom `0.5`.
- **Drag budget still holds:** the `@perf` drag p95 must stay ≤ 20 ms (300 chips and 600 wires, 4× throttle, Pixel 7). Routing never runs per frame. During a drag, wires touching moved chips draw the simple elbow preview.
- **Coverage:** 95% per-file branch coverage on `src/features/*/domain/**` and `src/shared/**/*.ts`. The unit-test environment is `node`, so testable logic belongs in `domain/`.
- **Lint limits:**
  - files ≤ 300 lines;
  - functions ≤ 50 lines;
  - ≤ 3 params (use an options object);
  - complexity ≤ 10;
  - knip fails on unused exports.
  - Put new logic in new files: `gestures.ts` (298 lines) and `interaction-commands.ts` (270) are near the line cap.
- **Existing E2E names keep working:** `Input A`, `Input B`, `Output: 1`, `NAND gate 1`, `Add NAND`, `Undo`, `Redo`. Existing E2E specs keep passing. Change a spec only where this plan changes the behaviour it pins, and say so in the commit.
- **Visual baselines** change (glow, routed demo wires). Regenerate them only with `pnpm e2e:visual:docker`, and never commit macOS baselines.
- **Commits:** Conventional Commits, at least one per task, never bypassing hooks (ADR 13, 31).

## Decisions this plan fixes (builder calls)

- **No format version bump.**
  - `Wire.color` is an optional field, so version-1 files parse unchanged and a version-1 app ignores the key (Zod strips unknown keys).
  - The design's "version goes up, with a migration" is dropped as unnecessary.
  - `CURRENT_FORMAT_VERSION` stays `1`.
- **Wire colour tokens:**
  - Each of the 8 keys gets two theme tokens, `colorWire<Key>` and `colorWire<Key>Muted`, in every theme. They become `--color-wire-<key>` and `--color-wire-<key>-muted`.
  - Every value must have contrast ≥ 3:1 against `colorBackground` in its theme (WCAG 1.4.11, non-text). Dashes, not colour, carry "off".
  - High contrast uses saturated values. On wires are drawn 1 px thicker than off wires in every theme.
- **Tap on a pin now arms it.** It no longer selects the chip or opens a touch card. Long-press and hover still open the pin card, and keyboard `P` still steps pins.
  - A drag that starts on a pin draws a wire. It no longer moves the chip.
  - A drag on the chip body still moves the chip.
- **Second tap while armed:**
  - On a legal pin, it connects, or opens the bit picker when a bit choice is needed.
  - On an illegal pin, it re-arms that pin.
  - On empty canvas, it cancels.
  - On a chip body or a wire, it cancels and then behaves as a normal tap.
- **Bit picker.**
  - It is a `PointMenu` whose entries are the legal bits (`d0`…).
  - It is needed when one end is 1-bit and the other is a bus with no bit chosen. The bit goes on the bus end's `PinRef.bit`.
  - When only one bit is legal, it connects directly, with no picker.
- **Branch:**
  - A drag that starts on a wire, or "Branch" in the wire menu, arms that wire's `from` (source, with its bit). The armed colour is that wire's `color`.
  - Otherwise the armed colour is `state.wireColor` (next wire colour).
- **Menus:** `InteractionState.menu` becomes a union:
  - `{ kind: "chip"; instanceId; screen }`
  - `{ kind: "wire"; wireId; screen }`
  - `{ kind: "canvas"; screen }`
- **Menu triggers:**
  - Long-press or right-click on a wire opens the wire menu, which also selects the wire unless it is already in a multi-selection.
  - Long-press on empty canvas keeps arming the lasso, as in Phase 2.
  - Right-click on empty canvas, or `Enter` with nothing selected, opens the canvas menu.
  - The toolbar also gets a "Tidy wires" button, so the canvas menu is never the only path.
- **Wire menu entries** are Colour…, Move bends, Re-route, Branch and Delete.
  - With several wires selected, only Colour… and Delete are shown.
  - Both apply to every selected wire.
- **Bend editing** ("Move bends") enters bend mode for one wire.
  - Each interior segment shows a 24 px handle at its midpoint.
  - Dragging a handle moves that segment perpendicular to itself, snapped to `PIN_CELL`, and the neighbouring segments stretch.
  - The first and last stubs are fixed.
  - Release commits one `moveWaypoint`, which sets `manualWaypoints: true`.
  - `Escape`, or a tap elsewhere, leaves bend mode.
- **Keyboard wiring:**
  - `w` arms the pin shown in the pin card (stepped with `p`/`P`). With no pin card, it arms the focused chip's first pin.
  - While armed, `]`/`[` and `p`/`P` move as usual, and `Enter` connects to the pin in the card.
  - `Escape` cancels the armed pin (before anything else).
  - `Enter` with only wires selected opens the wire menu.
  - `Enter` with nothing selected opens the canvas menu.
- **New-wire animation** is renderer-only. A wire id appearing in the circuit is revealed along its route over 250 ms, and the reveal is skipped under reduced motion.
- **Router search:**
  - The state is `(node, heading)`.
  - Costs:
    - `1` per cell;
    - `+3` per bend;
    - `+4` per perpendicular crossing of another signal;
    - `0.5` per cell on an edge already used by the same signal (trunk merging).
  - The search window is the endpoints' bounding box padded by 8 cells. On failure it doubles the padding, up to 3 tries, then falls back.
  - Ties break by insertion order, so routes are deterministic.
- **Fallback when there is no legal route:**
  1. Route again, letting other signals' edges cost `+20` each instead of being forbidden.
  2. If that also fails (a pin boxed in by chips), return `err({ type: "NoRoute" })`. The caller keeps `waypoints: []`, which draws the elbow. Routing never throws, and `connectWire` still succeeds.

## Review Focus

1. **A feedback wire from a chip to its own input**, as in an SR or D latch (NAND out → the same NAND's `a`). It must be legal and must route around the chip, leaving right and entering left. *Task 2 test `routes a self-loop around its own chip`.*
2. **Undo after connect removes the wire and its route; redo restores the identical route.** Routing is deterministic. *Task 4 test `connect, undo, redo gives the same waypoints`.*
3. **The armed pin's chip disappears** (undo, delete, opening another chip). The armed state, bit picker, bend mode and wire menu must be dropped, not left pointing at nothing. *Task 6 test `afterHistory drops armed, bitPick, bends and menus whose targets are gone`.*
4. **A pin boxed in by chips (no legal route).** Connecting still succeeds and draws the elbow. Nothing throws, and no route passes through a chip. *Task 2 test `returns NoRoute when the pin is enclosed`, and Task 4 test `connectWire succeeds with empty waypoints when unroutable`.*
5. **Tapping an output that already feeds wires, then an input.** That adds a branch with the same signal: it shares a trunk and gets a junction dot. It is not rejected. Tapping an input that is already driven fades it as illegal. *Task 5 test `an already-driven input is not a legal target`, and Task 8 test `two wires of one signal share their trunk and get one junction`.*

---

## File Structure

```
src/shared/color.ts                         NEW  hex parsing + mix (used by the token contrast tests)
src/features/theming/domain/themes.ts       + 16 wire colour tokens per theme (Task 3)
src/features/projects/domain/model.ts       + WireColorSchema, Wire.color? (Task 3)
src/features/projects/index.ts              + WireColor, WIRE_COLORS
src/features/circuit-editor/domain/
  chip-layout.ts            pin anchors snapped to PIN_CELL (Task 1)
  routing/lattice.ts        NEW  node/edge keys, chip obstacles, occupancy from routes (Task 2)
  routing/search.ts         NEW  A* (binary heap inline), headings, costs (Task 2)
  routing/route.ts          NEW  routeWire, rerouted, rerouteBlocked, routeUnrouted, signalOf (Task 2)
  geometry.ts               wireRoute preview rules during a drag (Task 4)
  actions.ts, reducer.ts, editor-error-messages.ts   + recolorWires, rerouteWires; connectWire.color (Task 4)
  wire-edits.ts             NEW  connectWire (moved from circuit-edits), recolorWires, rerouteWires (Task 4)
  batch-edits.ts            moveChips re-routes affected wires (Task 4)
  wiring-targets.ts         NEW  legalTargets, bitChoices (Task 5)
  interaction.ts            + armed, bitPick, bends, wireColor, menu union, Drag kinds (Task 6)
  interaction-wiring.ts     NEW  arm / connect / cancel / wire drag / bit pick (Task 6)
  interaction-bends.ts      NEW  bend mode, segment drag, moveSegment (Task 7)
  interaction-menus.ts      NEW  wire/canvas menus, recolour/tidy/re-route/branch commands (Task 7)
  keymap.ts                 + w, Enter routing to wire/canvas menus (Task 7)
  junctions.ts              NEW  junction points of same-signal routes (Task 8)
src/features/circuit-editor/application/
  editor-store.ts           routeUnrouted on create/openChip, outside history (Task 4)
  interaction-store.ts      context.newWireId (Task 6)
src/features/circuit-editor/adapters/
  frame.ts                  wire colour tokens, wireColor(palette, wire, level) (Task 8)
  draw-wires.ts             NEW  coloured/glow/batched wire drawing (split out of draw-parts.ts) (Task 8)
  draw-wiring.ts            NEW  armed highlight, faded pins, wire-drag preview, bend handles, reveal (Task 8)
src/features/circuit-editor/ui/
  CanvasOverlays.tsx        wire/canvas menus, bit picker, wire colour dialog (Task 9)
  WireDialogs.tsx           NEW  WireColorDialog (Task 9)
  EditorToolbar.tsx         + next wire colour, Tidy wires (Task 9)
  KeyboardHelp entries      + w, Enter variants (Task 9)
e2e/support.ts              + pinPoint, exported wires (Task 10)
e2e/canvas-wiring.spec.ts, e2e/fixtures/bus.json      NEW (Task 10)
docs/adr/0044-wiring-routing-and-colours.md, GLOSSARY.md, roadmap   (Task 11)
messages/en.json, messages/es.json
```

---

### Task 1: Pin anchors on the half-grid

**Files:**
- Modify: `src/features/circuit-editor/domain/chip-layout.ts` (`placeSide`, about line 171)
- Test: `src/features/circuit-editor/domain/chip-layout.test.ts`

**Interfaces:**
- Produces: every `ChipLayout.pins[i].anchor.y - rect.y` is a multiple of `PIN_CELL`, and `anchor.x` is `rect.x` or `rect.x + rect.width`, both multiples of `GRID`. The router (Task 2) relies on this.

- [ ] **Step 1: Failing test.** Write `pin anchors sit on the PIN_CELL lattice`. For a custom chip with 3 inputs (1-bit) and 2 outputs (1-bit), and for one with a 4-bit and a 1-bit input, assert `(anchor.y - rect.y) % PIN_CELL === 0` for every pin. Also assert that the pins keep their order and stay inside `rect`. Also assert that the NAND's anchors are unchanged: `a` and `b` at `y + 20` and `y + 60`, `out` at `y + 40`.
- [ ] **Step 2:** Run `pnpm vitest run src/features/circuit-editor/domain/chip-layout.test.ts`. Expected: FAIL. The 3-in/2-out chip has outputs at `+33.3`.
- [ ] **Step 3: Implement.** In `placeSide`, round each slot's centre to the nearest multiple of `PIN_CELL` from `rect.y`. Rounding must keep pins strictly increasing; if two would collide, push the later one down one cell. The chip height already holds every slot, so a push never leaves the rect. Tabs follow their anchor.
- [ ] **Step 4:** Run the chip-layout, geometry and hit-test tests. Expected: PASS. Update any test that hard-coded a fractional anchor, and name each one in the commit body.
- [ ] **Step 5: Commit.** `feat(circuit-editor): snap pin anchors to the half-grid`

---

### Task 2: The router (spike plus core)

This task is the roadmap's Phase 3 router spike. It ships real code, and it records its measured speed in the perf test's budget comment.

**Files:**
- Create:
  - `src/features/circuit-editor/domain/routing/lattice.ts`
  - `routing/search.ts`
  - `routing/route.ts`
  - their `*.test.ts`
  - `routing/route-perf.test.ts`
  - `routing/routing.fixtures.ts`
- Test: same folder

**Interfaces:**
- Consumes: `Scene`, `layoutIn`, `pinPosition` (`geometry.ts`); `ChipLayout` and `PIN_CELL` (`chip-layout.ts`); `Wire` and `WireId` (`~/features/projects`); `Result`, `ok` and `err` (`~/shared/result`).
- Produces (exported from `routing/route.ts` only; `lattice.ts` and `search.ts` stay internal to the folder):

```ts
export type RouteError = { readonly type: "NoRoute"; readonly wireId: WireId };
/** Interior bends only: the full polyline is [startAnchor, ...waypoints, endAnchor]. */
export const routeWire = (scene: Scene, wire: Wire, others: readonly Wire[]): Result<readonly Point[], RouteError>;
/** Routes `wireIds` one by one (circuit order), each around every other wire's current route; NoRoute keeps waypoints []. Sets manualWaypoints false. Other wires are untouched. */
export const rerouted = (scene: Scene, wireIds: ReadonlySet<WireId>): Circuit;
/** Automatic wires whose current route enters an inflated chip rect (other than their own stubs). */
export const blockedWires = (scene: Scene): ReadonlySet<WireId>;
/** Automatic wires with no waypoints. */
export const unroutedWires = (circuit: Circuit): ReadonlySet<WireId>;
export const signalOf = (wire: Wire): string; // `${from.instanceId}:${String(from.pin)}:${from.bit ?? "*"}:${wire.color ?? "default"}`
```

  - `rerouted` returns `scene.circuit` with only those wires changed.
  - `others` means the circuit's other wires, read through `wireRoute`. A wire with empty waypoints and an automatic flag is read as its elbow, so it occupies its elbow path.
  - Waypoints exclude the two anchors, and consecutive collinear points are merged.

- [ ] **Step 1: Failing tests** in `route.test.ts`, using `routing.fixtures.ts` builders (a scene from instances and wires at given positions):
  - `routes straight when the input is level and to the right`: NAND out → NAND `a` at the same y gives `[]` or collinear points only, so the polyline is one horizontal segment.
  - `leaves outputs rightward and enters inputs from the left`: the first route segment has +x heading, and the last has +x heading into a left-side pin.
  - `never enters an inflated chip rect`: a chip placed between source and sink makes every segment (except the two stubs) avoid every chip `rect` inflated by `PIN_CELL`.
  - `routes a self-loop around its own chip`: NAND out → the same NAND `a`. The route goes around the outside of the chip, and the assertion is that no segment enters the inflated rect.
  - `does not share an edge with another signal`: two wires from different sources that would naturally overlap. Their routes share no lattice edge, and their parallel runs are ≥ `PIN_CELL` apart.
  - `crosses at right angles when it must` and `does not turn on another signal's node`.
  - `shares the trunk with the same signal`: two wires from one output to two inputs share their first segments.
  - `is deterministic`: the same scene twice gives deep-equal waypoints.
  - `returns NoRoute when the pin is enclosed`: a pin surrounded by chips on every lattice exit gives `err({type: "NoRoute", wireId})`.
  - `rerouted leaves untouched wires identical`: the same object identity for wires not in `wireIds`.
  - `blockedWires finds an automatic wire under a newly placed chip and skips manual ones`.
- [ ] **Step 2:** Run `pnpm vitest run src/features/circuit-editor/domain/routing`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement.**
  - **`lattice.ts`:**
    - It keys nodes on `PIN_CELL` multiples, as `"x,y"` in cell units.
    - Obstacles are chip rects inflated by one cell. Each wire's own two stub cells are allowed.
    - Occupancy maps edges and nodes to signal ids, built from the other wires' `wireRoute` polylines.
  - **`search.ts`:** A* over `(node, heading)` with Manhattan heuristic, costs and search window as in "Decisions". The heap is an inline binary heap. Tie-break on a monotonic counter.
  - **`route.ts`:** composes the two and applies the fallback in "Decisions".
  - No allocation per node beyond the open set. Keys are numbers where it measurably helps.
- [ ] **Step 4:** Run the routing tests. Expected: PASS, with ≥ 95% branch coverage per file (`pnpm test` reports it).
- [ ] **Step 5: Perf test** in `route-perf.test.ts`, following `to-netlist-source-perf.test.ts` (a `median` of 5 runs):
  - Build 300 NANDs on a 20-column grid with pitch `{x: 200, y: 120}`, plus 600 automatic wires. This is the shape of `e2e/fixtures/300-chips.json`.
  - Test `re-routes the wires of a 50-chip selection quickly`: `rerouted` on every wire touching 50 chips.
  - Measure locally. If the median exceeds 25 ms in Node, optimise before going on; 25 ms here is about 100 ms on the Pixel 7 profile.
  - Set `REROUTE_50_BUDGET_MS` to 4× the measured median and write the measured number in the comment, as the netlist perf test does.
  - Add `scales near-linearly`: 2× the circuit size costs < 3× the time.
- [ ] **Step 6: Commit.** `feat(circuit-editor): orthogonal wire router that avoids chips and other signals`

---

### Task 3: Wire colour in the model and the theme

**Files:**
- Modify:
  - `src/features/projects/domain/model.ts` (WireSchema, about line 77)
  - `src/features/projects/index.ts`
  - `src/features/theming/domain/themes.ts`
  - `src/features/theming/tokens.css` (regenerate with `pnpm tokens`)
- Create: `src/shared/color.ts` (+ test)
- Test: `src/features/projects/domain/format.test.ts`, `src/features/theming/domain/themes.test.ts`

**Interfaces:**
- Produces:
  - `export const WIRE_COLORS = ["blue","red","orange","yellow","green","teal","purple","pink"] as const;`
  - `export type WireColor = (typeof WIRE_COLORS)[number];`
  - `Wire` gains `readonly color?: WireColor`.
  - Theme tokens `colorWireBlue`, `colorWireBlueMuted`, and so on for each key. They become CSS `--color-wire-blue` and `--color-wire-blue-muted`.
  - `src/shared/color.ts`: `export const parseHex = (hex: string): Result<Rgb, "InvalidHex">`. Keep any existing contrast helper in `contrast.ts`; add `parseHex` there only if `contrast.ts` already parses hex. Prefer extending `contrast.ts` and dropping the new file if it already has the parsing.

- [ ] **Step 1: Failing tests:**
  - `format.test.ts`:
    - `a version-1 file without wire colours parses`;
    - `a wire colour round-trips through serialize and parse`;
    - `an unknown wire colour is rejected` (`InvalidProject`).
  - `themes.test.ts`: `every wire colour and its muted form reach 3:1 against the background in every theme`. Loop over `themeIds` × `WIRE_COLORS` × `{on, muted}` and assert `contrastRatio(value, colorBackground) >= 3`.
- [ ] **Step 2:** Run both. Expected: FAIL.
- [ ] **Step 3: Implement.** Make `color` an optional enum on `WireSchema`. Choose the 16 hex values per theme so the contrast test passes, and keep muted visibly dimmer than on. Run `pnpm tokens`.
- [ ] **Step 4:** Run `pnpm vitest run src/features/projects src/features/theming`. Expected: PASS. `CURRENT_FORMAT_VERSION` is still `1`.
- [ ] **Step 5: Commit.** `feat(projects): optional wire colour with theme tokens for each palette key`

---

### Task 4: Routing inside the edits

**Files:**
- Create: `src/features/circuit-editor/domain/wire-edits.ts` (+ test). Move `connectWire` here from `circuit-edits.ts`.
- Modify:
  - `actions.ts`
  - `reducer.ts`
  - `editor-error-messages.ts`
  - `batch-edits.ts` (`carried`, `moveChips`)
  - `circuit-edits.ts` (`placeChip`)
  - the `addPin`/`setPinWidth` edits
  - `geometry.ts` (`wireRoute`)
  - `application/editor-store.ts`
  - `messages/*.json`
- Test: `wire-edits.test.ts`, `batch-edits.test.ts`, `reducer.test.ts`, `geometry.test.ts`, `editor-store.test.ts`

**Interfaces:**
- Consumes: Task 2's `rerouted`, `blockedWires`, `unroutedWires`; Task 3's `WireColor`.
- Produces:

```ts
// actions.ts additions
| { readonly type: "connectWire"; chipId; wireId; from: PinRef; to: PinRef; readonly color?: WireColor }
| { readonly type: "recolorWires"; readonly chipId: ChipId; readonly wireIds: readonly WireId[]; readonly color?: WireColor }
| { readonly type: "rerouteWires"; readonly chipId: ChipId; readonly wireIds: readonly WireId[] }
// EditorError addition
| { readonly type: "NothingToRecolor" } | { readonly type: "NothingToReroute" }
// editor-store.ts
export const routeUnrouted = (project: Project): Project; // every chip's draft: rerouted(unroutedWires); exported for the store test only via the store's behaviour (do not export if knip objects; test through createEditorStore)
```

- **Rules:**
  - **`connectWire`:** after `checkConnection`, append the wire with `color` and route only that wire.
  - **`recolorWires`:** set `color` on each wire, or remove it when `color` is undefined. An unknown id gives `WireNotFound`; an empty list gives `NothingToRecolor`. It does not re-route.
  - **`rerouteWires`:** set `manualWaypoints: false` and call `rerouted` on those ids. An empty list gives `NothingToReroute`. Tidy wires passes every automatic wire id.
  - **`moveChips`:**
    - A manual wire whose both ends moved by the same delta is translated by `carried`.
    - Any other wire touching a moved chip becomes automatic and is re-routed.
    - Then the automatic wires in `blockedWires` of the new scene are re-routed.
    - All of this is one action.
  - **`placeChip`, `addPin`, `setPinWidth`:** after the edit, re-route `blockedWires`.
  - **`saveChip`:** after the cascade, re-route `blockedWires` in every draft that contains an instance of the saved chip. Do this in the reducer wrapper, because `projects` cannot import the router.
  - **`wireRoute` during a drag** (`scene.positions` non-empty):
    - A wire with exactly one moved end, or an automatic wire with any moved end, returns the elbow `[start, {midX, start.y}, {midX, end.y}, end]`.
    - A manual wire with both ends moved by the same delta returns its translated waypoints.
    - Everything else is unchanged.
  - **The editor store** applies `routeUnrouted` to the initial project and on `openChip` with `mapHistory`, so all snapshots change and history length does not. It is not an undo step.

- [ ] **Step 1: Failing tests:**
  - `connectWire routes the new wire and stores its colour`;
  - `connect, undo, redo gives the same waypoints` (through the editor store);
  - `connectWire succeeds with empty waypoints when unroutable`;
  - `recolorWires recolours many in one action and clears with undefined`;
  - `recolorWires rejects an empty list and unknown ids`;
  - `rerouteWires makes a manual wire automatic`;
  - `moveChips drops hand bends when one end moves`;
  - `moveChips translates hand bends when both ends move together`;
  - `moveChips re-routes an automatic wire the moved chip now blocks and leaves other wires identical`;
  - `placeChip re-routes wires under the new chip`;
  - `wireRoute previews the elbow for a wire with one moved end`;
  - `opening a project routes unrouted wires without adding history`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3: Implement** to the rules above. Add the `MESSAGES` entries and the `en`/`es` keys `editor_error_nothing_to_recolor` and `editor_error_nothing_to_reroute`.
- [ ] **Step 4:** Run `pnpm vitest run src/features/circuit-editor`. Expected: PASS. Fix Phase 2 tests that assumed elbows or unrouted wires, and name each one in the commit body.
- [ ] **Step 5: Commit.** `feat(circuit-editor): route wires inside connect, move, place and resize edits`

---

### Task 5: Legal targets and bit choices

**Files:**
- Create: `src/features/circuit-editor/domain/wiring-targets.ts` (+ test)
- Modify: `src/features/circuit-editor/domain/pin-info.ts`, `ui/CanvasOverlays.tsx` (PinCard), `messages/*.json`

**Interfaces:**
- Consumes: `checkConnection` and `endpointInfo` (`~/features/projects`); `pinLevelKey` (`signals.ts`).
- Produces:

```ts
/** pinLevelKey of every pin that can take a wire from `armed` (some bit choice may be needed). */
export const legalTargets = (scene: Scene, armed: PinRef): ReadonlySet<string>;
export type Completion =
  | { readonly type: "connect"; readonly from: PinRef; readonly to: PinRef }
  | { readonly type: "pickBit"; readonly bus: "armed" | "target"; readonly bits: readonly number[] }
  | { readonly type: "illegal" };
/** What tapping `target` while `armed` does. */
export const completionFor = (scene: Scene, armed: PinRef, target: PinRef): Completion;
/** Bits of a bus pin that have a wire attached (spec §5.10: the pin card shows them). */
export const usedBits = (circuit: Circuit, instanceId: InstanceId, pin: PinKey): readonly number[];
```
- Modify: `domain/pin-info.ts` adds `usedBits` to the pin card model, and the PinCard UI shows `pin_card_bits_used` "Bits used: {bits}" (en/es) for bus pins.

- [ ] **Step 1: Failing tests:**
  - `a NAND output can reach both inputs of another NAND`;
  - `output to output is not legal`;
  - `an already-driven input is not a legal target`;
  - `a 1-bit armed pin finds a 4-bit pin legal and asks for a bit`. The test checks `pickBit` with the free bits only, after one bit is already driven;
  - `one free bit connects directly`;
  - `bus to bus needs equal width`;
  - `an armed bus and a 1-bit target picks on the armed end`;
  - `a pin's own chip is legal for a feedback loop` (NAND out → own `a`);
  - `usedBits lists tapped bits of a bus pin`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3: Implement** by trying `checkConnection`. When the result is `WidthMismatch` with a 1-bit side and a bus side, try each bit on the bus end.
- [ ] **Step 4:** Run the tests. Expected: PASS, with coverage ≥ 95%.
- [ ] **Step 5: Commit.** `feat(circuit-editor): legal wiring targets and bit choices`

---

### Task 6: Arming, wire drag and the bit picker (interaction)

**Files:**
- Create: `src/features/circuit-editor/domain/interaction-wiring.ts` (+ test)
- Modify:
  - `interaction.ts` (state, Drag, menu union, `afterHistory`, `withoutOverlays`)
  - `interaction-gestures.ts` (tap or drag on a pin or wire)
  - `interaction-drag.ts` (`dragFor`, `moved`, `onDragEnd` for `"wire"`)
  - `interact.ts`
  - `announcements.ts`
  - `application/interaction-store.ts` (`newWireId`)
  - `messages/*.json`
- Test: `interaction-wiring.test.ts`, `interaction.test.ts`

**Interfaces:**
- Consumes: Task 5's `legalTargets` and `completionFor`; `WireColor`.
- Produces:

```ts
// interaction.ts
export interface Armed { readonly end: PinRef; readonly color?: WireColor; readonly legal: ReadonlySet<string> }
export interface BitPick { readonly armed: PinRef; readonly target: PinRef; readonly bus: "armed" | "target"; readonly bits: readonly number[]; readonly color?: WireColor; readonly screen: Point }
export type Menu =
  | { readonly kind: "chip"; readonly instanceId: InstanceId; readonly screen: Point }
  | { readonly kind: "wire"; readonly wireId: WireId; readonly screen: Point }
  | { readonly kind: "canvas"; readonly screen: Point };
// InteractionState gains: armed?: Armed; bitPick?: BitPick; bends?: WireId; wireColor?: WireColor; menu?: Menu (replaces ChipMenu)
// Drag gains: | { kind: "wire"; from: PinRef; color?: WireColor; point: Point /* world */ }
//             | { kind: "segment"; wireId: WireId; index: number; offset: number }   (Task 7 fills in)
// InteractionCommand gains: | { type: "arm" } | { type: "connect" } | { type: "pickBit"; bit: number } | { type: "setWireColor"; color?: WireColor }
// Announcement gains: | { type: "armed"; instanceId; pin } | { type: "wired" } | { type: "disarmed" }
// InteractionContext gains: readonly newWireId: () => WireId
```

- **Rules:** as in "Decisions": tap pin arms, second tap, drag from a pin, drag from a wire branches, and the bit picker.
  - A connection emits `dispatch connectWire { wireId: context.newWireId(), from, to, color }` and announces `wired`.
  - `escape` cancels `bitPick`, then `armed`, before the Phase 2 order.
  - `withoutOverlays` also drops `bitPick`. It keeps `armed`, because pinch and pan don't cancel wiring.
  - `afterHistory` drops `armed`, `bitPick`, `bends` and any `menu` whose instance or wire is gone, and recomputes `armed.legal`.
  - Strings: `canvas_armed` "{pin} of {chip} ready to wire", `canvas_wired` "Wire added", `canvas_disarmed` "Wiring cancelled", with `es` too.

- [ ] **Step 1: Failing tests:**
  - `tapping a pin arms it with its legal targets`;
  - `tapping a legal pin connects with the next wire colour`;
  - `tapping an illegal pin re-arms it`;
  - `tapping empty canvas cancels`;
  - `tapping a chip body cancels and selects it`;
  - `a drag from a pin draws a wire and connects on release over a legal pin within reach`;
  - `a drag from a pin released elsewhere connects nothing`;
  - `a drag from a wire branches with the wire's colour`;
  - `a target needing a bit opens the bit picker and pickBit connects`;
  - `escape closes the picker, then disarms`;
  - `pinch keeps the armed pin`;
  - `afterHistory drops armed, bitPick, bends and menus whose targets are gone`;
  - `a drag on a chip body still moves it` (Phase 2 behaviour kept).
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3: Implement.** Keep `interaction-gestures.ts` and `interaction-drag.ts` under 300 lines by delegating pin and wire cases to `interaction-wiring.ts`.
- [ ] **Step 4:** Run `pnpm vitest run src/features/circuit-editor`. Expected: PASS. Phase 2 tests that pinned "tap pin selects the chip" or "drag from pin moves the chip" are updated to the new rule; list them in the commit body.
- [ ] **Step 5: Commit.** `feat(circuit-editor): arm a pin, drag or tap to wire, and pick a bus bit`

---

### Task 7: Wire and canvas menus, recolour, re-route, tidy, bends and keys

**Files:**
- Create: `src/features/circuit-editor/domain/interaction-menus.ts`, `interaction-bends.ts` (+ tests)
- Modify:
  - `interaction-gestures.ts` (long-press or right-click on a wire, right-click on empty)
  - `interaction-commands.ts` (`openMenu` routing)
  - `interaction-drag.ts` (`segment` drag)
  - `hit-test.ts`: segment hits in bend mode, either as a new `Hit` member `{ type: "segment"; wireId; index }` or as a separate `segmentAt(index, point, zoom, wireId)`. Choose whichever keeps `hitTest` under complexity 10.
  - `keymap.ts`
- Test: `interaction-menus.test.ts`, `interaction-bends.test.ts`, `keymap.test.ts`

**Interfaces:**
- Consumes: Task 6's `Menu`, state fields and `Drag` `segment`; Task 4's actions.
- Produces:

```ts
// InteractionCommand gains: | { type: "recolorSelection"; color?: WireColor } | { type: "rerouteWire"; wireId } | { type: "tidyWires" }
//                           | { type: "branch"; wireId } | { type: "editBends"; wireId }
/** Moves interior segment `index` of `route` (full polyline) perpendicular by `offset` world px, snapped to PIN_CELL; returns new interior waypoints. Stubs (first, last segment) never move. */
export const moveSegment = (route: readonly Point[], index: number, offset: number): readonly Point[];
```

- **Rules:**
  - Menu triggers and entries are as in "Decisions".
  - `recolorSelection` dispatches one `recolorWires` for every selected wire.
  - `tidyWires` dispatches one `rerouteWires` with every automatic wire in the open chip.
  - `rerouteWire` dispatches `rerouteWires` for that one id.
  - `branch` arms the wire's `from` with its colour.
  - `editBends` sets `bends`. A segment drag in bend mode commits one `moveWaypoint` on release, and no action is dispatched before release.
  - Keymap: `w` → `arm`; `Enter` → `connect` when armed, else `openMenu`. `openMenu` picks the chip, wire or canvas menu from the selection.
- [ ] **Step 1: Failing tests:**
  - `long-press on a wire opens the wire menu and selects it`;
  - `right-click on empty canvas opens the canvas menu`;
  - `long-press on empty canvas still arms the lasso`;
  - `recolorSelection recolours every selected wire in one dispatch`;
  - `tidyWires sends every automatic wire and skips manual ones`;
  - `moveSegment keeps right angles and snaps to the half-grid`;
  - `moveSegment never moves the stubs`;
  - `a segment drag dispatches one moveWaypoint on release`;
  - `w arms the pin in the card`;
  - `Enter connects when armed`;
  - `Enter with only wires selected opens the wire menu`;
  - `Enter with nothing selected opens the canvas menu`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Run `pnpm vitest run src/features/circuit-editor`. Expected: PASS, with coverage ≥ 95%.
- [ ] **Step 5: Commit.** `feat(circuit-editor): wire and canvas menus, recolour, re-route, tidy and bend editing`

---

### Task 8: Drawing wires: colours, glow, junctions, armed state, previews and reveal

**Files:**
- Create:
  - `src/features/circuit-editor/domain/junctions.ts` (+ test)
  - `adapters/draw-wires.ts` (wire drawing moved out of `draw-parts.ts`)
  - `adapters/draw-wiring.ts`
- Modify:
  - `adapters/frame.ts` (TOKENS gains `wire-<key>` and `wire-<key>-muted`)
  - `adapters/canvas-renderer.ts`
  - `adapters/static-layer.ts` (key)
  - `adapters/draw-overlays.ts` (`OverlayView`)
  - `ui/use-canvas.ts` (`renderStateOf` passes `armed`, the wire drag, `bends` and `zoom`)

**Interfaces:**
- Consumes: the Task 6 and Task 7 state, and Task 3's tokens.
- Produces:

```ts
/** Points where three or more route directions of one signal meet. */
export const junctions = (routes: ReadonlyMap<string /* signal */, readonly (readonly Point[])[]>): readonly Point[];
// OverlayView gains: armed?: { end: Point; legal: ReadonlySet<string> }; wireDrag?: { from: Point; to: Point; color?: WireColor }; bends?: { wireId: WireId }
```

- **Rules:**
  - **Stroke colour:** `strokeFor(palette, wire, level)` gives:
    - a default wire: today's colours;
    - a coloured wire that is high: `wire-<key>`;
    - a coloured wire that is low: `wire-<key>-muted`, dashed `[6,4]`;
    - an unknown level: `wire`.
  - **Width:** on wires are `WIRE_WIDTH + 1`.
  - **Glow:** under each high wire, draw the same path at `lineWidth 9`, `globalAlpha 0.25`. Skip it when `view.zoom < 0.5`.
  - **Batching:** batch strokes by `(stroke, dash, width)`.
  - **Junction dots:** radius 4 world px, in the trunk's colour.
  - **Armed state:** the armed pin gets a `focus-ring` ring. Pins not in `legal` are drawn at `globalAlpha 0.35` while armed.
  - **Wire drag:** drawn as a dashed elbow in the armed colour.
  - **Bend handles:** a 24 px circle (screen size, so `/ zoom`) at each interior segment midpoint.
  - **Reveal:** the renderer remembers the last frame's wire ids. A new id is drawn with `setLineDash([revealed, total])`, growing over 250 ms, with one rAF loop until done. It is skipped when `matchMedia("(prefers-reduced-motion: reduce)")` matches.
  - **Static-layer key:** `StaticKey` gains `zoomBand: zoom < 0.5`.
- [ ] **Step 1: Failing tests** (domain only):
  - `two wires of one signal share their trunk and get one junction`;
  - `different signals produce no junction where they cross`;
  - `a straight trunk with no split has no junction`.
- [ ] **Step 2:** Run `pnpm vitest run src/features/circuit-editor/domain/junctions.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `junctions.ts`, then the adapters.
- [ ] **Step 4:**
  - Run `pnpm check`. Expected: PASS.
  - Run `pnpm build`, then `pnpm e2e:perf`. Expected: p95 ≤ 20 ms. Record it in the commit body.
  - Then run `pnpm e2e:visual:docker -- --update-snapshots`, and look at each changed baseline before committing it. The glow and the routed demo wires are expected changes.
  - Delete `.pnpm-store/` afterwards.
- [ ] **Step 5: Commit.** `feat(circuit-editor): draw wire colours, glow, junctions, armed pins and new-wire reveal`

---

### Task 9: UI: menus, bit picker, colour dialog, toolbar and help

**Files:**
- Create: `src/features/circuit-editor/ui/WireDialogs.tsx`
- Modify:
  - `ui/CanvasOverlays.tsx`
  - `ui/EditorToolbar.tsx`
  - `ui/ChipDialogs.tsx`: move the swatch list into a shared module only if both dialogs need it. Wire swatches come from `WIRE_COLORS` and the CSS tokens, not chip hexes.
  - the keyboard help entries
  - `messages/*.json`

**Interfaces:**
- Consumes: the Task 6 and Task 7 commands and state; `PointMenu`, `SwatchPicker` and `ModalDialog` (`~/shared/ui`).
- **Rules:**
  - **Wire menu:** `PointMenu` with `wire_menu_label` "Wire actions". The entries `wire_menu_color` "Colour…", `wire_menu_bends` "Move bends", `wire_menu_reroute` "Re-route", `wire_menu_branch` "Branch" and `wire_menu_delete` "Delete" map to the commands.
  - **Canvas menu:** `canvas_menu_label` "Canvas actions" with `canvas_menu_tidy` "Tidy wires".
  - **Bit picker:** `PointMenu` labelled `bit_picker_label` "Pick a bit", with entries `d{bit}`.
  - **`WireColorDialog`:** a `SwatchPicker` with a "Default" option plus the 8 keys. Swatch `color` is the computed value of `--color-wire-<key>`, read once per open. The labels reuse `color_*` and add `color_yellow` and `color_default`. Save sends `recolorSelection`.
  - **Toolbar:**
    - a "Wire colour" control that sets `setWireColor` and shows the current swatch; it uses the same dialog in "next colour" mode;
    - a "Tidy wires" button (`tidy_wires`).
  - **Help:** lists `w` (Arm pin for wiring), `Enter` (Connect / open menu), and `Escape` (Cancel wiring).
- [ ] **Step 1:** Implement. `ui/` is coverage-exempt, so its behaviour is pinned in Task 10's E2E.
- [ ] **Step 2:** Run `pnpm check`. Expected: PASS (knip, jsx-no-literals, i18n keys in both languages).
- [ ] **Step 3: Commit.** `feat(circuit-editor): wire menu, canvas menu, bit picker and wire colour controls`

---

### Task 10: E2E, axe and perf

**Files:**
- Create: `e2e/canvas-wiring.spec.ts`, `e2e/fixtures/bus.json`
  - `bus.json` holds a 4-bit input pin piece, a NAND, and an output, with no wires.
- Modify:
  - `e2e/support.ts`: add `pinPoint(page, instanceIndex, pinIndex): Promise<Point>`, computed from `DEMO_LAYOUT` anchors and the URL camera, as `chipCenter` is. Extend `exportedProject`'s schema with `draft.wires[]` (`from`, `to`, `color?`, `waypoints`, `manualWaypoints`).
  - `e2e/a11y.spec.ts`

- **Tests** (all projects unless noted):
  - **Tap-tap:**
    1. Delete the demo wire into NAND `b`.
    2. Tap `Input B`'s pin, then NAND `b`.
    3. The export has a wire from input B to the NAND's pin 1, with non-empty or straight waypoints. `Output` updates when the inputs toggle.
    4. Undo removes the wire.
  - **Drag:** the same flow with a drag (mouse on desktop; `touch` helper on the phone and tablet projects).
  - **Feedback loop:** wire NAND `out` → NAND `a`, after deleting the wire into `a`. Every exported segment stays outside the NAND rect inflated by 20.
  - **Bit picker** (`bus.json` import): tap the NAND `a` pin, then the bus pin. The picker shows `d0`–`d3`; choose `d2`. The export has `bit: 2` on the bus end.
  - **Colour:**
    1. Set the next wire colour to Blue and draw a wire: the export has `color: "blue"`.
    2. Shift-click two wires, then open the wire menu and choose Colour… → Orange. Both are orange, and one Undo restores both.
  - **Tidy wires:** after moving chips, Tidy wires leaves manual wires unchanged in the export.
  - **Keyboard:**
    1. Tab to the canvas, then `]` to the input piece, `p` to its pin, and `w`.
    2. `]` to the NAND, `p` to `b`, then `Enter`. The wire exists.
    3. `Escape` while armed announces "Wiring cancelled".
  - **Axe:** run with the wire menu open, the canvas menu open, the bit picker open and the wire colour dialog open, in each theme.
  - **Perf:** `pnpm e2e:perf` is unchanged and must still pass.
- [ ] **Step 1:** Write the specs.
- [ ] **Step 2:**
  - Run `pnpm build`, then `pnpm e2e` (in the Linux Playwright image if Firefox won't launch locally; see the Phase 2 plan) and `pnpm e2e:perf`.
  - Expected: all pass. Record the per-project counts and the p95 in the commit body.
- [ ] **Step 3: Commit.** `test(e2e): wiring by tap, drag, keyboard and bit picker, wire colours, tidy and axe`

---

### Task 11: ADR, glossary and roadmap

**Files:**
- Create: `docs/adr/0044-wiring-routing-and-colours.md`. Use the format of ADR 41 and 43. Record:
  - it amends ADR 37: hand bends are dropped when exactly one end chip moves;
  - the router never moves untouched wires, and Tidy wires is the explicit exception;
  - signal-based spacing and trunks;
  - wire colour mockup B, with glow and the zoom cut-off;
  - why there is no format bump;
  - the measured router numbers from Task 2.
- Modify:
  - `GLOSSARY.md`: add **Armed pin**, **Bit picker**, **Signal** (source pin + bit + colour), **Trunk**, **Junction**, **Tidy wires**, **Wire colour**, **Bend mode**.
  - `docs/superpowers/plans/2026-10-29-circuit-editor-roadmap.md`: set the Phase 3 plan file name.
  - This plan: a "Status" section once done.
- [ ] **Step 1:** Write them.
- [ ] **Step 2:** Run `pnpm check`. Expected: PASS (spell).
- [ ] **Step 3: Commit.** `docs: record wiring, routing and wire colour decisions`

---

## Done when

- [ ] Wires can be drawn by tap-tap, drag and keyboard on every Playwright project. They route around chips, and different signals never overlap.
- [ ] Wire colours, branches with junctions, bend editing, Re-route and Tidy wires work and undo as single steps.
- [ ] Axe passes with every new overlay open in every theme.
- [ ] `pnpm check`, `pnpm e2e` and `pnpm e2e:visual:docker` pass. `pnpm e2e:perf` holds p95 ≤ 20 ms, and the router perf test holds in CI.
