# Editor Phase 5a: Duplicate and Array Implementation Plan

## Status

Task 0 is done; the routing path stays as planned.

- **Spike result.** One `pasteItems` of 64 copies of a 4-NAND cell with 4 automatic wires (256 parts, 256 wires) goes through `applyAction`. The median of 7 runs is about 12 ms, on an empty chip and with 300 NANDs elsewhere on the chip. Both are under the 16 ms frame budget, so the copies are routed as usual.
- **Seen in the spike:** when the copies land **on top of** existing chips, the same paste takes about 70 ms, because every route has to work around the overlapping bodies. Array doesn't check for room (spec §3.1.3), so this can happen. It is a follow-up, not a blocker: a later fix could warn about overlap in the dialog's summary, or route the copies by translating the originals' routes.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Subagents follow the model policy in `CLAUDE.md`: implementers on `sonnet`, one `sonnet` review for the PR.

**Goal:** With chips selected, Duplicate copies them one grid step away, and Array adds a row, column or grid of copies from a dialog. Each is one undo step. Both are reached from a floating selection bar, the chip menu, and the keyboard.

**Architecture:**
- **Domain logic:**
  - Where each Array copy goes is a pure function of the request and the selection's bounding box, in a new `domain/array.ts`.
  - Duplicate and Array both reuse PR #28's `copyOf` / `pastedFrom` and dispatch one `pasteItems`. A new `copiesOf` builds several copies at once, so pin names stay unique across them.
  - The commands live in a new `domain/interaction-duplicate.ts`, in the same style as `interaction-clipboard.ts`.
- **UI:**
  - The `SelectionBar` is a new overlay in `CanvasOverlays`, placed from the selection's screen bounds.
  - The `ArrayDialog` opens from interaction state (`arraying`), the same way the keyboard help opens from `help`, so the keyboard shortcut, the bar and the chip menu all open it the same way.

**Tech Stack:** TypeScript 7, React 19 with the React Compiler, React Aria Components behind `src/shared/ui`, Zustand vanilla stores, Paraglide (en, es), Vitest, Playwright with axe.

**Spec:** `docs/superpowers/specs/2026-11-02-editor-phase-5-bulk-editing-design.md`, §1, §3.1, §5, §6, §7 and §9.

**Base:** branch `claude/phase-5a-duplicate-array`, from `main` at 2f938ae.

## Decisions made while planning (Claude's calls, open to the owner's veto)

- **D1. Array copy positions.** The step between copies is the selection's bounding box, rounded **up** to whole grid steps, plus `spacing` grid steps.
  - Row: copy `k` (1…count) sits `k` steps right. Column: `k` steps down.
  - Grid with `columns` columns: the originals are cell 0, and copy `k` is cell `k`, so it sits at column `k mod columns` and row `⌊k / columns⌋`. So 1 RAM cell, count 15, 4 columns gives a 4 × 4 block of 16.
  - The dialog's summary counts the originals too: "4 × 4, 16 chips" (spec §3.1.3).
- **D2. Grid columns default to `⌈√(count + 1)⌉`**, between 1 and 16. Count is 1–64 (spec), so at most 65 chips in a block.
- **D3. Duplicate is a fixed step.** It always lands one grid step down and to the right, and doesn't use paste's "lands in the middle of the view" rule. The copies become the selection, so pressing Duplicate again makes a staircase, which is easy to follow.
- **D4. Unique pin names across copies.** `copiesOf` passes each copy a `target` that already holds the pins of the copies before it, so that `freshPins` never gives two copies the same name.
- **D5. `arraying` lives in interaction state**, as `help` does. `showArray` opens the dialog only when the selection has at least one chip. `hideArray` closes it. Submitting sends `{ type: "array", request }`, which closes it too.
- **D6. Shortcuts.** `Ctrl`/`⌘`+`D` is Duplicate and `Ctrl`/`⌘`+`Shift`+`D` opens Array. The canvas calls `preventDefault` for every key the keymap handles (`use-canvas.ts`), so the browser's bookmark shortcut doesn't fire. `withCtrl` becomes a lookup table, like `PLAIN`, so it stays under the complexity limit.
- **D7. Selection bar placement (changed by the owner during Task 5).** It is docked at the top centre of the canvas. Phones (`max-width: 600px`) pin it to the bottom of the canvas, above the safe area. It is a React Aria `Toolbar`, so arrow keys move between its buttons.
  - First built floating 8 px above the selection (`barPlacement`), the bar covered neighbouring chips. In e2e, a click meant for the NAND beside a selected input landed on Delete. The owner chose the docked bar, and `barPlacement` was removed.
  - It shows only when the selection has at least one chip, and no `drag`, `armed`, `placing`, `menu` or `renaming` is active.
