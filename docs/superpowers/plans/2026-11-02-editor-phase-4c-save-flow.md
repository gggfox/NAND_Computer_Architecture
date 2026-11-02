# Editor Phase 4c: Save Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Save updates a chip everywhere it is used, asking first only when the save drops wires; Discard returns a draft to its saved version; Look inside and breadcrumbs move between a chip and the chips inside it; a dot marks unsaved changes; and a reload reopens the chip in `?chip=`.

**Architecture:**
- **Domain logic:**
  - Whether a draft differs from its saved version is a pure function in `projects/domain`, used by the editor header and the library row.
  - The save confirmation is a dry run of the existing `planSave` cascade, turned into a list of consequences in `circuit-editor/domain`.
  - The breadcrumb trail is pure trail functions in `circuit-editor/domain`, held next to `chipId` in the editor store, so every chip switch updates both in one `set`.
- **UI:**
  - A new `ChipHeader` row in `EditorLayout` holds the breadcrumbs, the chip name, the unsaved dot, Save, and a "⋯" menu with Discard.
  - Filing a chip at its first save is a library concern (spec §3.2.4), so it plugs into the header through a `firstSave` render slot, the way quick-add plugs into the canvas (ADR 46, D2).
- **Dependencies:** `circuit-editor` still never imports `chip-library`; the route composes them.

**Tech Stack:** TypeScript 7, React 19 with the React Compiler, React Aria Components behind `src/shared/ui`, Zustand vanilla stores, Paraglide (en, es), Vitest, Playwright with axe.

**Spec:** `docs/superpowers/specs/2026-11-02-editor-phase-4-library-pins-save-design.md`, §1 (Success), §3.2.4 (filing at first save), §3.3, §5, §6 and §7.1.

