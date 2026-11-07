# Editor Phase 6: Accessible Editing Implementation Plan

## Status

Planned on 2026-11-07, from the code on `main` at e51472f. Not started. The owner chose the design on 2026-11-07 (spec §3.1): a Parts list and a Wires list, an Actions menu on each row, a "Wire to…" dialog, and a landmark in the side panel. The decisions are recorded in the spec. ADR 51 is written by the last task (T14).

Each task below is a sub-issue of #17 with an "Agent brief". Run them as parallel `sonnet` agents where the blocking edges allow it.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Subagents follow the model policy in `CLAUDE.md`: implementers on `sonnet`, one `sonnet` review per PR.

**Goal:** A screen-reader or keyboard-only user builds, saves and reuses a half adder without touching the canvas. The structure view lists parts, pins and wires. Every editor action has a path in the view. Edits and results are spoken once, by a clear policy. Focus always lands somewhere useful. Keyboard-only E2E flows build a half adder and a full adder. Axe passes on all new UI in every theme.

**Architecture:**
- **Domain (pure, no React):**
  - `circuit-editor/domain/structure.ts` builds `Structure` (parts, pins with connections, wires) from a `Scene`.
  - `circuit-editor/domain/wire-targets-list.ts` lists the legal pins for a "Wire to…" dialog.
  - `circuit-editor/domain/interaction-view.ts` holds the two new commands (`selectItems`, `connectPins`). `announcements-view.ts` holds their texts.
- **UI:** `accessibility/ui/StructureView.tsx` replaces `CircuitSummary`. Rows have Actions menus (`MenuButton`). A "Wire to…" dialog and a part, pin and wire menu sit beside it. The view sends interaction commands, so results are spoken by the canvas's one live region.
- **Proof:** keyboard-only E2E specs, an axe spec, and `@visual` baselines.

**Tech Stack:** TypeScript 7, React 19 with the React Compiler, React Aria Components behind `src/shared/ui`, Zustand vanilla stores, Paraglide (en, es), Vitest, Playwright with axe.

**Spec:** `docs/superpowers/specs/2026-11-07-editor-phase-6-accessible-editing-design.md`. Builds on ADR 3, ADR 21, ADR 43 (interaction state outside history), ADR 49 (wiring several pins) and ADR 50 (Suggest wires).

**Base:** `main` at e51472f.

## What the code has today (read on e51472f)

- `accessibility/ui/CircuitSummary.tsx` (126 lines) lists parts only. An input is a `Switch`, an output an `<output aria-live="polite">` (line 84), anything else a name. `routes/projects.$projectId.tsx:245` renders it under `PinsPanel`.
- The canvas host (`CircuitCanvas.tsx:49`, `role="application"`) owns the polite live region (line 62). `useSpoken` (`use-canvas.ts:181`) words `InteractionState.announcement` with `announcementText`.
- `announcements.ts` (206 lines) dispatches pin and suggestion texts to `announcements-pins.ts` and `announcements-suggest.ts`. `canvas_wired` is the text "Wire added" (`messages/en.json:108`) with no payload.
- `interaction.ts` has `InteractionCommand` (line 126), `Announcement` (line 186) and `Effect` (line 214). It is near its import limit.
- Menus: `CanvasMenus.tsx` (chip menu entries at the top of the file) and `WireMenus.tsx` (wire menu, canvas menu, bit picker). `shared/ui/MenuButton.tsx` is the "⋯" menu button.
- Dialogs exported by `circuit-editor/index.ts`: `RenameChipDialog`, `RecolorChipDialog`, `DialogForm`, `DialogActions`. `ArrayDialog` and the wire colour dialog are not exported; they open from interaction state (`showArray`) or from canvas overlays.
- `use-focus-host.ts` returns focus to the canvas host after a canvas-opened dialog closes (`CanvasOverlays.tsx:52`, `ModeOverlays.tsx:30`).
- Save result: `ChipHeader.tsx:126` `<output>`. Array size line: `ArrayDialog.tsx:96`. Library dialogs show errors with `role="alert"` (`LibraryDialogs.tsx:57`).
- E2E: `support.ts` has `inputSwitch`, `output`, `canvasHost`, `spoken`. `adder-support.ts` has `halfAdderBoard`, `halfAdderWires` and `wireByTaps` (world coordinates). `half-adder-phone.spec.ts` and `full-adder-phone.spec.ts` build both adders by taps on the phone projects. `pins-support.ts` and `save-support.ts` have the Pins panel and save helpers. `visual.spec.ts` has 7 Linux baselines in `visual.spec.ts-snapshots/`.