- **D8. Announcements reuse `clipboard`.** Its `did` gains `"duplicate"` and `"array"`, which keeps `interaction.ts` (297 lines) under the cap. Messages use the project's "Label: {count}" form: "Duplicated: 3", "Added in an array: 15".

## Global Constraints

- Feature folders expose only `index.ts`, and there are no import cycles (ADR 23).
- No `throw` in `domain/`; return `Result` (ADR 28). Zod is used only at trust boundaries (ADR 27).
- Only `src/shared/ui` imports `react-aria-components` or `react-aria` (ADR 26).
- Every user-facing string goes through Paraglide in both `messages/en.json` and `messages/es.json` (ADR 17).
- Lint limits: ≤ 300 lines per file, ≤ 50 lines per function, ≤ 3 parameters, complexity ≤ 10, ≤ 10 imports per file.
  - `interaction.ts` is at 297 lines and `interaction-commands.ts` at 293. Each may gain at most the lines named in the tasks. If either would pass 300, move the `Announcement` type into `domain/announcement-types.ts` first, and re-export it.
- Every `domain/**` file needs ≥ 95 % branch coverage.
- Touch targets are ≥ 24 px. Axe passes in every theme with the selection bar and the Array dialog open.
- `pnpm e2e:perf` p95 stays ≤ 20 ms.
- Visual baselines are regenerated only with `pnpm e2e:visual:docker --update-snapshots=all`. Never commit macOS baselines.
- Commit messages follow Conventional Commits (commitlint) and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Don't bypass hooks.

## Review Focus

1. **One undo step per action.** One Undo after an Array of 15 removes all 15 copies and their wires, and one Redo brings them back. Pinned by Task 2 (store test) and Task 5 (e2e).
2. **No duplicate pin names.** An Array of a selection holding an input pin `A` gives pins `A`, `B`, `C`, … with no repeats. Pinned by Task 2.
3. **Wires to chips outside the selection are dropped.** Pinned by Task 2, and already by `clipboard.test.ts`.
4. **The clipboard is untouched.** Copy X, Duplicate Y, Paste: X is pasted. Pinned by Task 3.
5. **The bar never covers an action in progress.** It hides while dragging, wiring or placing. Pinned by Task 4 (unit) and Task 5 (e2e).

---

## File Structure

```text
src/features/circuit-editor/
  domain/array.ts                    # NEW ArrayRequest, arrayDeltas, arraySummary (D1, D2)
  domain/clipboard.ts                # + copiesOf (D4)
  domain/interaction-duplicate.ts    # NEW duplicate, showArray, hideArray, array commands
  domain/interaction.ts              # + commands, + arraying, did: "duplicate" | "array"
  domain/interaction-commands.ts     # + DUPLICATE_COMMANDS in the table
  domain/keymap.ts                   # withCtrl as a table; Ctrl+D, Ctrl+Shift+D (D6)
  domain/announcements.ts            # duplicate and array texts
  domain/selection-bar.ts            # NEW barVisible, barPlacement (D7)
  ui/SelectionBar.tsx                # NEW Duplicate, Array…, Delete
  ui/ArrayDialog.tsx                 # NEW count, direction, columns, spacing, summary
  ui/CanvasOverlays.tsx              # + SelectionBar, ArrayDialog
  ui/CanvasMenus.tsx                 # chip menu + Duplicate, Array…
  ui/KeyboardHelp.tsx                # + two rows
messages/en.json, messages/es.json
e2e/bulk-editing.spec.ts             # NEW
e2e/a11y-bulk.spec.ts                # NEW
```

---

### Task 0: Spike: routing cost of a big Array (judgement)

Spec §9. This runs before any UI, so a slow path changes the plan early, not late.

- [ ] **Step 1:** In a throwaway Vitest bench (not committed), build a chip with one custom part that has 4 inner wires. Then dispatch one `pasteItems` with 64 copies (256 wires) through the editor store, and time it. Also time it on the large circuit that `e2e/canvas-perf.spec.ts` builds.
- [ ] **Step 2:** If one dispatch stays under 16 ms, record the number in this plan's Status and go on. If not, stop and report: the likely fix is to route the copies' wires by translating the originals' routes (copies are exact translations) instead of routing each one. That needs the owner's OK.