**Base:** branch `claude/phase-4c-save`, stacked on `claude/phase-4b-library` (PR #24). Rebase onto `main` once #24 merges, before opening the 4c PR.

## Decisions made while planning (Claude's calls, open to the owner's veto)

- **D1. "Unsaved" ignores automatic routes.** A draft has unsaved changes when its pins, instances, wire ends, colours or hand bends differ from the saved version. The waypoints of automatic wires (`manualWaypoints: false`) don't count.
  - Saving a child re-routes the parents' drafts but not their saved versions (`createRerouteAfterSave`). Comparing routes would light the dot on every parent after each child save, though you changed nothing there.
- **D2. Discard re-routes the restored draft, not the parents.** Parents draw a chip from its saved version (§7.1, `pinSpecs` reads `saved`), and Discard doesn't touch the saved version, so nothing in a parent moves.
  - The stale routes are in the restored draft itself. A saved version keeps the routes it had when saved, while renames and saves of the chips it places re-route only drafts. After a discard, the restored draft's automatic wires are routed again (`settled`), and hand-bent wires keep their bends.
  - This is how this plan reads §3.3.3's "re-route the wires in parent chips". Its intent, no stale routes after a discard, is kept.
- **D3. Discard stays an undo step.** It already pushes history. The confirmation still asks first (§3.3.3, owner), but its copy doesn't claim it can't be undone. Undo bringing back discarded edits is strictly safer.
- **D4. Breakage is decided by wires, not pins.** The save asks first only when the dry run drops at least one wire (`WiresRemoved`). A removed pin, or a resized pin, that no parent wired breaks nothing, so it saves at once. When it asks, the list shows each parent's dropped wires and the removed or resized pins that caused them.
- **D5. Count messages use the project's "Label: {count}" form**, as in `canvas_deleted`. So "Removes 3 wires in Full adder" becomes "Wires removed in Full adder: 3". This avoids plural rules in Paraglide.
- **D6. The first save asks for a folder** (§3.2.4). Saving a never-saved chip opens a "Save {name}" dialog with the folder picker, preset to the chip's current folder. Confirming files the chip if the folder changed (`fileChip`, an undo step) and then saves. Later saves never ask for a folder. A first save can't drop wires: a never-saved chip can't be placed, so it has no parents.
- **D7. The trail lives in the editor store**, as `trail: readonly ChipId[]`, whose last item is always `chipId`.
  - `openChip` (library, New chip, delete) starts a fresh trail. `lookInside` appends. `goBack(index)` cuts the trail.
  - After any commit, chips missing from the project are dropped from the trail. If the trail no longer ends at `chipId`, it becomes `[chipId]`.
  - Going back saves nothing (§7.1).
- **D8. `?chip=` read-back.** The editor opens the URL's chip when it exists, and otherwise the project's `lastOpenedChipId`. When the URL's chip is missing, unknown, or malformed, the URL is corrected with `replace` on mount. After a reload the trail is one level (§7.1).
- **D9. Header placement.** `ChipHeader` is a new full-width `header` row between the toolbar and the status row, on every width.
  - Save is a visible button, disabled when there is nothing to save. Discard sits in the header's "⋯" menu and appears only for a saved chip with unsaved changes (§3.3.3: never-saved chips have no Discard).
- **D10. Library dot.** A saved chip with unsaved changes shows the dot on its row. A never-saved chip keeps its "Draft only" badge and shows no dot, so a row never has two markers.
- **D11. Outcomes are announced.** "Saved Half adder" and "Changes to Half adder discarded" are spoken through a polite status in the header. A refused save (`WouldContainItself`) shows through the existing session errors.
- **D12. Ctrl/Cmd+S is not added.** The canvas keymap only acts while the canvas has focus, and a save may need a dialog, so it doesn't fit the keymap. Listed as a follow-up.
- **D13. The Done-when journey builds a real full adder** on a phone with taps only, from two half adders and an OR made of three NANDs (spec §1). After the change inside the half adder, the test checks the full adder's outputs, not just its labels.

## Global Constraints

- Feature folders expose only `index.ts`. `chip-library` may import only `~/features/projects`, `~/features/circuit-editor`, `~/shared/**` and `~/i18n/**`. `circuit-editor` never imports `chip-library`. The import graph has no cycles (ADR 23).
- No `throw` in `domain/`; return `Result` (ADR 28). Zod is used only at trust boundaries (ADR 27).
- Only `src/shared/ui` imports `react-aria-components` or `react-aria` (ADR 26).
- Every user-facing string goes through Paraglide in both `messages/en.json` and `messages/es.json` (ADR 17).
- Lint limits: ≤ 300 lines per file, ≤ 50 lines per function, ≤ 3 parameters, complexity ≤ 10, ≤ 10 imports per file. `interaction-commands.ts` and `gestures.ts` take no new logic. `editor-store.ts` is at 238 lines, so trail logic lives in `domain/breadcrumbs.ts`.
- Every `domain/**` file needs ≥ 95 % branch coverage.
- Touch targets are ≥ 24 px. Axe passes in every theme with every new menu and dialog open.
- `pnpm e2e:perf` p95 stays ≤ 20 ms.
- Saving is not on the undo stack (spec §5.11), and the existing `savedEverywhere` keeps it that way.
- Visual baselines are regenerated only with `pnpm e2e:visual:docker --update-snapshots=all`. Never commit macOS baselines.
- Commit messages follow Conventional Commits (commitlint) and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Don't bypass hooks.

## Review Focus

1. **Saving a child must not light the dot on its parents.** After Half adder is saved, Full adder's draft is re-routed but has no unsaved changes. Pinned by Task 1 (`hasUnsavedChanges` ignores automatic waypoints) and Task 8 (e2e: no dot on Full adder after the half adder's save).
2. **Undo after a save.** Undoing an edit made before the save brings back a draft that differs from the saved version, so the dot appears and Save is enabled. Undo never reverts the save itself. Pinned by Task 3 (store test).
3. **Cancel in the save confirmation changes nothing.** The project and history are the same objects as before, and no autosave is scheduled. Pinned by Task 6 (e2e: the parent's wire is still there after Cancel).
4. **A chip in the trail is deleted** (from the library, while you're inside a chip it contains). The breadcrumbs drop it, and nothing crashes. Pinned by Task 4.
5. **A `?chip=` naming a deleted chip, or a garbled one**, opens `lastOpenedChipId` and corrects the URL. Pinned by Task 5 (unit and e2e).

---

## File Structure

```text
src/features/projects/domain/
  unsaved.ts            # NEW circuitsMatch, hasUnsavedChanges, unsavedState
src/features/circuit-editor/
  domain/chip-edits.ts  # discardDraft routes the restored draft (D2)
  domain/save-preview.ts        # NEW savePreview: the confirmation's list (D4)
  domain/breadcrumbs.ts         # NEW trail functions (D7)
  domain/view-search.ts         # + startingChipId (D8)
  application/editor-store.ts   # + trail, lookInside, goBack
  ui/ChipHeader.tsx             # NEW breadcrumbs, name, dot, Save, ⋯ Discard
  ui/SaveDialogs.tsx            # NEW save confirmation, discard confirmation
  ui/use-save-flow.ts           # NEW what Save and Discard do, and the spoken outcome
  ui/EditorLayout.tsx           # + header slot
  ui/CanvasMenus.tsx            # Look inside → lookInside
src/features/chip-library/
  ui/FirstSaveDialog.tsx        # NEW folder picker at the first save (D6)
  ui/LibraryRow.tsx             # + unsaved dot (D10)
  domain/library-tree.ts        # draftOnly → unsaved: UnsavedState
src/routes/projects.$projectId.tsx  # header, firstSave slot, ?chip= read-back
```

---

### Task 1: Unsaved changes (mechanical)

**Files:**
- Create: `src/features/projects/domain/unsaved.ts` and `unsaved.test.ts`
- Modify: `src/features/projects/index.ts`

**Interfaces:**
- Produces:
  ```ts
  export type UnsavedState = "new" | "changed" | "saved";
  /** Equal pins (order included), instances, wires; automatic wires' waypoints ignored (D1). */
  export const circuitsMatch: (left: Circuit, right: Circuit) => boolean;
  /** "new" without a saved version; "changed" when the draft doesn't match it. */
  export const unsavedState: (chip: Chip) => UnsavedState;
  export const hasUnsavedChanges: (chip: Chip) => boolean; // unsavedState !== "saved"
  ```

- [ ] **Step 1: Write the failing tests** in `unsaved.test.ts`:
  - `unsavedState` of a chip without `saved` is `"new"`.
  - The same circuit object for draft and saved is `"saved"`, and `circuitsMatch` returns `true` without walking the circuit (identity first).
  - A structurally equal copy (`structuredClone`) is `"saved"`.
  - Each of these alone makes it `"changed"`: a renamed pin; two pins swapped in order; a pin width; an instance moved one cell; an added instance; a wire's `to` changed; a wire's colour; a hand-bent wire's waypoints (`manualWaypoints: true`).
  - An automatic wire with different waypoints stays `"saved"` (D1).
  - A wire switched between automatic and hand-bent is `"changed"`.
- [ ] **Step 2:** Run `pnpm vitest run src/features/projects/domain/unsaved.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement `unsaved.ts`. Compare field by field, without JSON round-trips, and keep instances and wires in array order.
- [ ] **Step 4:** Run `pnpm vitest run src/features/projects` and then `pnpm typecheck`. Expect PASS.
- [ ] **Step 5: Commit:** `feat(projects): tell when a chip's draft differs from its saved version`.

### Task 2: Discard routes the restored draft (judgement)

**Files:**
- Modify: `src/features/circuit-editor/domain/chip-edits.ts`
- Modify: `src/features/circuit-editor/domain/reshape-routing.test.ts`, or create `discard-routing.test.ts` if that file would pass 300 lines
- Possibly modify: `src/features/circuit-editor/domain/route-edits.ts`, to export a helper

**Interfaces:**
- Consumes: `settled(scene, wireIds)` from `route-edits.ts`.
- Produces: `discardDraft` with D2's behaviour. Its signature and `ChipNotSaved` refusal are unchanged.

- [ ] **Step 1: Write the failing tests:**
  - **Stale routes.** Parent P places child C, and P is saved. Then C is renamed to a longer name, which widens it and re-routes P's draft but not P's saved version. Discard P. Every automatic wire in P's draft that ends on C's pins has a route ending at that pin's current anchor in C's widened layout, and no route crosses C's body. Use the existing `reshape-routing.test.ts` fixtures and assertions.
  - **Nothing stale.** Discarding a chip whose saved routes are still valid makes the draft the very same object as `chip.saved`.
  - **Hand bends.** A hand-bent wire in the saved version keeps its waypoints after a discard.
  - **Parents untouched.** Every other chip in the project is the same object after the discard.
  - **Never saved.** Discarding a never-saved chip is still `ChipNotSaved`.
- [ ] **Step 2:** Run `pnpm vitest run src/features/circuit-editor/domain`. Expect FAIL on the stale-routes case.
- [ ] **Step 3:** Implement. `discardDraft` restores `chip.saved`, then applies `settled({ project, circuit: restored }, automatic wire ids)` with the project after the restore. `settled` keeps unchanged routes, and the circuit, as the same objects.
- [ ] **Step 4:** Run `pnpm vitest run src/features/circuit-editor`, then `pnpm typecheck`. Expect PASS.
- [ ] **Step 5: Commit:** `fix(circuit-editor): route a discarded draft for the chips it places now`.

### Task 3: Save preview (judgement)

**Files:**
- Create: `src/features/circuit-editor/domain/save-preview.ts` and `save-preview.test.ts`
- Modify: `src/features/circuit-editor/index.ts`
- Modify: `src/features/circuit-editor/application/editor-store-chips.test.ts` (Review Focus 2)

**Interfaces:**
- Consumes: `planSave` and `SaveEffect` from `~/features/projects`.
- Produces:
  ```ts
  export type SaveConsequence =
    | { readonly type: "wiresRemoved"; readonly chipName: string; readonly count: number }
    | { readonly type: "pinRemoved"; readonly name: string }
    | { readonly type: "pinWidthChanged"; readonly name: string; readonly from: BitWidth; readonly to: BitWidth };
  export interface SavePreview {
    /** Empty when the save breaks nothing: it then happens with no dialog (D4). */
    readonly consequences: readonly SaveConsequence[];
  }
  export const savePreview: (project: Project, chipId: ChipId) => Result<SavePreview, EditorError>;
  ```
  - When there's at least one `WiresRemoved`, `consequences` lists the causes first (removed pins, then resized pins, in the old saved version's pin order), then one `wiresRemoved` per parent in project chip order. Otherwise it is empty.
  - `PinAdded` and `PinRenamed` never appear (§3.3.2).

- [ ] **Step 1: Write the failing tests** in `save-preview.test.ts`:
  - Renaming a pin, adding a pin, reordering pins, and editing the inside of the chip each give `consequences: []`.
  - Removing a pin that a parent wires gives `[{ type: "pinRemoved", name: "B" }, { type: "wiresRemoved", chipName: "Full adder", count: 1 }]`.
  - Resizing a wired pin from 1 to 4 bits gives `pinWidthChanged` with `from: 1, to: 4`, then `wiresRemoved`.
  - Removing a pin no parent wires gives `[]` (D4).
  - Two parents give two `wiresRemoved` lines. A wire dropped in both a parent's draft and its saved version counts once (as `planSave` does).
  - A save that would make the chip contain itself is `err({ type: "WouldContainItself", … })`.
  - The project passed in is not changed (dry run).
- [ ] **Step 2: Write the store test** in `editor-store-chips.test.ts`. Edit the open chip, save, make a second edit, then undo twice. `unsavedState` of the chip is `"changed"`, and `saved` still equals the circuit that was saved.
- [ ] **Step 3:** Run `pnpm vitest run src/features/circuit-editor`. Expect FAIL.
- [ ] **Step 4:** Implement `save-preview.ts` and export `savePreview`, `SavePreview` and `SaveConsequence` from `index.ts`.
- [ ] **Step 5:** Run `pnpm vitest run src/features/circuit-editor` and then `pnpm typecheck`. Expect PASS.
- [ ] **Step 6: Commit:** `feat(circuit-editor): preview what a save drops in the chips that use it`.

### Task 4: Breadcrumb trail and Look inside (judgement)

**Files:**
- Create: `src/features/circuit-editor/domain/breadcrumbs.ts` and `breadcrumbs.test.ts`
- Modify: `src/features/circuit-editor/application/editor-store.ts`, with tests in `editor-store-chips.test.ts`, or a new `editor-store-trail.test.ts` if that file passes 300 lines
- Modify: `src/features/circuit-editor/ui/CanvasMenus.tsx` (Look inside calls `lookInside`)

**Interfaces:**
- Produces in `breadcrumbs.ts`:
  ```ts
  export type Trail = readonly ChipId[];
  /** Appends `chipId`; when it is already in the trail, cuts back to it. */
  export const trailInto: (trail: Trail, chipId: ChipId) => Trail;
  /** The trail up to and including `index`; the same trail when `index` is out of range. */
  export const trailTo: (trail: Trail, index: number) => Trail;
  /** Drops chips missing from `project`; `[open]` when the result no longer ends at `open` (D7). */
  export const repairTrail: (trail: Trail, project: Project, open: ChipId) => Trail;
  ```
- Produces on `EditorState`:
  ```ts
  readonly trail: Trail;                                             // starts as [chipId]
  readonly lookInside: (chipId: ChipId) => Result<void, EditorError>; // ChipNotFound when missing
  readonly goBack: (index: number) => void;                          // no-op out of range or on the last item
  ```
  - `openChip` keeps its signature and now sets `trail: [chipId]` in the same `set`.
  - `commit` repairs the trail in the same `set` as the history, so no subscriber sees a trail naming a deleted chip.

- [ ] **Step 1: Write the failing tests** in `breadcrumbs.test.ts`. Cover each function's normal case and its edge cases: an out-of-range index, `trailInto` of a chip already present, `repairTrail` with a deleted middle chip, and `repairTrail` with the open chip deleted.
- [ ] **Step 2: Write the store tests:**
  - `lookInside(half)` from Full adder gives `trail [full, half]` and `chipId half`, and the history is unchanged.
  - `goBack(0)` gives `[full]` and `chipId full`.
  - `openChip(x)` from a two-level trail gives `[x]`.
  - Review Focus 4: from `[full, half]`, `deleteChip(full)` (allowed once nothing uses it) gives `trail [half]`.
  - Deleting the open chip gives a trail of `[first remaining chip]`.
  - `lookInside` of an unknown chip sets `lastError` to `ChipNotFound`.
- [ ] **Step 3:** Run `pnpm vitest run src/features/circuit-editor`. Expect FAIL.
- [ ] **Step 4:** Implement. Point `CanvasMenus`' Look inside at `lookInside`.
- [ ] **Step 5:** Run `pnpm vitest run` and then `pnpm typecheck`. Expect PASS.
- [ ] **Step 6: Commit:** `feat(circuit-editor): breadcrumb trail for Look inside`.

### Task 5: Open the chip in `?chip=` (mechanical)

**Files:**
- Modify: `src/features/circuit-editor/domain/view-search.ts` and `view-search.test.ts`
- Modify: `src/features/circuit-editor/index.ts`
- Modify: `src/routes/projects.$projectId.tsx`
- Modify: `e2e/library-browse.spec.ts`, or create `e2e/chip-url.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  /** The chip the editor opens: `chip` when the project has it, else `lastOpenedChipId` (D8). */
  export const startingChipId: (project: Project, chip: ChipId | undefined) => ChipId;
  ```
- In the route, `Editor` passes `{ ...project, lastOpenedChipId: startingChipId(project, view.chip) }` to `useLinkedSession`. On mount, if `view.chip` differs from that id, it writes the URL with `replace: true`.

- [ ] **Step 1: Write the failing unit tests:** a known chip is returned; an unknown chip falls back; `undefined` falls back.
- [ ] **Step 2: Write the failing e2e tests:**
  - Open chip B from the library, reload, and B is open, with the header showing only "B" (one-level trail).
  - Visiting `?chip=<a random UUID>` opens the last-opened chip, and the URL's `chip` becomes that chip's id.
  - `?chip=garbage` does the same.
- [ ] **Step 3:** Run `pnpm vitest run src/features/circuit-editor/domain/view-search.test.ts`. Expect FAIL.
- [ ] **Step 4:** Implement.
- [ ] **Step 5:** Run the unit tests, `pnpm typecheck`, then `pnpm e2e --project=chromium e2e/<spec>`. Expect PASS. The e2e header assertion waits for Task 6; until then, assert on the open chip through the circuit summary.
- [ ] **Step 6: Commit:** `feat(editor): reopen the chip named in the URL`.

### Task 6: Chip header, Save and Discard (judgement)

**Files:**
- Create: `src/features/circuit-editor/ui/ChipHeader.tsx` with `ChipHeader.module.css`, `SaveDialogs.tsx` and `use-save-flow.ts`
- Modify: `src/features/circuit-editor/ui/EditorLayout.tsx` and `EditorLayout.module.css` (`header` slot, D9)
- Modify: `src/features/circuit-editor/index.ts`, `src/routes/projects.$projectId.tsx`, and `messages/en.json` / `messages/es.json`
- Create: `e2e/save-flow.spec.ts`, plus `e2e/save-support.ts` for helpers Task 8 reuses

**Interfaces:**
- Consumes: Task 1's `unsavedState`, Task 3's `savePreview`, and Task 4's `trail`, `goBack` and `openChip`.
- Produces:
  ```ts
  /** What the first save of a never-saved chip shows instead of saving at once (D6). */
  export interface FirstSaveContext {
    readonly chipId: ChipId;
    /** Saves the chip (call after filing it); closes the slot. */
    readonly save: () => void;
    readonly cancel: () => void;
  }
  export type FirstSaveSlot = (context: FirstSaveContext) => ReactNode;
  export function ChipHeader(props: { readonly session: EditorSession; readonly firstSave?: FirstSaveSlot }): ReactNode;
  ```
  - `EditorLayout` gains `readonly header?: ReactNode`.
- Behaviour:
  - **Breadcrumbs.** A `<nav aria-label={m.chip_path_label()}>` holds an `<ol>`. Each earlier chip is a quiet button calling `goBack(i)`. The open chip is plain text with `aria-current="page"`. Names are read live, so a rename shows at once. On a 320 px phone, items truncate with an ellipsis and the page never scrolls sideways.
  - **Dot.** Shown when `unsavedState` is not `"saved"`, with visually hidden `m.chip_unsaved()`.
  - **Save.**
    - Disabled when `"saved"`.
    - `"new"`: the `firstSave` slot when given, otherwise save at once.
    - `"changed"`: run `savePreview`. Empty consequences save at once. Otherwise open the save confirmation. A preview error dispatches `saveChip` anyway, so the store reports it through `lastError` (D11).
  - **⋯ menu.** "Discard changes…" appears only when `"changed"`. It opens the discard confirmation, and confirming dispatches `discardDraft`.
  - **Outcomes.** A polite `role="status"` in the header says `chip_saved` or `chip_discarded`.
- Message keys, each in en and es:

  | Key | en | es |
  |---|---|---|
  | `chip_path_label` | "Chip path" | "Ruta del chip" |
  | `chip_unsaved` | "Unsaved changes" | "Cambios sin guardar" |
  | `chip_save` | "Save" | "Guardar" |
  | `chip_more_label` | "More chip actions" | "Más acciones del chip" |
  | `chip_discard` | "Discard changes…" | "Descartar cambios…" |
  | `chip_discard_title({name})` | "Discard changes to {name}?" | "¿Descartar los cambios de {name}?" |
  | `chip_discard_body` | "The chip goes back to its last saved version." | "El chip vuelve a su última versión guardada." |
  | `chip_discard_confirm` | "Discard" | "Descartar" |
  | `chip_save_title({name})` | "Save {name}?" | "¿Guardar {name}?" |
  | `chip_save_body` | "Saving updates every chip that uses it:" | "Al guardar se actualizan todos los chips que lo usan:" |
  | `chip_save_wires_removed({chip, count})` | "Wires removed in {chip}: {count}" | "Cables eliminados en {chip}: {count}" |
  | `chip_save_pin_removed({name})` | "Pin {name} removed" | "Pin {name} eliminado" |
  | `chip_save_pin_width({name, from, to})` | "Pin {name}: {from} → {to} bits" | "Pin {name}: {from} → {to} bits" |
  | `chip_saved({name})` | "Saved {name}" | "{name} guardado" |
  | `chip_discarded({name})` | "Changes to {name} discarded" | "Cambios de {name} descartados" |

  Cancel reuses `dialog_cancel`.

- [ ] **Step 1: Write the failing e2e tests** in `save-flow.spec.ts`, from `fixtures/library.json`, which has Half adder placed in Full adder:
  - Open Half adder and move a NAND. The dot shows. Save: no dialog, the dot goes, and "Saved Half adder" is announced.
  - In Half adder, delete pin B, which Full adder wires. Save shows the dialog with "Pin B removed" and "Wires removed in Full adder: 1".
    - Cancel: still dirty. Open Full adder: the wire is there (Review Focus 3).
    - Save, then confirm: open Full adder and the wire is gone.
  - Discard: edit, open ⋯ › Discard changes…, confirm. The edit is gone, there's no dot, and "Changes to Half adder discarded" is announced. Undo brings the edit back (D3).
  - A never-saved chip has no Discard entry, and Save is enabled.
  - Look inside: from Full adder, open the Half adder chip menu › Look inside. The breadcrumbs read "Full adder › Half adder". Tap "Full adder": you're back, and nothing was saved.
- [ ] **Step 2:** Run `pnpm e2e --project=chromium e2e/save-flow.spec.ts`. Expect FAIL.
- [ ] **Step 3:** Implement the header, dialogs, hook, layout slot, messages, and the route wiring (`header={<ChipHeader session={session} firstSave={library.firstSave} />}`; Task 7 adds `library.firstSave`, so until then pass nothing).
- [ ] **Step 4:** Run the spec on chromium, webkit and mobile-chrome, then `pnpm check`. Expect PASS.
- [ ] **Step 5: Commit:** `feat(circuit-editor): chip header with Save, Discard and breadcrumbs`.

### Task 7: Library dot and filing at first save (judgement)

**Files:**
- Create: `src/features/chip-library/ui/FirstSaveDialog.tsx`
- Modify: `src/features/chip-library/domain/library-tree.ts` (`draftOnly: boolean` becomes `unsaved: UnsavedState`) with its tests, plus the users of `draftOnly`
- Modify: `src/features/chip-library/ui/LibraryRow.tsx`, its CSS, and `use-library.tsx` (returns `firstSave: FirstSaveSlot`)
- Modify: `src/routes/projects.$projectId.tsx`, and `messages/en.json` / `messages/es.json`
- Modify: `e2e/save-flow.spec.ts`

**Interfaces:**
- Consumes: `UnsavedState` and `unsavedState` (Task 1), `FirstSaveSlot` (Task 6), and `folderOptions` / `folderIdOf` / `currentFolder` (`ui/folder-options.ts`).
- `FirstSaveDialog`:
  - Title `chip_first_save_title({name})`, body `chip_first_save_body`, the folder `Select` preset to the chip's folder, then Cancel and Save.
  - Save dispatches `fileChip` only when the folder changed, then calls `context.save()`.
  - A refused `fileChip` keeps the dialog open and shows its reason.
- Message keys:

  | Key | en | es |
  |---|---|---|
  | `chip_first_save_title({name})` | "Save {name}" | "Guardar {name}" |
  | `chip_first_save_body` | "Pick its folder. You can move it later." | "Elige su carpeta. Puedes moverlo después." |

- [ ] **Step 1: Write the failing tests:**
  - In `library-tree.test.ts`: a never-saved chip has `unsaved: "new"`; a saved, edited one `"changed"`; a clean one `"saved"`.
  - In `save-flow.spec.ts`:
    - Create "Half adder" from New chip at the top level, then Save. The first-save dialog opens. Pick `Arithmetic › Adders` and save: the chip is in that folder, saved, and placeable.
    - A saved chip with edits shows the dot on its library row. Its parent doesn't (Review Focus 1).
- [ ] **Step 2:** Run the unit tests and the spec. Expect FAIL.
- [ ] **Step 3:** Implement. On the row: "new" keeps the "Draft only" badge, and "changed" shows the dot with visually hidden `chip_unsaved` (D10).
- [ ] **Step 4:** Run `pnpm check` and the spec on chromium and mobile-chrome. Expect PASS.
- [ ] **Step 5: Commit:** `feat(chip-library): file a chip at its first save and mark unsaved rows`.

### Task 8: Done-when journey, accessibility, visuals and docs (judgement)

**Files:**
- Create: `e2e/full-adder-phone.spec.ts`, reusing `e2e/half-adder-phone.spec.ts`'s tap helpers. Move shared ones to `e2e/pins-support.ts` or `e2e/save-support.ts` rather than copying them.
- Modify: `e2e/a11y.spec.ts` and `e2e/visual.spec.ts` (plus the Docker baselines)
- Create: `docs/adr/0047-save-flow-and-breadcrumbs.md`
- Modify: `GLOSSARY.md`, and this plan's Status section

- [ ] **Step 1: Write the Done-when spec**, run on mobile-chrome and mobile-safari, using taps only (spec §1, D13):
  1. Create folders `Arithmetic` and `Arithmetic › Adders` from the library.
  2. Build Half adder with named pins A, B, SUM and CARRY (as in `half-adder-phone`). Save it and file it into `Arithmetic › Adders` at the first save.
  3. Create Full adder with pins A, B, CIN, S and COUT. Find Half adder in the tree and tap-place two of them. Tap-place three NANDs as an OR, wire everything, and save.
  4. Check all eight rows of the truth table: S is A xor B xor CIN, and COUT is the majority.
  5. Look inside the first Half adder. Delete the wire into CARRY and save: no dialog, because no pin changed.
  6. Tap "Full adder" in the breadcrumbs. For A = B = 1 and CIN = 0, COUT is no longer 1. The full adder already runs the new version.
  7. Full adder shows no unsaved dot (Review Focus 1).
- [ ] **Step 2:** Add axe states in every theme: the header with the dot, the ⋯ menu open, the save confirmation, the discard confirmation, and the first-save dialog.
- [ ] **Step 3:** Add a `chip-header` visual: Full adder › Half adder with the dot. Regenerate baselines in Docker. Existing editor baselines change by the header row; check each diff and accept it.
- [ ] **Step 4:** Run `pnpm check`, `pnpm e2e`, `pnpm e2e:perf` (p95 ≤ 20 ms) and `pnpm e2e:visual:docker`. Expect PASS.
- [ ] **Step 5: Write the docs:**
  - ADR 47 records D1–D13 and the rulings made while building.
  - `GLOSSARY.md` gains "breadcrumb trail", "unsaved changes" and "save confirmation".
  - This plan gets a Status section at the top, in the 4b plan's form.
- [ ] **Step 6: Commit:** `test(e2e): build a full adder on a phone with taps only` and `docs: ADR 47 save flow and breadcrumbs`.