## Decisions made while planning (Claude's calls, open to the owner's veto)

- **D1. Model in `circuit-editor`, view in `accessibility`.** `structure.ts` needs `Scene` and pin-name logic. `accessibility` imports only the `circuit-editor` index (ADR 23). The index gains `structureOf` and its types.
- **D2. The view sends interaction commands, never editor actions.** Results are announced in one place, and the canvas shows the same selection. Two new commands (spec §3.4): `selectItems` and `connectPins`.
- **D3. A part menu action is "select, then act".** "Move right" sends `selectItems` for the part, then `nudge`. The canvas selection follows what the view acts on.
- **D4. Row menus use `MenuButton`.** Each menu is named "Actions for {row name}". Entries mirror the canvas menus; the part menu adds Move left, right, up and down.
- **D5. "Wire to…" and "Wire from…".** An output pin offers "Wire to…". An input pin offers "Wire from…". Both open one dialog with the same fields. The legal list comes from `checkConnection`, as Suggest wires does. It is built when the dialog opens, not on every render.
- **D6. Outputs go quiet while the clock plays** (spec §3.5, rule 4), with a "Read outputs" button.
- **D7. Wire row order is the sink's reading order.** The `readingOrder` comparator is exported from `pin-selection.ts` (5c).
- **D8. The pins disclosure state is kept per part for the session**, in view state. It is not saved and not part of history.
- **D9. Skip link.** One visually hidden link at the top of `main`, visible on focus, targets the region's heading (`tabIndex={-1}`).
- **D10. Each sub-issue is one PR.** Tests ship with the code. Strings ship in the same PR.

## Global Constraints

- Feature folders expose only `index.ts`, and there are no import cycles (ADR 23). `accessibility` does not import `circuit-editor` internals.
- No `throw` in `domain/`; return `Result` where something can fail (ADR 28). Zod only at trust boundaries (ADR 27).
- Only `src/shared/ui` imports `react-aria-components` or `react-aria` (ADR 26). A missing component goes into `shared/ui`, in its own PR.
- Every user-facing string goes through Paraglide in both `messages/en.json` and `messages/es.json` (ADR 17). Spanish strings follow the existing tone.
- Lint limits: ≤ 300 lines per file, ≤ 50 lines per function, ≤ 3 parameters, complexity ≤ 10, ≤ 10 imported modules per file. `interaction.ts`, `interaction-commands.ts` and `announcements.ts` get at most a few type lines and no new imports.
- Every `domain/**` file needs ≥ 95 % branch coverage.
- Touch targets ≥ 24 px. Axe passes in every theme.
- Existing helpers `inputSwitch` and `output` (`e2e/support.ts`) and the regex `/Wire added/u` keep working.
- Visual baselines come only from `pnpm e2e:visual:docker --update-snapshots=all`. Never commit macOS baselines.
- Commit messages follow Conventional Commits (commitlint) and end with the attribution line in the session's system reminder. Do not bypass hooks.
- Subagents: `model: "sonnet"`, 1–3 files each, focused checks (`pnpm vitest run <files>`, one e2e spec), `pnpm check` only in the last step.

## Review Focus

1. **No action exists only on the canvas.** Spec §3.2: each row has a path in the view. Pinned by T4–T7 tests and T9/T10 E2E.
2. **One path per action.** The view and the canvas send the same interaction command. A test per action checks that both produce the same editor action.
3. **Focus never gets lost.** Spec §3.6. Pinned by T8 and the E2E flows.
4. **Nothing talks over the user.** Outputs are quiet while the clock plays. One region speaks edits. Pinned by T7.
5. **Nothing else changes.** `inputSwitch`, `output`, `/Wire added/u` and the 7 existing baselines (except the ones T12 updates on purpose) still pass.
6. **Large circuits.** The structure model of the 300-part fixture takes < 16 ms. `pnpm e2e:perf` stays ≤ 20 ms.

## Sub-issues and order