### Task 1: Array geometry (mechanical)

**Files:**
- Create: `src/features/circuit-editor/domain/array.ts` and `array.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type ArrayDirection = "row" | "column" | "grid";
  export interface ArrayRequest {
    readonly count: number;      // copies to add, 1–64
    readonly direction: ArrayDirection;
    readonly columns: number;    // used only by "grid", 1–16
    readonly spacing: number;    // gap in grid steps, 0–8
  }
  export const ARRAY_LIMITS: { count: {min: 1, max: 64}, columns: {min: 1, max: 16}, spacing: {min: 0, max: 8} };
  /** World offsets of copies 1…count from the originals, snapped to GRID (D1). */
  export const arrayDeltas: (request: ArrayRequest, bounds: Size) => readonly Point[];
  /** Columns and rows of the whole block, originals included: the dialog's "4 × 4, 16 chips". */
  export const arraySummary: (request: ArrayRequest) => { readonly columns: number; readonly rows: number; readonly chips: number };
  /** ⌈√(count + 1)⌉, clamped to 1–16 (D2). */
  export const defaultColumns: (count: number) => number;
  ```

- [ ] **Step 1: Write the failing tests:**
  - Row, count 3, bounds 80 × 80, spacing 1: `[{x:120,y:0},{x:240,y:0},{x:360,y:0}]`.
  - Column: the same along y.
  - Bounds 90 × 50 round up to 120 × 80 before the gap.
  - Spacing 0: copies touch, with no overlap.
  - Grid, count 15, 4 columns: 15 offsets. The first is `{x:step,y:0}`, the fourth is `{x:0,y:step}`, and all are distinct.
  - Grid with 1 column behaves like a column.
  - `arraySummary` for row 3 is 4 × 1, 4 chips. For grid 15 with 4 columns it is 4 × 4, 16 chips. For grid 4 with 4 columns it is 4 × 2, 5 chips (the last row is partial; `rows` is rounded up).
  - `defaultColumns(15)` is 4, `defaultColumns(1)` is 2, and `defaultColumns(64)` is 9.
  - Values outside `ARRAY_LIMITS` are clamped, not refused (the dialog's fields enforce the range anyway).
- [ ] **Step 2:** Run `pnpm vitest run src/features/circuit-editor/domain/array.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement. Use `GRID` from `geometry.ts`, and no DOM.
- [ ] **Step 4:** Run the test again and `pnpm typecheck`. Expect PASS.
- [ ] **Step 5: Commit:** `feat(circuit-editor): work out where array copies go`.

### Task 2: Several copies in one edit (judgement)

**Files:**
- Modify: `src/features/circuit-editor/domain/clipboard.ts` and `clipboard.test.ts` (or a new `copies.test.ts` if the test file would pass 300 lines)
- Modify: `src/features/circuit-editor/application/editor-store.test.ts`, or the nearest store test with room (Review Focus 1)

**Interfaces:**
- Consumes: `pastedFrom`, `PasteTarget`.
- Produces:
  ```ts
  /** One copy of the clipboard per delta, as one batch for `pasteItems`; pin names unique across all (D4). */
  export const copiesOf: (
    clipboard: Clipboard,
    deltas: readonly Point[],
    { target, newWireId }: Omit<PasteTarget, "delta">,
  ) => Omit<Clipboard, "offset">;
  ```

- [ ] **Step 1: Write the failing tests:**
  - Three deltas of a selection with 2 parts and 1 inner wire give 6 instances and 3 wires, all with fresh, distinct ids. Each wire's ends point at instances of its own copy.
  - A selection with input pin `A` and three deltas gives pins `B`, `C`, `D`, all distinct, with none equal to an existing name in `target` (Review Focus 2).
  - Waypoints of hand-bent wires move with their copy.
  - No deltas gives empty lists.
  - **Store test:** dispatching the result as one `pasteItems` adds everything, one `undo` removes all of it, and one `redo` restores it (Review Focus 1).
- [ ] **Step 2:** Run `pnpm vitest run src/features/circuit-editor/domain/clipboard`. Expect FAIL.
- [ ] **Step 3:** Implement `copiesOf` with a loop that grows the `target` circuit by each copy's pins and instances before making the next one.
- [ ] **Step 4:** Run `pnpm vitest run src/features/circuit-editor` and `pnpm typecheck`. Expect PASS.
- [ ] **Step 5: Commit:** `feat(circuit-editor): build several copies of a selection in one edit`.

### Task 3: Duplicate and Array commands (judgement)

**Files:**
- Create: `src/features/circuit-editor/domain/interaction-duplicate.ts` and `interaction-duplicate.test.ts`
- Modify: `domain/interaction.ts` (≤ 4 new lines), `domain/interaction-commands.ts` (≤ 2 new lines), `domain/keymap.ts` and `keymap.test.ts`, `domain/announcements.ts` and `announcements.test.ts`
- Modify: `messages/en.json`, `messages/es.json`

**Interfaces:**
- Produces:
  ```ts
  // In InteractionCommand:
  | { readonly type: "duplicate" | "showArray" | "hideArray" }
  | { readonly type: "array"; readonly request: ArrayRequest }
  // In InteractionState:
  readonly arraying?: true;
  // In Announcement: did: "copy" | "cut" | "paste" | "duplicate" | "array"
  export const DUPLICATE_COMMANDS: DuplicateHandlers;
  ```

- [ ] **Step 1: Write the failing tests** in `interaction-duplicate.test.ts`, using `interaction.fixtures.ts`:
  - `duplicate` with two selected parts dispatches one `pasteItems` with copies one `GRID` down and right. The new pieces are the selection, and it announces `{ type: "clipboard", did: "duplicate", count: 2 }`.
  - `duplicate` with only wires selected, or nothing selected, does nothing and dispatches nothing.
  - `duplicate` leaves `state.clipboard` exactly as it was (Review Focus 4).
  - `showArray` with no chips selected does nothing. With chips selected it sets `arraying` and closes menus (`withoutOverlays`).
  - `hideArray` clears `arraying`.
  - `array` with a row request of 3 dispatches one `pasteItems` holding 3 copies, at the offsets `arrayDeltas` gives for the selection's bounds. It clears `arraying`. The selection becomes originals plus copies, and it announces `did: "array", count: <copied pieces>`.
  - `keymap.test.ts`: `Ctrl+D` → `duplicate`, `Ctrl+Shift+D` → `showArray`, `⌘+D` the same, and the existing Ctrl shortcuts are unchanged.
  - `announcements.test.ts`: the two new texts in `en` and `es`.
- [ ] **Step 2:** Run `pnpm vitest run src/features/circuit-editor/domain`. Expect FAIL.
- [ ] **Step 3:** Implement.
  - Get the selection's bounds the same way `interaction-clipboard.ts` does (`layoutIn` + `boundsOf`). Move `boundsAt`, or a shared `selectionBounds`, into a small helper that both files import, rather than copying it.
  - Turn `withCtrl` into a `ReadonlyMap<string, (shift: boolean) => InteractionCommand>` (D6).
  - Add `duplicate` / `showArray` / `hideArray` / `array` to the command table.
  - New messages: `canvas_duplicated`, `canvas_arrayed`, in both languages.
- [ ] **Step 4:** Run `pnpm vitest run src/features/circuit-editor`, `pnpm typecheck` and `pnpm lint`. Expect PASS, with no file over 300 lines.
- [ ] **Step 5: Commit:** `feat(circuit-editor): duplicate a selection and lay it out in an array`.

### Task 4: Selection bar, Array dialog and chip menu (judgement)

**Files:**
- Create: `src/features/circuit-editor/domain/selection-bar.ts` and its test
- Create: `src/features/circuit-editor/ui/SelectionBar.tsx` (+ `.module.css`), `ui/ArrayDialog.tsx`
- Modify: `ui/CanvasOverlays.tsx`, `ui/CanvasMenus.tsx`, `ui/KeyboardHelp.tsx`
- Reuse: `Toolbar`, `NumberField` and `Select` from `src/shared/ui` (all exist; ADR 26)
- Modify: `messages/en.json`, `messages/es.json`

**Interfaces:**
- Produces:
  ```ts
  /** The bar shows only for a selection with chips and no gesture, wiring, placing, menu or rename in progress (D7). */
  export const barVisible: (state: InteractionState) => boolean;
  /** Centre-top of the selection in screen px, or below it when that is off the top (D7). */
  export const barPlacement: (bounds: Rect, camera: Camera) => { readonly point: Point; readonly side: "above" | "below" };
  ```

- [ ] **Step 1: Write the failing domain tests** for `barVisible` (each blocking state on its own; wires-only selection hidden) and `barPlacement` (above; flipped below near the top; follows zoom and pan) (Review Focus 5).
- [ ] **Step 2:** Run them. Expect FAIL. Implement. Expect PASS.
- [ ] **Step 3: UI.**
  - `SelectionBar`: a `Toolbar` labelled "Selection" with Duplicate, Array… and Delete. Each sends its command (`duplicate`, `showArray`, `deleteSelection`). On phones it is pinned to the bottom (D7, CSS only). Use the theme tokens of `EditorToolbar.module.css`.
  - `ArrayDialog`: a `ModalDialog` with `DialogForm`, like `AddPinsDialog`.
    - Fields: count (`NumberField`, 1–64, default 3), direction (`Select`: row / column / grid), columns (`NumberField`, shown only for grid, default `defaultColumns(count)` until the user edits it), and spacing (`NumberField`, 0–8, default 1).
    - A live summary line from `arraySummary`: "4 × 4, 16 chips".
    - Submit sends `{ type: "array", request }`. Cancel and Escape send `hideArray`.
  - `CanvasOverlays` renders both. The dialog shows while `arraying` is set.
  - The chip menu gets Duplicate and Array… after Delete, for every part.
  - `KeyboardHelp` gets rows for `Ctrl`/`⌘`+`D` and `Ctrl`/`⌘`+`Shift`+`D`.
  - Every string goes into `en` and `es`.
- [ ] **Step 4:** Check it by hand in the dev server (`pnpm dev`): select, Duplicate, Array a 4 × 4 grid, Undo, Redo, phone width. Check that there are no console errors.
- [ ] **Step 5:** Run `pnpm vitest run src/features/circuit-editor`, `pnpm typecheck` and `pnpm lint`. Expect PASS.
- [ ] **Step 6: Commit:** `feat(circuit-editor): add a selection bar with duplicate and array`.

### Task 5: E2E, axe and visual baselines (mechanical)

**Files:**
- Create: `e2e/bulk-editing.spec.ts`, `e2e/a11y-bulk.spec.ts`
- Modify: visual baselines that show a selection (the bar now appears in them)

- [ ] **Step 1:** In `bulk-editing.spec.ts`:
  - **Done when, first half:** place one NAND, select it, Array → grid, count 15, 4 columns. Expect 16 NANDs in a 4 × 4 block and the summary "4 × 4, 16 chips". One Undo leaves 1 NAND, and one Redo gives 16 again (Review Focus 1).
  - Duplicate two wired NANDs with `Ctrl+D`: 4 NANDs, 2 wires. The copies are selected.
  - Copy A, Duplicate B, Paste: A's copy appears (Review Focus 4).
  - The bar hides while a wire is armed and comes back after Escape (Review Focus 5).
  - On the phone project, the same Array using taps only: tap a NAND, tap Array… in the bar, fill in the dialog, and confirm.
- [ ] **Step 2:** In `a11y-bulk.spec.ts`, run axe with the bar visible and with the Array dialog open, in every theme. Copy the setup from `a11y-save.spec.ts`.
- [ ] **Step 3:** Run `pnpm build && pnpm e2e --grep "bulk"`. Expect PASS on every project.
- [ ] **Step 4:** Run `pnpm e2e:visual:docker --update-snapshots=all`. Review every changed baseline: only the bar's appearance should differ. Commit only Linux baselines.
- [ ] **Step 5:** Run `pnpm e2e:perf` (p95 ≤ 20 ms) and then `pnpm check`. Expect PASS.
- [ ] **Step 6: Commit:** `test(e2e): cover duplicate and array, and re-take baselines with the selection bar`.

### Task 6: Docs and PR (mechanical)

- [ ] **Step 1:** Add a Status section at the top of this plan, as in the 4c plan: what shipped, rulings made while building, and known follow-ups.
- [ ] **Step 2:** If any decision above changed while building, record it in a new ADR (`docs/adr/`, the next free number) and add new terms to `GLOSSARY.md` (Selection bar, Array).
- [ ] **Step 3:** Open the PR with the `pr` skill. Then run one `sonnet` review over the whole PR, and fix what it finds in one wave.
