# Editor Phase 5b: Wiring Several Pins at Once Implementation Plan

## Status

Planned, waiting for the owner's approval. Nothing is built yet. Branch `claude/phase-5b-multi-wire`, from `main` at 9ba663f (PR #30, Phase 5a, merged).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Subagents follow the model policy in `CLAUDE.md`: implementers on `sonnet`, one `sonnet` review for the PR.

**Goal:** Select several pins, then tap a source pin: every selected pin is wired to it in one undo step. A 1-bit (or same-width) source fans out. A wider source is wired bit by bit into 1-bit pins, in selection order. With 16 RAM cells selected, "Select this pin on all selected chips" picks all 16 `clk` pins at once, so issue #16's "wired in one step" holds.

**Architecture:**
- **Domain logic:**
  - `Selection` gains an ordered list of pin ends, `pins: readonly PinRef[]`. The list operations (toggle, "the same pin on these chips" in reading order) live in a new `domain/pin-selection.ts`.
  - What a bulk wire would do is a pure function in a new `domain/bulk-wiring.ts`: `planBulkWires` returns either the list of wires or the first refusal, naming the offending pin. It checks each wire with `checkConnection` against the circuit plus the wires planned before it, so it is all or nothing.
  - A new editor action, `connectWires`, adds every wire as one undo step and routes them once.
  - The commands live in a new `domain/interaction-pin-select.ts`, registered with the wiring commands (as 5a registered its commands with the clipboard's), because `interaction-commands.ts` is at its import limit.
- **UI:**
  - The renderer draws a ring and an order number on each selected pin, and a warning ring on a refused pin.
  - The pin card gets an accessible "Select this pin on all selected chips" button beside it.
  - The selection bar gets a **Pick pins** toggle, the touch path for adding pins one by one.

**Tech Stack:** TypeScript 7, React 19 with the React Compiler, React Aria Components behind `src/shared/ui`, Zustand vanilla stores, Paraglide (en, es), Vitest, Playwright with axe.

**Spec:** `docs/superpowers/specs/2026-11-02-editor-phase-5-bulk-editing-design.md`, §1, §3.2, §5, §6 and §9. Builds on ADR 48 (the selection bar) and ADR 39 (wires reference pin IDs).

**Base:** branch `claude/phase-5b-multi-wire`, from `main` at 9ba663f.

## What the code has today (read on 9ba663f)

- `domain/selection.ts` (135 lines): `Selection` is `{ instances, wires }`. `selectInstances`, `selectWire`, `prune`, `withInnerWires` and `EMPTY_SELECTION` build it. `interaction-clipboard.ts`, `interaction-history.ts` and `interaction-duplicate.ts` also build `Selection` literals.
- `domain/interaction-wiring.ts` (215 lines, 8 imports): `onPinTap` arms a pin or completes the armed one with `completionFor`. `connected` dispatches one `connectWire`. `refused` sets `notice` (a `ConnectionError`) and announces it. `cancelWiring` is Escape's wiring step. `WIRING_COMMANDS` spreads `PLACE_COMMANDS`, which spreads `CLIPBOARD_COMMANDS`, which spreads `DUPLICATE_COMMANDS`.
- `domain/wiring-targets.ts`: `completionFor`, `legalTargets`, `usedBits`, and `sideWidth` (a pin's width as a wire sees it, private).
- `features/projects` `checkConnection(project, circuit, a, b)` orients the ends and returns `Result<Connection, ConnectionError>`. `ConnectionError` is `InvalidEndpoint | BitOutOfRange | WidthMismatch | OutputToOutput | InputToInput | InputAlreadyDriven`. Driven checks are per bit.
- `domain/wire-edits.ts` (97 lines): `connectWire` checks the connection, appends the wire, and routes it with `settled`.
- `domain/keymap.ts`: `p`/`P` step the pin card through the target chip's pins (`nextPin` in `interaction-commands.ts`). `Enter` is `connect` when `KeyContext.armed`, else `openMenu`. `a`, `A` and `Space` are unbound. `use-canvas.ts` builds `KeyContext` from the store.
- `domain/interaction-tap.ts` (11 import lines): a tap on a pin always goes to `onPinTap`, whatever the modifiers. A `Shift`+tap on a chip toggles it.
- `domain/interaction-gestures.ts`: a long-press on a pin pins its card open. That is today's touch path to a pin card. A mouse has no long-press (`gestures.ts`), and a right-click on a pin selects only its chip and opens the chip menu (`onContextMenu`).
- `domain/hit-test.ts`: pins reach 12 screen px (`TARGET_PX / 2`) at any zoom; `nearestPin` takes the closest one in reach.
- `ui/PinCard.tsx` is `aria-hidden`, with no controls. Its words reach screen readers through the live region.
- `ui/SelectionBar.tsx` and `domain/selection-bar.ts`: the docked bar shows Duplicate, Array… and Delete while chips are selected and nothing else is going on.
- `ui/ModeOverlays.tsx` shows `notice` with `editorErrorMessage`.
- There is no touch "additive toggle" anywhere yet, and `src/shared/ui` has no `ToggleButton`.
- Line and import budgets: `interaction.ts` is at 299 lines and 10 imported modules. `interaction-commands.ts` is at 293 lines and 10 modules. `announcements.ts` is at 219 lines.

## Decisions made while planning (Claude's calls, open to the owner's veto)

- **D1. Pin selection lives in `Selection`, as `pins: readonly PinRef[]`**, in the order the pins were added, with no repeats and no `bit`. It is not an edit, so it stays out of undo, like the rest of the selection.
  - `selectInstances` and `selectWire` start with no pins, so a plain tap on a chip or a wire clears them. `toggleInstance`, `toggleWire` and `addInstances` keep them.
  - `prune` drops pins whose chip is gone, or whose pin the chip no longer has.
  - `isEmpty` counts pins.
- **D2. Adding pins.**
  - `Shift`+tap (or `Shift`+click) on a pin adds it to the end of the list, or removes it if it is there. It doesn't arm anything. If a pin was armed, it is disarmed first.
  - While **Pick pins** is on, a plain tap on a pin does the same (D9).
  - `Shift`+`Space` adds or removes the pin in the card (the pin `p`/`P` stepped to). With no card open, it does nothing.
- **D3. "Select this pin on all selected chips".**
  - It adds the card's pin (matched by `PinKey`) on every selected chip of the same kind as the card's chip. Chips of other kinds are skipped.
  - The new pins go in **reading order** of their anchors: top to bottom, then left to right, with ties broken by instance order. For an Array this is row by row, which gives the bit order you'd expect. It is called "reading order", not "canvas order", because `]`/`[` already use "canvas order" for instance order.
  - Pins already in the list stay where they are. The new ones are appended.
  - The button shows beside a pinned card when the card's chip is selected along with at least one other chip. The keyboard shortcut is `a` (D10).
- **D4. A source wires the selection.** With pins selected and nothing armed, a plain tap on a pin outside the list, or `Enter` on the pin in the card, plans the bulk wire with that pin as the source. Dragging a wire out of a pin still draws one wire, as today, and leaves the pin list alone. A plain tap on a pin that is in the list is refused with "That pin is one of the selected pins" (`SourceSelected`). Both the tap and Pick pins have a way to remove it.
- **D5. The legal cases** (spec §3.2.2). Widths are as a wire sees them (`sideWidth`). Directions are as `endpointInfo` sees them: an input piece drives, so it counts as an output.
  - **Same width (fan-out):** every selected pin is an input with the source's width, and the source is an output. Each gets its own wire from the source.
  - **Bit by bit:** the source is N bits wide (N > 1) and every selected pin is 1 bit wide. Selected pin k gets bit k. Fewer than N pins wires the low bits only. More than N is refused (`TooManyPins`).
  - **Reverse direction:** the source is an input and the selected pins are outputs. Bit by bit works as above, with each wire running from the selected pin to bit k of the source. Same-width reverse is legal **only for a single selected pin**, which is an ordinary wire. With two or more it is refused (`InputTakesOneWire`), because an input takes one wire. The spec allows only the bit-by-bit case here; allowing a single pin avoids refusing what a plain tap would wire anyway.
  - **Anything else is refused:** mixed widths or directions in the selection (`MixedPins`), or a selection in the source's own direction (`SameDirection`).
- **D6. All or nothing** (spec §3.2.3). `planBulkWires` checks each planned wire with `checkConnection` against the circuit plus every wire planned before it. So "an input already has a wire", and two wires landing on the same bit, both show up before anything changes.
  - A refusal is `{ reason, at }`. `reason` is a `BulkWireError` (D5) or a `ConnectionError`, and `at` is the first offending pin: the selected pin whose wire failed, or the first pin that breaks the case. `TooManyPins` names pin N+1.
  - The refusal is shown as the `notice` over the canvas, and announced. `notice` widens from `ConnectionError` to `Notice = ConnectionError | BulkRefusal`, so ModeOverlays shows "clk on Cell 3: that input already has a wire". The renderer rings `at` in the warning colour until the notice clears.
  - The pin list stays, so the user can fix the offending pin and tap the source again.
- **D7. `connectWires` is one action, and one undo step.** `{ type: "connectWires", chipId, wires: readonly { wireId, from, to }[], color? }`.
  - It checks every wire against the circuit plus the ones before it, the same way `planBulkWires` does, and refuses the whole action on the first failure. It never trusts the plan.
  - It routes all the new wires in one `settled` call.
  - An empty list is an error (`NothingToConnect`), so it never makes an empty history entry.
  - Every wire gets the current wire colour (`state.wireColor`), as one tapped wire would.
- **D8. After a bulk wire:** the pin list clears, Pick pins turns off, the chip selection stays, and the announcement says what happened. A refusal changes nothing but the notice.
- **D9. Pick pins (touch).** The spec's "additive toggle" doesn't exist yet. It becomes a **Pick pins** toggle in the docked selection bar. It lives in interaction state as `pinPick?: true`.
  - The bar now shows when chips **or** pins are selected. Duplicate, Array… and Delete show only when chips are.
  - Pick pins turns off after a bulk wire, on Escape, and when the selection is cleared.
  - `src/shared/ui` gains a `ToggleButton` (a React Aria `ToggleButton` with the `Button` styles), since only `shared/ui` may import React Aria (ADR 26).
- **D10. Keys.** `Shift`+`Space` toggles the card's pin. `a` (or `A`) is "Select this pin on all selected chips". `Enter` with pins selected wires them to the card's pin. `KeyContext.armed` becomes `KeyContext.wiring`: true when a pin is armed or pins are selected. Escape clears, in order: the bit picker, a placement, the armed pin, then **the pin list and Pick pins**, then the card, then the chip selection.
- **D11. Announcements**, in `en` and `es`, using the project's "Label: {count}" form for counts:
  - Pins selected: "Pins selected: {count}" (and "Pin selection cleared").
  - Fan-out: "Wired {count} pins to {pin}" (spec §3.2.5).
  - Bit by bit: "Wired {count} pins to bits {first}–{last} of {pin}".
  - Refusal: "{pin} on {chip}: {reason}", with the reason worded by `editorErrorMessage`.
  - `{pin}` is the pin's name and `{chip}` the chip label the existing announcements use.
- **D12. Drawing.** Each selected pin gets a ring in the selection colour and a small order number (1-based) beside it, drawn on the overlay layer like the armed pin's highlight. A number hides when it would be under 10 px. The offending pin gets a ring in the existing warning token. Both colours must pass the contrast check in every theme.
- **D13. A right-click on a pin pins its card open**, as a long-press does on touch, and keeps the selection. Today it selects only that chip and opens the chip menu. That would throw away the 16 selected chips, and a mouse has no long-press, so mouse users would have no way to reach the card's button. A right-click on a chip body still opens the chip menu as before. This changes existing behaviour, so the owner should confirm it.

## Global Constraints

- Feature folders expose only `index.ts`, and there are no import cycles (ADR 23). `pin-selection.ts` imports neither `selection.ts` nor `interaction.ts`.
- No `throw` in `domain/`; return `Result` (ADR 28). Zod is used only at trust boundaries (ADR 27).
- Only `src/shared/ui` imports `react-aria-components` or `react-aria` (ADR 26).
- Every user-facing string goes through Paraglide in both `messages/en.json` and `messages/es.json` (ADR 17).
- Lint limits: ≤ 300 lines per file, ≤ 50 lines per function, ≤ 3 parameters, complexity ≤ 10, ≤ 10 imported modules per file.
  - `interaction.ts` (299 lines, 10 modules) and `interaction-commands.ts` (293 lines, 10 modules) get **no new imports**. New types reach `interaction.ts` through `selection.ts`, which re-exports them from `pin-selection.ts`, as 5a re-exported `Size` from `geometry.ts`.
  - Task 1 frees room in `interaction.ts` first, by moving the `Drag` union into `gesture-types.ts`.
  - `interaction-tap.ts` is at its import limit. The `Shift`+tap branch goes through `onPinTap` in `interaction-wiring.ts`, which it already imports.
  - New announcement texts go in a new `announcements-pins.ts`, not `announcements.ts` (219 lines).
- Every `domain/**` file needs ≥ 95 % branch coverage.
- Touch targets are ≥ 24 px. Axe passes in every theme with pins selected, the card's button showing, the Pick pins toggle on, and a refusal notice up.
- `pnpm e2e:perf` p95 stays ≤ 20 ms. `connectWires` with 64 wires stays under one 16 ms frame (measured in Task 3).
- Visual baselines are regenerated only with `pnpm e2e:visual:docker --update-snapshots=all`. Never commit macOS baselines.
- Commit messages follow Conventional Commits (commitlint) and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Don't bypass hooks.

## Review Focus

1. **One undo step.** One Undo after wiring 16 `clk` pins removes all 16 wires, and one Redo brings them back. Pinned by Task 3 (store test) and Task 7 (e2e).
2. **All or nothing.** When any one wire is illegal, the circuit is unchanged, the notice names the first offending pin, and that pin is ringed. Pinned by Task 2 (plan), Task 3 (action refuses on its own), Task 4 (interaction) and Task 7 (e2e).
3. **Bit order follows selection order.** The first selected pin gets bit 0. For "on all selected chips", reading order decides. Pinned by Tasks 1 and 2.
4. **Nothing else changes behaviour**, except a right-click on a pin (D13). A plain tap on a pin with no pins selected still arms it. A `Shift`+tap on a chip still toggles the chip. Wire drags still draw one wire. `Enter` with nothing selected or armed still opens the menu. Pinned by the existing wiring and keymap tests, which must pass unchanged, plus Task 4.
5. **Every path has tap and keyboard equivalents** (spec §5). Pinned by Task 7: mouse, keyboard only, and touch only.

---

## File Structure

```text
src/features/circuit-editor/
  domain/gesture-types.ts             # + Drag (moved from interaction.ts, to free lines)
  domain/pin-selection.ts             # NEW togglePinIn, samePinOn (reading order), types (D1–D3, D6)
  domain/selection.ts                 # Selection.pins; constructors, prune, isEmpty; re-exports
  domain/bulk-wiring.ts               # NEW planBulkWires (D5, D6)
  domain/actions.ts                   # + connectWires, + NothingToConnect
  domain/wire-edits.ts                # + connectWires (D7)
  domain/reducer.ts                   # + connectWires in the table
  domain/editor-error-messages.ts     # + BulkWireError and NothingToConnect texts
  domain/interaction.ts               # + pinPick, PinCommand, PinAnnouncement, Notice
  domain/interaction-pin-select.ts    # NEW togglePin, selectPinOnAll, togglePinPick, bulk wire
  domain/interaction-wiring.ts        # onPinTap reads Shift / Pick pins; Enter; Escape step
  domain/interaction-tap.ts           # passes Shift through to onPinTap
  domain/keymap.ts                    # Shift+Space, a/A, KeyContext.wiring (D10)
  domain/announcements-pins.ts        # NEW pin-selection and bulk-wire texts (D11)
  domain/announcements.ts             # dispatches to announcements-pins
  domain/selection-bar.ts             # shows for pins too; which buttons (D9)
  ui/use-canvas.ts                    # KeyContext.wiring
  ui/render-state-of.ts               # picked pins, refused pin
  adapters/draw-overlays.ts           # rings and order numbers (D12)
  ui/PinCardActions.tsx               # NEW "Select this pin on all selected chips"
  ui/SelectionBar.tsx                 # + Pick pins toggle
  ui/ModeOverlays.tsx                 # Notice text for a bulk refusal
  ui/KeyboardHelp.tsx                 # + Shift+Space, a, Enter rows
src/shared/ui/ToggleButton.tsx        # NEW (+ index.ts export)
messages/en.json, messages/es.json
e2e/fixtures/ram-cell.json            # NEW one "Cell" chip (d, clk → q) and a clk input
e2e/multi-wire.spec.ts                # NEW
e2e/a11y-multi-wire.spec.ts           # NEW
```

---

### Task 0: Spike: pin hit targets in a dense Array (judgement)

Spec §9. It runs first, so a miss changes the plan before any UI exists.

- [ ] **Step 1:** In a throwaway Vitest file (not committed), build a chip holding a 4 × 4 Array of a 2-input part with **spacing 0**, using `copiesOf` and `arrayDeltas`. Build its `SpatialIndex`. For every pin anchor, run `hitTest` at the anchor, and at 6 px and 11 px off it toward each neighbour, at zoom 1, at the default zoom, and at the smallest zoom the camera allows.
- [ ] **Step 2:** Record in this plan's Status, for each zoom: whether every tap at an anchor gets its own pin, the closest gap between two pins of neighbouring chips in screen px, and the zoom below which a tap 6 px off can land on the wrong pin.
- [ ] **Step 3:** Decide:
  - If anchors always hit their own pin at the default zoom, go on. "On all selected chips" is the fallback for the zooms that miss.
  - If they don't, stop and report to the owner. The likely fix is that, with pins selected, `Shift`+tap prefers pins on selected chips (the `accept` option of `nearestPin`). That changes D2.

### Task 1: Pin selection in `Selection` (mechanical)

**Files:**
- Modify: `domain/interaction.ts`, `domain/gesture-types.ts`, and the three files that import `Drag` (`interaction-drag.ts`, `interaction-marquee.ts`, `interaction-wire-drag.ts`)
- Create: `domain/pin-selection.ts` and `pin-selection.test.ts`
- Modify: `domain/selection.ts` and `selection.test.ts`, plus every `Selection` literal the typechecker lists (`interaction-clipboard.ts`, `interaction-history.ts`, `interaction-duplicate.ts`)

**Interfaces:**
- Produces:
  ```ts
  // pin-selection.ts: no import of selection.ts or interaction.ts
  /** `pins` with `pin` appended, or without it if it was there (D2). */
  export const togglePinIn: (pins: readonly PinRef[], pin: PinRef) => readonly PinRef[];
  export const hasPin: (pins: readonly PinRef[], pin: PinRef) => boolean;
  /** `pin` (by key) on every chip of `like`'s kind among `instanceIds`, in reading order (D3). */
  export const samePinOn: (
    scene: Scene,
    { like, instanceIds }: { readonly like: PinRef; readonly instanceIds: ReadonlySet<InstanceId> },
  ) => readonly PinRef[];
  /** `pins` followed by those of `more` not already in it. */
  export const appendPins: (pins: readonly PinRef[], more: readonly PinRef[]) => readonly PinRef[];
  // selection.ts
  export interface Selection { readonly instances; readonly wires; readonly pins: readonly PinRef[] }
  export const withPins: (selection: Selection, pins: readonly PinRef[]) => Selection;
  ```

- [ ] **Step 1: Make room.** Move the `Drag` union from `interaction.ts` into `gesture-types.ts`. Point its three importers at `gesture-types.ts`. If any of them would pass 10 modules, re-export `Drag` from `interaction.ts` instead. Run `pnpm typecheck` and `pnpm lint`. `interaction.ts` should drop to about 272 lines. Commit: `refactor(circuit-editor): move the drag type next to the gestures`.
- [ ] **Step 2: Write the failing tests:**
  - `togglePinIn` appends, removes, and keeps the order of the others. A `bit` on the input is dropped.
  - `samePinOn` on a 4 × 4 Array (built with `copiesOf`) returns 16 refs in row-by-row order. With the chips moved so that row 2 sits above row 1, the order follows the new positions. Chips of another kind are skipped. A key the kind doesn't have gives none.
  - `appendPins` skips duplicates and keeps the existing order.
  - `selection.test.ts`: `selectInstances` and `selectWire` have no pins. `toggleInstance` keeps them. `prune` drops a pin whose chip was deleted, and one whose pin no longer exists, and returns the same object when nothing changed. `isEmpty` is false with only pins.
- [ ] **Step 3:** Run `pnpm vitest run src/features/circuit-editor/domain/pin-selection.test.ts src/features/circuit-editor/domain/selection.test.ts`. Expect FAIL.
- [ ] **Step 4:** Implement. Add `pins: []` to every literal the typechecker flags. Reading order sorts by the pin's anchor (`pinPosition`), comparing y, then x, then instance order.
- [ ] **Step 5:** Run `pnpm vitest run src/features/circuit-editor` and `pnpm typecheck`. Expect PASS.
- [ ] **Step 6: Commit:** `feat(circuit-editor): keep an ordered list of selected pins`.

### Task 2: Plan a bulk wire (judgement)

**Files:**
- Create: `domain/bulk-wiring.ts` and `bulk-wiring.test.ts` (fixtures from `interaction-wiring.fixtures.ts` and the bus chip `wiring-targets.test.ts` uses)
- Modify: `domain/wiring-targets.ts` (export `sideWidth`), `domain/pin-selection.ts` (the error types)

**Interfaces:**
- Produces:
  ```ts
  // pin-selection.ts (types only, re-exported by selection.ts)
  export type BulkWireError =
    | { readonly type: "SourceSelected" }
    | { readonly type: "MixedPins" }
    | { readonly type: "SameDirection" }
    | { readonly type: "TooManyPins"; readonly pins: number; readonly bits: number }
    | { readonly type: "InputTakesOneWire" };
  export interface BulkRefusal { readonly reason: BulkWireError | ConnectionError; readonly at: PinRef }
  export type Notice = ConnectionError | BulkRefusal;
  // bulk-wiring.ts
  export interface PlannedWire { readonly from: PinRef; readonly to: PinRef }
  export interface BulkPlan {
    readonly wires: readonly PlannedWire[];
    /** For the announcement: fan-out, or the bits used. */
    readonly shape: { readonly type: "fanOut" } | { readonly type: "bits"; readonly first: number; readonly last: number };
  }
  export const planBulkWires: (
    scene: Scene,
    { source, pins }: { readonly source: PinRef; readonly pins: readonly PinRef[] },
  ) => Result<BulkPlan, BulkRefusal>;
  ```

- [ ] **Step 1: Write the failing tests**, one per case in D5 and D6:
  - **Fan-out:** a 1-bit output to 16 unconnected 1-bit inputs gives 16 wires, all from the source. A 4-bit output to three 4-bit inputs gives 3 whole-bus wires.
  - **Bit by bit:** a 4-bit output and four 1-bit inputs give `from` bits 0, 1, 2, 3 in selection order. Reversing the selection reverses the bits (Review Focus 3). Two pins give bits 0–1 only. Five pins are refused with `TooManyPins`, `at` the fifth pin.
  - **Reverse:** a 4-bit **input** (an output piece, or a part's bus input) with four 1-bit outputs selected gives wires from each selected pin to bits 0–3 of the source. One same-width output selected with an input source gives one wire. Two are refused with `InputTakesOneWire`, `at` the second.
  - **Refused:** mixed widths (`MixedPins`, at the first pin that differs), mixed directions (`MixedPins`), inputs selected with an input source (`SameDirection`, at the first), the source in the list (`SourceSelected`, at the source).
  - **All or nothing:** with the 7th of 16 `clk` inputs already wired, the result is `InputAlreadyDriven` at the 7th, and no partial list. In the reverse bit-by-bit case, with bit 2 of the source already driven, it is refused at the third pin.
  - The scene is never changed (the test compares it before and after).
- [ ] **Step 2:** Run `pnpm vitest run src/features/circuit-editor/domain/bulk-wiring.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement in three small steps, each under 50 lines and complexity 10:
  - `classify`: the case, or the first refusal, from widths and directions;
  - `pairs`: the planned ends for that case;
  - `checkAll`: run `checkConnection` on each pair against the circuit plus the wires before it, stopping at the first error, and use the oriented ends it returns.
- [ ] **Step 4:** Run the test again, `pnpm typecheck`, and check coverage of `bulk-wiring.ts` is ≥ 95 % branches (`pnpm vitest run --coverage src/features/circuit-editor/domain/bulk-wiring.test.ts`).
- [ ] **Step 5: Commit:** `feat(circuit-editor): plan wiring several pins to one source`.

### Task 3: The `connectWires` action (judgement)

**Files:**
- Modify: `domain/actions.ts`, `domain/wire-edits.ts`, `domain/reducer.ts`, `domain/editor-error-messages.ts`
- Create or modify: `domain/wire-edits-bulk.test.ts` (or `wire-edits.test.ts` if it has room), and the nearest store test with room, for example `application/editor-store-copies.test.ts`
- Modify: `messages/en.json`, `messages/es.json`

**Interfaces:**
- Produces:
  ```ts
  // EditorAction
  | {
      readonly type: "connectWires";
      readonly chipId: ChipId;
      readonly wires: readonly { readonly wireId: WireId; readonly from: PinRef; readonly to: PinRef }[];
      readonly color?: WireColor;
    }
  // EditorError
  | { readonly type: "NothingToConnect" }
  export const connectWires: Edit<"connectWires">;
  ```

- [ ] **Step 1: Write the failing tests:**
  - 16 wires are added in order, each with its own id, the colour, `manualWaypoints: false`, and a route.
  - If the 7th would be illegal, the result is that `ConnectionError` and the project is unchanged (Review Focus 2).
  - A duplicate wire id is `DuplicateWire`. An empty list is `NothingToConnect`.
  - **Store test:** one `connectWires` of 16 wires is one history entry. One `undo` removes all 16, and one `redo` restores them (Review Focus 1).
  - **Timing:** 64 wires from one source to the `clk` pins of a 64-copy Array (built with `copiesOf`) apply in under 16 ms (median of 7). Record the number in Status. If it is over, stop and report.
- [ ] **Step 2:** Run `pnpm vitest run src/features/circuit-editor/domain/wire-edits src/features/circuit-editor/application`. Expect FAIL.
- [ ] **Step 3:** Implement with a loop over the wires that grows a draft circuit with each checked wire. Then call `settled` once with every new id. Add the reducer row. Add `NothingToConnect` and the five `BulkWireError` texts to `editor-error-messages.ts` and to both message files.
- [ ] **Step 4:** Run `pnpm vitest run src/features/circuit-editor` and `pnpm typecheck`. Expect PASS.
- [ ] **Step 5: Commit:** `feat(circuit-editor): add several wires as one undo step`.

### Task 4: Pin selection and bulk wire commands (judgement)

**Files:**
- Create: `domain/interaction-pin-select.ts` and `interaction-pin-select.test.ts`
- Modify: `domain/interaction.ts` (≤ 8 new lines), `domain/interaction-wiring.ts`, `domain/interaction-tap.ts` (no new imports), `domain/interaction-gestures.ts` (D13, no new imports: `withCard` is already there), `domain/keymap.ts` and `keymap.test.ts`, `ui/use-canvas.ts`
- Create: `domain/announcements-pins.ts` and its test. Modify `domain/announcements.ts` (dispatch only)
- Modify: `messages/en.json`, `messages/es.json`

**Interfaces:**
- Produces:
  ```ts
  // pin-selection.ts, re-exported by selection.ts
  export type PinCommand = { readonly type: "togglePin" | "selectPinOnAll" | "togglePinPick" };
  export type PinAnnouncement =
    | { readonly type: "pinsSelected"; readonly count: number }
    | { readonly type: "bulkWired"; readonly count: number; readonly source: PinRef; readonly bits?: { readonly first: number; readonly last: number } }
    | { readonly type: "bulkRefused"; readonly refusal: BulkRefusal };
  // interaction.ts
  // InteractionCommand gains `| PinCommand`; Announcement gains `| PinAnnouncement`;
  // InteractionState gains `readonly pinPick?: true` and `notice?: Notice`.
  // interaction-pin-select.ts
  /** A plain tap or Enter on `source` with pins selected: wire them all, or refuse (D4–D8). */
  export const wireSelectedPins: (state: InteractionState, source: PinRef, context: InteractionContext) => Interpreted;
  /** Shift+tap, or a tap while picking: add or remove the pin (D2). */
  export const togglePickedPin: (state: InteractionState, pin: PinRef) => Interpreted;
  export const PIN_SELECT_COMMANDS: PinSelectHandlers;  // spread into WIRING_COMMANDS
  // keymap.ts
  interface KeyContext { readonly wiring: boolean; readonly focus?: InstanceId | undefined }
  ```

- [ ] **Step 1: Write the failing tests** in `interaction-pin-select.test.ts`, using `interaction.fixtures.ts` and `interaction-wiring.fixtures.ts`:
  - A `Shift`+tap on a pin adds it and announces `pinsSelected` with count 1. A second one on the same pin removes it. A `Shift`+tap while a pin is armed disarms it and adds the tapped pin.
  - With `pinPick` on, a plain tap adds the pin, and doesn't arm.
  - `togglePin` with the card on a pin toggles that pin. With no card it does nothing.
  - `selectPinOnAll` with 16 Array copies selected and the card on one `clk` pin gives 16 pins in reading order. With fewer than 2 chips selected, or the card's chip not selected, it does nothing.
  - With 16 `clk` pins selected, a plain tap on the clock source dispatches **one** `connectWires` with 16 wires, all in `state.wireColor`. Afterwards the pins are cleared, `pinPick` is off, the chips are still selected, and it announces `bulkWired` with count 16.
  - A refused plan dispatches nothing, sets `notice` to the `BulkRefusal`, announces `bulkRefused`, and keeps the pins (Review Focus 2).
  - `Enter` (the `connect` command) with pins selected and the card on a pin outside them wires them. With nothing armed and no pins, it is unchanged.
  - Escape order (D10): with pins selected and a card open, the first Escape clears the pins and Pick pins, and the second closes the card.
  - **Unchanged (Review Focus 4):** a plain tap on a pin with no pins selected still arms it. A wire drag with pins selected still connects one wire and leaves the pins alone.
  - `historyChanged` prunes pins of deleted chips.
  - `interaction-gestures.test.ts` (D13): a right-click on a pin of one of 16 selected chips pins that pin's card and keeps all 16 selected. A right-click on a chip body still selects it and opens the chip menu.
  - `keymap.test.ts`: `Shift`+`Space` → `togglePin`; plain `Space` → `undefined`; `a` and `A` → `selectPinOnAll`; `Enter` with `wiring: true` → `connect`; `Enter` with `wiring: false` → `openMenu`.
  - `announcements-pins.test.ts`: every text in `en` and `es`, including the refusal for a `ConnectionError` and for each `BulkWireError`, naming pin and chip.
- [ ] **Step 2:** Run `pnpm vitest run src/features/circuit-editor/domain`. Expect FAIL.
- [ ] **Step 3:** Implement.
  - `interaction-tap.ts` passes `{ hit, additive: gesture.modifiers.shift }` to `onPinTap`.
  - `onPinTap` sends `additive || state.pinPick` to `togglePickedPin`. With pins selected and nothing armed, it sends a plain tap to `wireSelectedPins`. Otherwise it behaves as today.
  - `connectByKey` handles the pins case the same way.
  - `cancelWiring` gains the pin-list step.
  - `PIN_SELECT_COMMANDS` is spread into `WIRING_COMMANDS`. `interaction-pin-select.ts` must not import `interaction-wiring.ts`, to avoid a cycle.
  - In `keymap.ts`, `Space` goes through a small `SHIFTED` lookup, so `plainKey` stays under complexity 10.
- [ ] **Step 4:** Run `pnpm vitest run src/features/circuit-editor`, `pnpm typecheck` and `pnpm lint`. Expect PASS, with no file over 300 lines and no file over 10 modules.
- [ ] **Step 5: Commit:** `feat(circuit-editor): select pins and wire them to one source`.

### Task 5: Drawing picked and refused pins (judgement)

**Files:**
- Modify: `ui/render-state-of.ts`, `adapters/render-state.ts`, `adapters/draw-overlays.ts` (or a new `adapters/draw-picked-pins.ts` if it would pass 300 lines), and their tests
- Modify: the theme token data, only if no existing token passes contrast (then `pnpm tokens`)

**Interfaces:**
- Produces:
  ```ts
  // OverlayView
  readonly picked?: readonly { readonly at: Point; readonly order: number }[];
  readonly refusedAt?: Point;
  ```

- [ ] **Step 1: Write the failing tests:**
  - `render-state-of` maps the selection's pins to anchors with 1-based order. A pin whose chip is gone is skipped. A `BulkRefusal` notice gives `refusedAt`, and a plain `ConnectionError` gives none.
  - Draw test, with a recording context like the existing overlay tests: one ring per picked pin, and a number only when it would be at least 10 px.
- [ ] **Step 2:** Run the tests. Expect FAIL. Implement (D12). Expect PASS.
- [ ] **Step 3:** Check by hand in `pnpm dev`, in every theme: pick 3 pins (rings and 1, 2, 3), then make a refusal (warning ring). Check that there are no console errors.
- [ ] **Step 4: Commit:** `feat(circuit-editor): draw selected pins with their order`.

### Task 6: Card button, Pick pins toggle and keyboard help (judgement)

**Files:**
- Create: `src/shared/ui/ToggleButton.tsx` (+ export from `src/shared/ui/index.ts`)
- Create: `ui/PinCardActions.tsx` (+ `.module.css`)
- Modify: `domain/selection-bar.ts` and its test, `ui/SelectionBar.tsx`, `ui/CanvasOverlays.tsx`, `ui/ModeOverlays.tsx`, `ui/KeyboardHelp.tsx`
- Modify: `messages/en.json`, `messages/es.json`

**Interfaces:**
- Produces:
  ```ts
  /** The bar shows for selected chips or pins, while nothing else has the canvas's attention (D9). */
  export const barVisible: (state: InteractionState) => boolean;
  /** Which of the bar's chip actions show: only with chips selected. */
  export const barChipActions: (state: InteractionState) => boolean;
  /** Whether the card offers "on all selected chips" (D3). */
  export const offersSelectOnAll: (state: InteractionState) => boolean;
  ```

- [ ] **Step 1: Write the failing domain tests:**
  - `barVisible` is true with only pins selected, and still false while armed, dragging, placing, renaming, or with a menu, bit picker or Array dialog open.
  - `barChipActions` is false with only pins.
  - `offersSelectOnAll` is true only for a pinned card on a selected chip, with 2 or more chips selected.
- [ ] **Step 2:** Run them. Expect FAIL. Implement. Expect PASS.
- [ ] **Step 3: UI.**
  - `ToggleButton` wraps React Aria's `ToggleButton` with the `Button` styles and `aria-pressed`.
  - `SelectionBar`: a **Pick pins** toggle after Delete. When pressed it sends `togglePinPick`, and it shows pressed while `pinPick` is set. Duplicate, Array… and Delete show only when `barChipActions`.
  - `PinCardActions`: a `Button`, "Select this pin on all selected chips", placed just below the card at `card.screen` (flipped as the card is). It is **not** `aria-hidden`, and it sends `selectPinOnAll`. When it goes away (the press closes the card's offer), focus goes back to the canvas host, as the selection bar does.
  - `ModeOverlays`: a `BulkRefusal` notice reads "{pin} on {chip}: {reason}". Reuse `announcements-pins` wording, so the notice and the announcement match.
  - `KeyboardHelp`: rows for `Shift`+`Space`, `a`, and `Enter` with pins selected.
  - Every string goes into `en` and `es`.
- [ ] **Step 4:** Check by hand in `pnpm dev`, at desktop and phone width:
  - Select 4 NANDs, open a pin card (right-click, long-press or `p`), press the button, and see 4 rings.
  - Tap an input piece's pin, and see 4 wires. Undo once, and see none.
  - Turn Pick pins on, tap 2 pins, turn it off, and tap a source.
  - Check that the button doesn't close the card before its press lands. Check that there are no console errors.
- [ ] **Step 5:** Run `pnpm vitest run src/features/circuit-editor src/shared/ui`, `pnpm typecheck` and `pnpm lint`. Expect PASS.
- [ ] **Step 6: Commit:** `feat(circuit-editor): pick pins from the pin card and the selection bar`.

### Task 7: E2E, axe and perf (mechanical)

**Files:**
- Create: `e2e/fixtures/ram-cell.json`: a project whose "Cell" chip has inputs `d` and `clk` and output `q`. "Main" has one Cell and one 1-bit input piece called `clk`. A 4-bit output and four 1-bit inputs for the bit-by-bit case may live in `bus.json` instead, if it already has them.
- Create: `e2e/multi-wire.spec.ts`, `e2e/a11y-multi-wire.spec.ts`
- Reuse: `e2e/support.ts`, `wiring-support.ts` (`pointerFor`, `usesTouch`, `wiresOf`), and 5a's Array steps from `bulk-editing.spec.ts`

- [ ] **Step 1:** In `multi-wire.spec.ts`:
  - **Done when, second half (issue #16):** import `ram-cell.json`, select the Cell, Array → grid, count 15, 4 columns. Open the card on one `clk` pin (right-click with a mouse, long-press on touch) and press "Select this pin on all selected chips". Tap the `clk` input piece's pin. Expect 16 wires from it, one to each Cell's `clk`, and the announcement "Wired 16 pins to clk". One Undo leaves no wires, and one Redo gives 16 again (Review Focus 1).
  - **Keyboard only:** the same, with `p` to the `clk` pin, `a`, then `]`/`p` to the source and `Enter`.
  - **Shift+click and bit by bit:** `Shift`+click four 1-bit inputs, then click a 4-bit output. Expect bits 0–3 in click order. In the export, `from.bit` is 0, 1, 2, 3 for the pins in order (Review Focus 3).
  - **Refusal:** wire one Cell's `clk` by hand first, then wire all 16. Expect no new wires, a notice naming that pin and Cell, and the same words spoken (Review Focus 2).
  - **Touch only (phone and tablet projects):** Pick pins on, tap two pins, Pick pins off, tap the source. Expect 2 wires.
  - **Unchanged:** a plain click on a pin with nothing selected still arms it (one existing wiring spec already covers this; it must still pass).
- [ ] **Step 2:** In `a11y-multi-wire.spec.ts`, run axe in every theme with: pins selected and the bar showing Pick pins; the card's button showing; and a refusal notice up. Copy the setup from `a11y-bulk.spec.ts`.
- [ ] **Step 3:** Run `pnpm build && pnpm e2e --grep "multi-wire"`, then the existing wiring specs (`pnpm e2e --grep "wiring"`). Expect PASS on every project.
- [ ] **Step 4:** Run `pnpm e2e:visual:docker`. No baseline should change: none shows selected pins. If one does, find out why before updating, and commit only Linux baselines.
- [ ] **Step 5:** Run `pnpm e2e:perf` (p95 ≤ 20 ms), then `pnpm check`. Expect PASS.
- [ ] **Step 6: Commit:** `test(e2e): wire sixteen clock pins in one step, and check pin picking with axe`.

### Task 8: Docs and PR (mechanical)

- [ ] **Step 1:** Rewrite this plan's Status as 5a's: what shipped, the spike and timing numbers, rulings made while building, and known follow-ups.
- [ ] **Step 2:** Record the decisions in `docs/adr/0049-wiring-several-pins.md`. Add **Pin selection**, **Pick pins**, **Reading order** and **Bulk wire** to `GLOSSARY.md`.
- [ ] **Step 3:** Open the PR with the `pr` skill. Then run one `sonnet` review over the whole PR, and fix what it finds in one wave.

## Not in this PR

- Suggest wires and its ghost wires (5c). 5c's Accept all will reuse `connectWires`.
- Bulk wiring by dragging: a wire drag still draws one wire (D4).
- Selecting pins with a box or lasso.
- Chaining Array copies to each other.