| Task | Sub-issue | Blocked by | Files (main) |
|---|---|---|---|
| T1 Structure model | {T1} | none | `circuit-editor/domain/structure.ts`, `index.ts` |
| T2 View commands | {T2} | none | `domain/interaction-view.ts`, `announcements-view.ts`, `interaction.ts` |
| T3 Structure view | {T3} | T1 | `accessibility/ui/StructureView.tsx` (+ rows), route |
| T4 Part actions | {T4} | T2, T3 | `accessibility/ui/PartActions.tsx` |
| T5a Wire targets | {T5A} | T1 | `circuit-editor/domain/wire-targets-list.ts` |
| T5b Wire to… dialog | {T5B} | T2, T3, T5a | `accessibility/ui/WireToDialog.tsx`, `PinActions.tsx` |
| T6 Wire actions | {T6} | T2, T3 | `accessibility/ui/WireActions.tsx` |
| T7 Circuit actions | {T7} | T2, T3 | `accessibility/ui/StructureActions.tsx`, `SuggestedList.tsx` |
| T8 Live regions | {T8} | T3 | `CircuitSummary` successor, `announcements.ts` |
| T9 Focus management | {T9} | T4, T5b, T6, T7 | `accessibility/ui/use-row-focus.ts` |
| T10 Keyboard E2E: half adder | {T10} | T4, T5b, T6, T7, T9 | `e2e/keyboard-half-adder.spec.ts`, `keyboard-support.ts` |
| T11 Keyboard E2E: full adder | {T11} | T10 | `e2e/keyboard-full-adder.spec.ts` |
| T12 Axe in every theme | {T12} | T9 | `e2e/a11y-structure.spec.ts` |
| T13 Linux visual baselines | {T13} | T8, T9, T12 | `e2e/visual.spec.ts`, snapshots |
| T14 ADR 51 and docs | {T14} | T10, T11, T12, T13 | `docs/adr/0051-…`, `GLOSSARY.md`, this plan |
| T15 Manual screen-reader pass | {T15} | T9 | none (the owner runs it) |

T1 and T2 start at once. After T3, T4, T5b, T6 and T7 run in parallel (each adds its own file; T3 leaves a placeholder component for each).

---

## File Structure

```text
src/features/circuit-editor/
  domain/structure.ts                 # NEW  Structure: parts, pins, wires, names (T1)
  domain/wire-targets-list.ts         # NEW  legal pins for a dialog (T5a)
  domain/interaction-view.ts          # NEW  selectItems, connectPins (T2)
  domain/announcements-view.ts        # NEW  texts for the two commands (T2)
  domain/interaction.ts               # + command and announcement types only (T2)
  domain/announcements.ts             # dispatches to announcements-view; "Wire added: {from} to {to}" (T2, T8)
  index.ts                            # + structureOf, wireTargets, StructureView types
src/features/accessibility/
  index.ts                            # exports StructureView; CircuitSummary goes (T3)
  ui/StructureView.tsx (+ .module.css)# NEW  region, skip target, Parts and Wires (T3)
  ui/PartRow.tsx, PinRow.tsx, WireRow.tsx   # NEW rows; each renders one actions component (T3)
  ui/PartActions.tsx                  # NEW  T4
  ui/PinActions.tsx, WireToDialog.tsx # NEW  T5b
  ui/WireActions.tsx                  # NEW  T6
  ui/StructureActions.tsx, SuggestedList.tsx # NEW  T7
  ui/use-row-focus.ts                 # NEW  T9
  ui/OutputsReader.tsx                # NEW  T8
src/routes/projects.$projectId.tsx    # StructureView, skip link (T3)
messages/en.json, messages/es.json
e2e/keyboard-support.ts               # NEW  T10
e2e/keyboard-half-adder.spec.ts       # NEW  T10
e2e/keyboard-full-adder.spec.ts       # NEW  T11
e2e/a11y-structure.spec.ts            # NEW  T12
e2e/visual.spec.ts + snapshots        # T13
docs/adr/0051-accessible-structure-view.md  # NEW  T14
```

---

### T1: Structure model (judgement)

**Files:** Create `domain/structure.ts` and `structure.test.ts`. Modify `circuit-editor/index.ts`.

**Interface:**
```ts
export interface PinEntry { readonly ref: PinRef; readonly name: string; readonly direction: "input" | "output"; readonly width: number; readonly connections: readonly string[] }
export interface PartEntry { readonly instanceId: InstanceId; readonly label: string; readonly kind: "input" | "output" | "nand" | "custom" | "other"; readonly pinId?: PinId; readonly custom?: ChipId; readonly pins: readonly PinEntry[] }
export interface WireEntry { readonly wireId: WireId; readonly from: PinRef; readonly to: PinRef; readonly label: string; readonly color?: WireColor }
export interface Structure { readonly parts: readonly PartEntry[]; readonly wires: readonly WireEntry[] }
export const structureOf: (scene: Scene) => Structure;
```

- [ ] **Step 1: Write the failing tests.** The demo circuit gives 4 parts and 3 wires, in canvas order. Names match `CircuitSummary` (`NAND gate 1`, `Input A`). A custom chip lists its pins with names and widths. A bit tap reads `bit 2`. A pin with no wire has no connection. Fan-out lists every sink. The scene is unchanged.
- [ ] **Step 2:** Run `pnpm vitest run src/features/circuit-editor/domain/structure.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement with small functions. Reuse `pinInfo` and `chipLabel` naming from the announcements. Do not copy the naming code.
- [ ] **Step 4:** Time `structureOf` on the 300-part fixture (median of 7, no coverage). It must be < 16 ms. Record the number in the PR.
- [ ] **Step 5:** Run with coverage (≥ 95 % branches) and `pnpm typecheck`.
- [ ] **Step 6: Commit:** `feat(circuit-editor): describe the circuit as parts, pins and wires`.

### T2: View commands (judgement)

**Files:** Create `domain/interaction-view.ts`, `announcements-view.ts` and their tests. Modify `interaction.ts` (type lines only), `announcements.ts` (dispatch only), `messages/*.json`.

**Interface:**
```ts
// interaction.ts: InteractionCommand gains
//   | { readonly type: "selectItems"; readonly instanceIds: readonly InstanceId[]; readonly wireIds: readonly WireId[] }
//   | { readonly type: "connectPins"; readonly from: PinRef; readonly to: PinRef; readonly color?: WireColor }
// Announcement gains ViewAnnouncement (from announcements-view.ts)
export const VIEW_COMMANDS: ViewHandlers; // spread into the existing command table
```

- [ ] **Step 1: Write the failing tests.** `selectItems` replaces the selection, drops ids that do not exist, closes menus and the card, and announces `selected`. `connectPins` emits one `dispatch` of `connectWire`, announces `wired` on success, and `refused` with the reason on failure. An empty `selectItems` clears the selection.
- [ ] **Step 2–4:** Run, implement, run with coverage.
- [ ] **Step 5: Commit:** `feat(circuit-editor): select items and connect pins by command`.

### T3: Structure view (judgement)

**Files:** Create `accessibility/ui/StructureView.tsx`, `PartRow.tsx`, `PinRow.tsx`, `WireRow.tsx`, `StructureView.module.css`. Modify `accessibility/index.ts`, `routes/projects.$projectId.tsx`, `messages/*.json`. Delete `CircuitSummary.tsx` and its CSS.

- [ ] **Step 1: Write the failing tests** (Vitest with `renderToStaticMarkup`, as `MoveToDialog.test.tsx` does; the repo has no Testing Library, and clicks are covered by E2E): the region is named "Circuit structure"; "Parts" and "Wires" are headings; the demo shows 4 parts and 3 wires; a part's pins are hidden until its disclosure opens; an input is a `Switch` named `Input A`; an output reads `Output OUT: 1`; a selected part says "selected". A skip link targets the heading.
- [ ] **Step 2:** Implement. Rows render a placeholder component for actions (`PartActions`, `PinActions`, `WireActions`, each returns `null`), so T4, T5b and T6 replace only their own file.
- [ ] **Step 3:** Run the existing e2e that use `inputSwitch` and `output` (`pnpm e2e --grep "keyboard|slice|half|persistence"` on chromium). They must pass unchanged.
- [ ] **Step 4: Commit:** `feat(accessibility): replace the summary with a structure view`.

### T4: Part actions (mechanical)

**Files:** Create `accessibility/ui/PartActions.tsx` and its test. Modify `messages/*.json`.

Entries: Delete, Duplicate, Array…, Move left, Move right, Move up, Move down; Rename chip…, Recolor chip…, Look inside for custom chips (spec §3.2). Each sends `selectItems`, then the canvas command (`deleteSelection`, `duplicate`, `showArray`, `nudge`). Rename and Recolor reuse the exported dialogs. Look inside calls the editor's `lookInside`.

### T5a: Wire targets (judgement)

**Files:** Create `domain/wire-targets-list.ts` and its test. Modify `circuit-editor/index.ts`.

```ts
export interface WireTarget { readonly ref: PinRef; readonly label: string; readonly width: number; readonly bits: number }
export const wireTargets: (scene: Scene, from: PinRef) => readonly WireTarget[];
```

Lists the pins a wire from `from` may reach (or from which a wire may reach `from`, when `from` is an input). It uses `checkConnection`. A bus target lists `bits`, so the dialog can ask for a bit. Time it on the 200-part fixture (< 16 ms).

### T5b: "Wire to…" dialog and pin menu (judgement)

**Files:** Create `accessibility/ui/PinActions.tsx`, `WireToDialog.tsx` and tests. Modify `messages/*.json`.

The pin menu offers "Wire to…" (output) or "Wire from…" (input), and "Describe pin" (announces the pin as `p` does). The dialog has a searchable target list, a bit field for a bus end, a one-line summary (`aria-live`), and an inline `role="alert"` refusal. Confirm sends `connectPins`.

### T6: Wire actions (mechanical)

**Files:** Create `accessibility/ui/WireActions.tsx` and its test. Modify `messages/*.json`.

Entries: Delete, Colour…, Re-route, Branch from here, Edit bends. Each sends `selectItems` for the wire, then `deleteSelection`, `recolorSelection` (through a colour dialog the view hosts), `rerouteWire`, `branch` or `editBends`.

### T7: Circuit actions and suggestions (judgement)

**Files:** Create `accessibility/ui/StructureActions.tsx`, `SuggestedList.tsx` and tests. Modify `messages/*.json`.

Above the Parts list: "Add part…" (a menu of NAND and the built-in parts; custom chips stay in the library), "Suggest wires" (sends `suggestWires`), and "Tidy wires". While suggestions exist, a "Suggested wires" list shows each ghost as a row (`{from} to {to}`) with an Accept button, and Accept all and Dismiss buttons. Accept sends `acceptGhost` with the index.

### T8: Live regions (judgement)

**Files:** Create `accessibility/ui/OutputsReader.tsx`. Modify the output row in `PartRow.tsx`, `domain/announcements.ts` (or `announcements-view.ts`), `messages/*.json`.

Implements spec §3.5: outputs quiet while the clock plays; "Read outputs" speaks them once; the redundant `aria-live` on `<output>` goes; "Wire added: {from} to {to}".

### T9: Focus management (judgement)

**Files:** Create `accessibility/ui/use-row-focus.ts` and its test. Modify the row and actions components as needed.

Implements spec §3.6, rules 1–6. A shared hook returns focus after a menu, dialog or delete. The Array dialog (hosted by the canvas overlays) must still return focus to the canvas host when opened from the canvas, and to the row when opened from the view.

### T10: Keyboard-only E2E: half adder (judgement)

**Files:** Create `e2e/keyboard-support.ts` and `e2e/keyboard-half-adder.spec.ts`.

A half adder built, saved and checked with the keyboard alone, on all six projects. No `mouse`, no `worldToPage`, no `pointerFor`, no `tap`. Wires are made through "Wire to…" by part and pin names.

### T11: Keyboard-only E2E: full adder (judgement)

**Files:** Create `e2e/keyboard-full-adder.spec.ts`.

A full adder from two saved Half adders and three NANDs, with the keyboard alone, its whole truth table, and a change inside the Half adder that the Full adder picks up.

### T12: Axe in every theme (mechanical)

**Files:** Create `e2e/a11y-structure.spec.ts`.

For each theme: the view with pins collapsed and expanded, a part menu, a pin menu, the "Wire to…" dialog (with a refusal), a wire menu, the suggested list, and the skip link focused. Copy the setup from `a11y-multi-wire.spec.ts`.

### T13: Linux visual baselines (mechanical)

**Files:** Modify `e2e/visual.spec.ts`; Linux snapshots in `e2e/visual.spec.ts-snapshots/`.

Run `pnpm e2e:visual:docker` first and list the baselines that changed (the panel moved: `demo-pins-panel` will). Add `@visual` tests for the structure view with a half adder and for the "Wire to…" dialog. Update with `--update-snapshots=all`. Commit only Linux files.

### T14: ADR 51 and docs (mechanical)

**Files:** Create `docs/adr/0051-accessible-structure-view.md`. Modify `GLOSSARY.md`, `docs/superpowers/plans/2026-10-29-circuit-editor-roadmap.md` and this plan's Status.

ADR 51 records spec §3.1 and §3.4–3.6. The glossary gets **Structure view**, **Parts list**, **Wires list**, **Row actions menu** and **Wire to… dialog**. This plan's Status is rewritten as 5c's is: what shipped, timings, rulings, follow-ups.

### T15: Manual screen-reader pass (human)

No code. The owner builds a half adder with VoiceOver (macOS and iOS) and NVDA with Firefox, using only the structure view and the header. The result goes into a comment on #17, with anything that reads badly.

## Not in this phase

- A command palette.
- A treegrid or arrow-key model in the view.
- Screen-reader access to the minimap.
- Live values of one instance inside a parent.
