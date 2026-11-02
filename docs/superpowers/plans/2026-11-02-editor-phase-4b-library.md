# Editor Phase 4b: Library Implementation Plan

## Status

Tasks 1-12 are done. The decisions, and the calls made while building, are recorded in [ADR 46](../../adr/0046-chip-library-and-placement.md).

What shipped:

- Nested folders and stars in the file format (additive, no version bump), with folder tree and filing logic in `projects/domain/folders.ts`.
- Library edits as editor actions and undo steps; deleting a chip resets the history and opens another chip.
- The `chip-library` feature: tree view model, search tiers and filters, the panel (a column from 640 px) and the phone sheet, row menus, the New chip, New folder, Rename, Colour, Tags, Move to… and Delete dialogs.
- Placing: armed placement with the placing banner, keyboard placing at the centre of the view, long-press and mouse drag to the canvas and between folders, and the quick-add menu through the `canvasMenu` slot.
- E2E for the phone tap path, the keyboard path and D6; axe on every new surface in every theme; `library-panel` and `quick-add` visual baselines.

Rulings made while building:

- Drops hit-test the canvas by its rectangle (`clientToCanvas`), not `elementFromPoint`, because an open sheet makes the rest of the page inert.
- The WebKit touch drag test is skipped: Playwright's WebKit can't inject real touches. The tap path is tested there.
- The drag sends a clock tick before every release, so a held press is never read as a tap.
- Tasks 5 and 6 were built and reviewed as one dispatch.
- A deleted armed chip, or a change of open chip, cancels placement in the UI; Recent shows only kinds that can still be placed.
- The `getBoundingClientRect` read per input is checked by the perf gate (Task 12).
- Rows that can't be placed stay focusable and keep their menu; they use `data-unavailable` and a description of the reason instead of `aria-disabled`, and Enter or a tap places nothing.
- The route writes `?chip=` when the open chip changes; reading it on load moves to 4c.
- Three extra message keys (Tags dialog title, Rename folder title, the "Colour…" label) were accepted.
- A long-press on empty canvas opens the quick-add with the Pan tool; with Select it keeps starting the lasso.
- On phones the quick-add search field takes focus on open (the keyboard appears); kept for owner feedback.

Known follow-ups:

- **Before merge:** check long-press drag by hand on iOS Safari (a device or the simulator). If iOS cancels the drag, add the grip handle from the Task 1 brief.
- **Before merge:** PR #23 merges first; then rebase this branch onto `main` and re-run `pnpm check`, `pnpm e2e` and the visual baselines.
- Drag: a no-op drop (same folder, or Top level for a top-level item) adds an empty undo step; focus goes to the body after a folder drop on wide screens; the "Top level" row may be out of reach in a long library (no auto-scroll); `track-press.ts` and `row-drag.ts` have no unit tests; the 500 ms press suppression after a menu or drop can swallow a keyboard Enter.
- Search: `allTags` is case-sensitive while the filter is not ("Gate" and "gate" show twice); empty folders vanish while searching; `prunedKeys` scans every top-level key per key.
- Dialogs: Move to… swallows a refusal error; Rename and Colour close on a refusal (the reason shows only in the status line); the delete error is plain text.
- Quick-add: no "no results" message; the search field is controlled twice; the section label is read twice (`aria-label` and header).
- Interaction: `armPlacement` leaves bend mode on; adding a pin from the quick-add announces nothing; rename `WIRING_COMMANDS`, which now carries placement commands.
- A draft-only open chip shows `ChipNotSaved`, not `WouldContainItself`; the UI doesn't assume the latter.
- Tests to add: folder-issue paths below a cycle, `deleteFolder` re-parenting through three levels, `tagChip` with an unknown chip, `runRowCommand`, library-view expansion state, tag filter chips in e2e, `isTucked`.
- Small cleanups: `reopenAfterDelete` sets `chipId` directly (check it matches `openChip`); define `CanvasMenuSlot` in `library-bridge`; drop the `PlaceableKind` re-export kept only for a test; detach the CDP session in the drag spec; hover style on unavailable rows.
- Keyboard modality: `useFocusVisible` stands in for React Aria's interaction modality, so a screen reader's click on a part may arm it rather than place it at the centre; document or fix.
- Test hygiene: a garbled test name at `placement.test.ts:697`, a duplicated quick-add test name, `Parameters<typeof isArmed>[1]` where `PlaceableKind` is meant, file-wide lint disables in the drag-intent test, quick-add styles living in `shared` rather than a `QuickAdd.module.css`.
- Firefox did not launch on the Task 12 machine ("Could not find profile folder"), so the new specs ran on Chromium, WebKit, mobile Chrome, mobile Safari and tablet Safari only; CI runs Firefox.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A chip library with nested folders, search and filters, where chips are filed, moved, starred, tagged and deleted, and placed on the canvas by tap, by drag, from the keyboard or from the quick-add menu.

**Architecture:**
- **Domain logic:**
  - Folder nesting and chip filing are pure functions in `projects/domain`.
  - The editor reaches them through new `EditorAction`s, so every library edit goes through `dispatch`.
  - Placing a chip is new interaction state in `circuit-editor`: armed placement, the `placeAt` and `addPinAt` commands, and recent placements.
  - The new `chip-library` feature holds the tree view model and search ranking in its own `domain/`, and the panel, sheet, rows, dialogs, drag and quick-add in `ui/`.
- **Dependencies:**
  - `chip-library` imports only the `projects` and `circuit-editor` index files.
  - `circuit-editor` never imports `chip-library`.
  - The route composes the two: the quick-add menu plugs into the canvas through a `canvasMenu` render slot.

**Tech Stack:** TypeScript 7, React 19 with the React Compiler, React Aria Components (`Tree`) behind `src/shared/ui`, Zustand vanilla stores, Zod at the file boundary only, Paraglide (en, es), Vitest, Playwright with axe.

**Spec:** `docs/superpowers/specs/2026-11-02-editor-phase-4-library-pins-save-design.md`, §3.2, the 4b items in §6, §7.1 and §9.

**Base:** branch `claude/phase-4b-library`, stacked on `claude/phase-4-library-and-pins` (PR #23). Rebase onto `main` once #23 merges, before opening the 4b PR.

## Decisions made while planning (Claude's calls, open to the owner's veto)

- **D1. Drag mechanism.** One pointer-event drag handles both tree → canvas and tree → tree, with a ghost under the finger. On touch the drag starts after a long-press; with a mouse it starts after a 4 px move. React Aria drag-and-drop is not used.
  - It can't be exercised by our touch e2e: Playwright touch doesn't drive HTML5 drag.
  - Running two drag systems side by side doubles the edge cases.
  - Keyboard and screen-reader users move items with "Move to…" (spec §3.2.4).
  - Task 1 spikes the risky part: a long-press drag out of a scrolling bottom sheet. Spec §8 leaves the mechanism to the builder.
- **D2. Which feature depends on which.** `chip-library` imports `circuit-editor`, the way `accessibility` does. The placement payload is `PlaceableKind`, which `circuit-editor` exports.
  - §7.1 has the payload exported by `chip-library` instead. That would need `circuit-editor` to import `chip-library`, and `chip-library` must dispatch editor actions, so the two would form a cycle.
  - The quick-add menu reaches the canvas through `CircuitCanvas`'s `canvasMenu` slot.
- **D3. Library edits are undo steps.** That covers folder create, rename, move and delete, and chip file, star and tag. `createChip` keeps its current rule: it applies to every snapshot. `deleteChip` resets the undo history, and its confirmation says it can't be undone. Otherwise a later save could write a saved version that places a chip already deleted in another snapshot.
- **D4. Deleting the open chip** opens the first other chip in project order. The last chip in a project can't be deleted (`LastChip`).
- **D5. Long-press on touch:** holding still opens the row menu, and moving after the long-press starts a drag. Every row also has a visible "⋯" menu button. Right-click opens the same menu.
- **D6. Armed placement stays armed.** Every tap on the canvas places a copy, which saves re-opening the sheet six times for six NANDs. It ends with Escape, a tap on the armed row, or the "Done" button in the placing banner over the canvas. Arming a placement disarms a wire pin, and the other way round.
- **D7. Built-in rows** are fixed, in this order: NAND, Split 4, Split 8, Split 16, Merge 4, Merge 8, Merge 16. The clock isn't listed until it ships (spec §4). Their labels come from `partName`.
- **D8. Search tiers:** path (0), name (1), tag (2), colour (3).
  - The colour tier follows the owner's recall order in §1.
  - A chip's colour matches when the query matches its swatch's translated name, for example "red".
  - Matching ignores case and diacritics and uses substrings; there is no fuzzy matching.
  - Within a tier, results are sorted by name.
- **D9. Quick-add** has a search field, Recent, Starred, "Add input" and "Add output", plus the existing "Tidy wires".
  - **Paste is left out:** the editor has no copy and paste yet.
  - **Recent** holds the last 5 kinds placed in this session. It lives in interaction state and isn't saved.
- **D10. Filing at first save moves to 4c.** No Save UI exists yet, so §3.2.4's "the first save lets you pick or change its folder" ships with the save flow.
  - In 4b, a new chip is draft-only and can't be placed until 4c.
  - The e2e tests place saved chips from a fixture.
- **D11. "Add NAND" stays in the toolbar.** Many e2e specs and the perf spec use it (§3.2.7 makes removing it optional).
- **D12. Folder integrity:**
  - The file format rejects a folder whose `parentId` names no folder, or whose parents form a cycle. These are structural errors, like unpaired pin pieces.
  - A chip whose `folderId` names no folder is shown at the top level. Files already allow that, and it never loses a chip.
- **D13. Names and tags:**
  - Folder names are trimmed and must not be empty. Two folders may share a name.
  - Tags are trimmed and empty ones are dropped. Duplicates are compared ignoring case; the first spelling is kept.
- **D14. The library starts closed** on every width. The toolbar's "Library" button opens it. This leaves the canvas width, the perf runs and the existing visual baselines as they are.

## Global Constraints

- Feature folders expose only `index.ts`. `chip-library` may import only `~/features/projects`, `~/features/circuit-editor`, `~/shared/**` and `~/i18n/**`. The import graph has no cycles (ADR 23).
- No `throw` in `domain/`; return `Result` (ADR 28). Zod is used only at the file boundary (ADR 27).
- Only `src/shared/ui` imports `react-aria-components` or `react-aria` (ADR 26).
- Every user-facing string goes through Paraglide in both `messages/en.json` and `messages/es.json` (ADR 17).
- Lint limits: ≤ 300 lines per file, ≤ 50 lines per function, ≤ 3 parameters, complexity ≤ 10, ≤ 10 imports per file. `interaction-commands.ts` (292 lines) and `gestures.ts` take no new logic; put it in new files.
- Every `domain/**` file needs ≥ 95 % branch coverage.
- Touch targets are ≥ 24 px. Axe passes in every theme with every new panel, sheet, menu and dialog open.
- `pnpm e2e:perf` p95 stays ≤ 20 ms, with the panels closed.
- Visual baselines are regenerated only with `pnpm e2e:visual:docker --update-snapshots=all`. Never commit macOS baselines.
- Commit messages follow Conventional Commits (commitlint) and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Don't bypass hooks.
- The format change is additive: `Folder.parentId?` and `Chip.starred` (default `false`). There is no version bump and no migrator (ADR 33).

## Review Focus

1. **A folder dropped onto itself or onto one of its own subfolders**, by drag or by "Move to…", is refused, and nothing moves. Pinned by Task 3 (`moveFolder` tests) and Task 10 (no-drop ghost, e2e).
2. **A chip whose `folderId` names a missing folder**, from an old or hand-edited file, appears at the top level of the tree and in search. It is never hidden. Pinned by Task 5.
3. **Case and diacritics in Spanish names:** "SUMADOR", "sumador" and "Sumadór" all find "Sumador". Pinned by Task 6.
4. **Deleting the open chip, or the last chip:** the open chip's deletion opens another chip, and deleting the last chip is refused with a reason. Pinned by Task 4.
5. **Long names on a 320 px phone:** rows truncate with an ellipsis, the page never scrolls sideways, and the "⋯" button stays reachable. Pinned by Task 8 (CSS) and Task 12 (e2e width check).

---

## File Structure

```text
src/features/projects/domain/
  model.ts            # + Folder.parentId?, Chip.starred (default false), folder refine
  folder-issues.ts    # NEW structural check: parent exists, no cycles, unique ids
  folders.ts          # NEW folderPath, isWithin, create/rename/move/deleteFolder
  chip-catalog.ts     # NEW fileChip, setStarred, setTags, deleteChip
src/features/circuit-editor/
  domain/actions.ts   # + 8 library actions, createChip.folderId?
  domain/library-edits.ts      # NEW handlers wrapping projects' folder/catalog functions
  domain/placement.ts          # NEW placementPosition, pinPlacement
  domain/interaction-place.ts  # NEW arm/cancel/placeAt/addPinAt/tap-while-placing
  application/library-bridge.ts # NEW the contract chip-library uses
  ui/PlacingBanner.tsx         # NEW "Placing NAND · Done"
src/features/chip-library/      # NEW feature
  index.ts
  domain/drag-intent.ts         # long-press / threshold state machine
  domain/library-tree.ts        # tree view model
  domain/library-search.ts      # tiers, filters, ancestors
  domain/tree-expansion.ts      # expanded-key helpers
  ui/use-library.tsx            # { toggle, panel, quickAdd }
  ui/LibraryPanel.tsx, LibraryTree.tsx, LibraryRow.tsx, LibrarySearch.tsx
  ui/LibraryDialogs.tsx, MoveToDialog.tsx, use-row-drag.ts, DragGhost.tsx, QuickAdd.tsx
src/shared/ui/
  TreeView.tsx, SearchField.tsx, FilterChip.tsx, use-interaction-modality.ts
  Sheet.tsx           # + isTucked
```

---

### Task 1: Drag spike: long-press drag out of a bottom sheet (judgement)

**Goal:** before any UI depends on it, prove that the D1 drag works in the riskiest setting: a row inside the phone bottom sheet's scrolling list, dragged out onto the canvas. Commit the real drag-intent machine and the `Sheet` tuck. The test page is thrown away.

**Files:**
- Create: `src/features/chip-library/domain/drag-intent.ts` and `drag-intent.test.ts`
- Create: `src/features/chip-library/index.ts`, empty for now (`export {};`) so the feature exists
- Modify: `src/shared/ui/Sheet.tsx` and `Sheet.module.css`, adding `isTucked`
- Throwaway, never committed: `src/routes/spike-drag.tsx` and `e2e/spike-drag.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export const LONG_PRESS_MS = 400;
  export const TOUCH_SLOP = 8;      // px a still finger may wander before the long-press is lost
  export const MOUSE_THRESHOLD = 4; // px a mouse must move to start a drag
  export type DragIntent =
    | { readonly phase: "idle" }
    | { readonly phase: "pressing"; readonly pointer: "mouse" | "touch" | "pen"; readonly origin: Point; readonly since: number }
    | { readonly phase: "held"; readonly origin: Point }   // long-press reached, finger still: menu on release
    | { readonly phase: "dragging"; readonly point: Point }
    | { readonly phase: "scrolling" };                     // touch moved before the long-press: the list scrolls
  export type IntentEvent =
    | { readonly type: "down"; readonly pointer: "mouse" | "touch" | "pen"; readonly point: Point; readonly at: number }
    | { readonly type: "move"; readonly point: Point; readonly at: number }
    | { readonly type: "tick"; readonly at: number }
    | { readonly type: "up" | "cancel" };
  export type IntentOutcome = "none" | "menu" | "drop" | "tap";
  export const stepIntent = (intent: DragIntent, event: IntentEvent): { readonly intent: DragIntent; readonly outcome: IntentOutcome };
  ```
- `Sheet` gets `readonly isTucked?: boolean`. While it's true, the overlay and the sheet are `visibility: hidden; pointer-events: none`. They stay mounted, so pointer capture and the drag survive.

- [ ] **Step 1: Write the failing tests** in `drag-intent.test.ts`:
  - `mouse moves 4px → dragging`: down(mouse, {0,0}, 0), move({3,0}) stays `pressing`; move({4,0}) gives `dragging`.
  - `touch moves 9px before 400ms → scrolling`: down(touch), move({0,9}, 100) gives `scrolling`, and up gives outcome `"none"`.
  - `touch held 400ms then released still → menu`: tick(400) gives `held`, and up gives `"menu"`.
  - `touch held then moved → dragging; up → drop`: tick(400), then move({0,30}) gives `dragging`, and up gives `"drop"`.
  - `quick touch release → tap`: down, then up at 100 ms, gives `"tap"`.
  - `cancel anywhere → idle, none`.
- [ ] **Step 2:** Run `pnpm vitest run src/features/chip-library/domain/drag-intent.test.ts`. Expect FAIL, because the module doesn't exist.
- [ ] **Step 3:** Implement `stepIntent` as a pure reducer. Then add `isTucked` to `Sheet`.
- [ ] **Step 4:** Run the test again. Expect PASS, with 100 % branches.
- [ ] **Step 5: Spike (throwaway).**
  - Build `src/routes/spike-drag.tsx`: a canvas-sized `div` and a `Sheet`, open, holding 40 rows in a scrolling list.
  - A minimal hook drives `stepIntent`:
    - `pointerdown` on a row;
    - `pointermove` and `pointerup` on `window`;
    - a `setInterval` tick while the drag is `pressing`;
    - a non-passive `touchmove` listener on the row that calls `preventDefault()` only while `held` or `dragging`;
    - the row has `touch-action: pan-y`.
  - When the drag starts, set `isTucked`. On drop, report `document.elementFromPoint` and the client point.
  - Write `e2e/spike-drag.spec.ts` for mobile-chrome (the CDP `touch` helper in `e2e/support.ts`), mobile-safari and chromium (mouse). Assert that:
    - (a) a long-press then a drag from row 30, after scrolling the list, drops on the canvas `div` at the release point, ±2 px;
    - (b) a quick vertical swipe scrolls the list and starts no drag;
    - (c) a long-press held still reports `menu`;
    - (d) a mouse drag drops on the canvas.
  - Run `pnpm dev` and point Playwright at it, e.g. `PLAYWRIGHT_BASE_URL=http://localhost:5173 pnpm playwright test e2e/spike-drag.spec.ts --project=mobile-chrome --project=mobile-safari --project=chromium`.
- [ ] **Step 6: Record the outcome.**
  - Knip counts test files as entries, so `drag-intent.ts` used only by its test passes. If knip still flags it, add a `knip.json` ignore that names Task 10 as the place it gets removed.
  - Write a short section, "Drag spike result", at the end of this plan file, covering each of (a)–(d) per browser.
  - **If (a) or (b) fails on a touch browser, the fallback is a grip handle on every row.** The handle is ≥ 24 px, uses `touch-action: none`, and starts a drag with no long-press; the rest of the row only scrolls. Record which one wins. Task 10 builds whichever won.
  - If WebKit's touch emulation can't run the CDP helper, say so and rely on mobile-chrome plus a manual note.
  - Delete the spike route and spec. Run `pnpm check`, then commit:
  ```bash
  git add src/features/chip-library src/shared/ui/Sheet.tsx src/shared/ui/Sheet.module.css docs/superpowers/plans/2026-11-02-editor-phase-4b-library.md
  git commit -m "feat(chip-library): drag intent machine and tuckable sheet, from the drag spike"
  ```

### Task 2: Nested folders and stars in the file format (mechanical)

**Files:**
- Modify: `src/features/projects/domain/model.ts` (`FolderSchema`, `ChipSchema`, `ProjectSchema.superRefine`)
- Create: `src/features/projects/domain/folder-issues.ts` and `folder-issues.test.ts`
- Modify: `src/features/projects/domain/builders.ts` (`newChip` sets `starred: false`)
- Modify: `src/shared/ids.ts` — add `newFolderId(): FolderId` beside `newChipId` (later tasks' tests and Task 9 use it)
- Modify: `src/features/circuit-editor/domain/chip-edits.ts` (`createChip` sets `starred: false`)
- Test: `src/features/projects/domain/format.test.ts`
- Modify fixtures: `e2e/fixtures/*.json` only where a test asserts the exact shape, plus any `*.fixtures.ts` that builds a `Chip` literal

**Interfaces:**
- Produces:
  - `Folder = { id: FolderId; name: string; parentId?: FolderId }`
  - `Chip` gains `starred: boolean`. It is `z.boolean().default(false)`, so the input may omit it and the output always has it.
  - ```ts
    export const folderIssues = (folders: readonly { readonly id: string; readonly parentId?: string }[]):
      readonly { readonly path: readonly (string | number)[]; readonly message: string }[];
    ```
    It reports duplicate folder ids ("folder ids must be unique"), a parent that names no folder ("folder parent names no folder") and a cycle ("folder parents form a cycle"), each at `["folders", index]`.

- [ ] **Step 1: Write the failing tests:**
  - In `folder-issues.test.ts`:
    - flat folders give `[]`;
    - nesting three deep gives `[]`;
    - a missing parent gives one issue at `["folders", 1]`;
    - a self-parent gives a cycle;
    - A→B→A gives a cycle issue on both;
    - duplicate ids give an issue.
  - In `format.test.ts`:
    - `a stored project without parentId or starred parses`: build JSON for the current version with `folders: [{id, name}]` and a chip without `starred`. Expect `ok`, `chip.starred === false` and `folder.parentId === undefined`.
    - `a file whose folder parent is missing is rejected`: expect `parseProjectFile` to give `err` with the message.
- [ ] **Step 2:** Run `pnpm vitest run src/features/projects`. Expect FAIL.
- [ ] **Step 3:** Implement `folderIssues` and call it from `ProjectSchema.superRefine`, the same way `pinPieceIssues` is called. Add the schema fields, then the `starred: false` defaults in `newChip` and `createChip`.
- [ ] **Step 4:** Run `pnpm vitest run` and then `pnpm typecheck`. Expect PASS. Fix every `Chip` literal the typecheck flags by adding `starred: false`.
- [ ] **Step 5: Commit:** `feat(projects): nested folders and starred chips in the project format`.

### Task 3: Folder tree and chip filing domain (judgement)

**Files:**
- Create: `src/features/projects/domain/folders.ts`, `folders.test.ts`, `chip-catalog.ts` and `chip-catalog.test.ts`
- Modify: `src/features/projects/index.ts`, exporting the new functions and types

**Interfaces:**
- Consumes: `Folder` and `Chip.starred` from Task 2, and `chipsUsing`, `findChip` and `replaceChip`.
- Produces:
  ```ts
  export type FolderError =
    | { readonly type: "FolderNotFound"; readonly folderId: FolderId }
    | { readonly type: "DuplicateFolder"; readonly folderId: FolderId }
    | { readonly type: "FolderIntoItself"; readonly folderId: FolderId }
    | { readonly type: "EmptyName" };
  export type CatalogError =
    | { readonly type: "ChipNotFound"; readonly chipId: ChipId }
    | { readonly type: "FolderNotFound"; readonly folderId: FolderId }
    | { readonly type: "ChipInUse"; readonly chipId: ChipId; readonly usedByName: string }
    | { readonly type: "LastChip" };
  // folders.ts
  export const folderPath: (project: Project, folderId: FolderId | undefined) => readonly Folder[]; // root first; [] for top level or an unknown id
  export const isWithin: (project: Project, folderId: FolderId, ancestorId: FolderId) => boolean;   // true when equal or a descendant
  export const createFolder: (project: Project, folder: { readonly id: FolderId; readonly name: string; readonly parentId?: FolderId }) => Result<Project, FolderError>;
  export const renameFolder: (project: Project, folderId: FolderId, name: string) => Result<Project, FolderError>;
  export const moveFolder: (project: Project, folderId: FolderId, parentId: FolderId | undefined) => Result<Project, FolderError>;
  export const deleteFolder: (project: Project, folderId: FolderId) => Result<Project, FolderError>;
  // chip-catalog.ts
  export const normalizeTags: (tags: readonly string[]) => readonly string[];
  export const fileChip: (project: Project, chipId: ChipId, folderId: FolderId | undefined) => Result<Project, CatalogError>;
  export const setStarred: (project: Project, chipId: ChipId, starred: boolean) => Result<Project, CatalogError>;
  export const setTags: (project: Project, chipId: ChipId, tags: readonly string[]) => Result<Project, CatalogError>;
  export const deleteChip: (project: Project, chipId: ChipId) => Result<Project, CatalogError>;
  ```

- [ ] **Step 1: Write the failing tests.** Build fixtures with `projectWith` plus a `folders` array: Arithmetic, Arithmetic › Adders, Logic.
  - `folderPath(adders)` gives `[Arithmetic, Adders]`, and a missing id gives `[]`.
  - `isWithin(adders, arithmetic)` is true, `isWithin(arithmetic, adders)` is false and `isWithin(x, x)` is true.
  - `createFolder`:
    - a name of only spaces gives `EmptyName`;
    - an existing id gives `DuplicateFolder`;
    - an unknown parent gives `FolderNotFound`;
    - otherwise the folder is appended with its name trimmed.
  - `moveFolder(arithmetic, adders)` gives `FolderIntoItself` and leaves the project the same object. `moveFolder(arithmetic, arithmetic)` also gives `FolderIntoItself`. `moveFolder(adders, undefined)` clears `parentId`.
  - `deleteFolder(arithmetic)`:
    - Adders' `parentId` becomes `undefined`, Arithmetic's own parent;
    - chips filed in Arithmetic get `folderId` `undefined`;
    - chips in Adders keep `adders`;
    - no chip is removed (`chips.length` doesn't change).
  - `deleteFolder` of a nested folder moves its contents to that folder's parent.
  - `normalizeTags([" gate ", "", "Gate", "adder"])` gives `["gate", "adder"]`.
  - `fileChip` to an unknown folder gives `FolderNotFound`, and `fileChip(chip, undefined)` drops `folderId`.
  - `deleteChip`:
    - for a chip placed by "Full adder", in its saved version or its draft, gives `{ type: "ChipInUse", usedByName: "Full adder" }`;
    - for a single-chip project gives `LastChip`;
    - otherwise removes the chip.
- [ ] **Step 2:** Run `pnpm vitest run src/features/projects/domain/folders.test.ts src/features/projects/domain/chip-catalog.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement both files.
  - `isWithin` walks the parents with a visited set, so a corrupt cycle still ends.
  - `folderPath` stops when it sees an id twice.
  - The name of the first parent chip in project order fills `usedByName`.
- [ ] **Step 4:** Run the tests and then `pnpm test`. Expect PASS, with every branch of both files at ≥ 95 %.
- [ ] **Step 5: Commit:** `feat(projects): nested folder moves, chip filing, stars, tags and delete`.

### Task 4: Library actions in the editor (judgement)

**Files:**
- Modify: `src/features/circuit-editor/domain/actions.ts`, `reducer.ts` and `editor-error-messages.ts`
- Create: `src/features/circuit-editor/domain/library-edits.ts` and `library-edits.test.ts`
- Modify: `src/features/circuit-editor/domain/chip-edits.ts` (`createChip` takes `folderId`)
- Modify: `src/features/circuit-editor/application/editor-store.ts`, with tests in `editor-store-chips.test.ts`
- Modify: `messages/en.json` and `messages/es.json`

**Interfaces:**
- Consumes: Task 3's functions and error unions.
- Produces these `EditorAction` members:
  ```ts
  | { readonly type: "createFolder"; readonly folderId: FolderId; readonly name: string; readonly parentId?: FolderId }
  | { readonly type: "renameFolder"; readonly folderId: FolderId; readonly name: string }
  | { readonly type: "moveFolder"; readonly folderId: FolderId; readonly parentId?: FolderId }
  | { readonly type: "deleteFolder"; readonly folderId: FolderId }
  | { readonly type: "fileChip"; readonly chipId: ChipId; readonly folderId?: FolderId }
  | { readonly type: "starChip"; readonly chipId: ChipId; readonly starred: boolean }
  | { readonly type: "tagChip"; readonly chipId: ChipId; readonly tags: readonly string[] }
  | { readonly type: "deleteChip"; readonly chipId: ChipId }
  ```
  - `createChip` gains `readonly folderId?: FolderId`.
  - `EditorError` gains `FolderError | CatalogError`. Their shared members, `ChipNotFound` and `EmptyName`, keep their existing shapes.
  - In these actions, `chipId` is the chip being changed, the same way `renameChip` uses it.
- Message keys, each in en and es:

  | Key | en |
  |---|---|
  | `editor_error_folder_not_found` | "That folder no longer exists." |
  | `editor_error_folder_into_itself` | "A folder can't go inside itself." |
  | `editor_error_duplicate_folder` | "That folder already exists." |
  | `editor_error_chip_in_use({name})` | "Used in {name}" |
  | `editor_error_last_chip` | "A project needs at least one chip." |

- [ ] **Step 1: Write the failing tests:**
  - In `library-edits.test.ts`, one test for each action through `applyAction`: the success case, and its error mapped through.
  - `createChip` with `folderId` files the new chip.
  - In `editor-store-chips.test.ts`:
    - `createFolder` then `undo` removes the folder (D3).
    - `deleteChip` of a chip that isn't open leaves `history.past` empty after the dispatch, and `undo` changes nothing (D3).
    - `deleteChip` of the open chip sets `state.chipId` to the first remaining chip (D4).
    - `deleteChip` of the last chip sets `lastError` to `LastChip`.
    - `editorStoreErrorMessage({ type: "ChipInUse", chipId, usedByName: "Full adder" })` returns "Used in Full adder".
- [ ] **Step 2:** Run `pnpm vitest run src/features/circuit-editor`. Expect FAIL.
- [ ] **Step 3:** Implement:
  - The handlers go in `library-edits.ts`, using the `Edit<Type>` style from `chip-edits.ts`, and are registered in `HANDLERS`.
  - In `editor-store.ts`'s `nextHistory`, `deleteChip` returns `createHistory(project)`.
  - In `dispatch`, after a successful `deleteChip` of `state.chipId`, set `chipId` to `project.chips[0].id` and call `touch()`.
  - Add the messages.
- [ ] **Step 4:** Run `pnpm vitest run` and then `pnpm typecheck`. Expect PASS.
- [ ] **Step 5: Commit:** `feat(circuit-editor): library actions for folders, filing, stars, tags and chip delete`.

### Task 5: Library tree view model (judgement)

**Files:**
- Create: `src/features/chip-library/domain/library-tree.ts`, `library-tree.test.ts`, `tree-expansion.ts` and `tree-expansion.test.ts`

**Interfaces:**
- Consumes: from `~/features/projects`, `Project`, `canPlace`, `PlaceError`, `folderPath` and `FolderId`. From `~/features/circuit-editor`, `partName` and `PlaceableKind` (exported in Task 7; until then, declare `PlaceableKind` locally as `Exclude<InstanceKind, { type: "pin" }>`, and Task 7 replaces it).
- Produces:
  ```ts
  export const BUILTIN_KEY = "builtin";
  export const ROOT_KEY = "root";      // the "Top level" drop zone (Task 10)
  export type LibraryNode =
    | { readonly type: "builtins"; readonly key: typeof BUILTIN_KEY; readonly children: readonly LibraryNode[] }
    | { readonly type: "part"; readonly key: string; readonly kind: PlaceableKind; readonly name: string }
    | { readonly type: "folder"; readonly key: string; readonly folderId: FolderId; readonly name: string;
        readonly path: readonly string[]; readonly children: readonly LibraryNode[] }
    | { readonly type: "chip"; readonly key: string; readonly chipId: ChipId; readonly name: string;
        readonly color: string; readonly starred: boolean; readonly tags: readonly string[];
        readonly path: readonly string[]; readonly draftOnly: boolean;
        readonly placeable: Result<void, PlaceError> };
  export const libraryTree: (project: Project, openChipId: ChipId) => readonly LibraryNode[];
  export const keyOf: { readonly folder: (id: FolderId) => string; readonly chip: (id: ChipId) => string };
  // tree-expansion.ts
  export const toggleKey: (expanded: ReadonlySet<string>, key: string) => ReadonlySet<string>;
  export const prunedKeys: (expanded: ReadonlySet<string>, nodes: readonly LibraryNode[]) => ReadonlySet<string>; // drops keys of folders that no longer exist
  ```
  - Keys: `folder:<id>`, `chip:<id>`, `builtin:nand`, and `builtin:split-4` up to `builtin:merge-16`.
  - `path` holds the folder names from the root down to the item's own folder. A folder's `path` includes its own name.

- [ ] **Step 1: Write the failing tests:**
  - The built-ins come first and their keys are in D7's order.
  - Under each parent, subfolders come before chips, and both are sorted with `localeCompare(…, undefined, { sensitivity: "base", numeric: true })`. For example "Adder 2" sorts before "Adder 10".
  - Nesting: Arithmetic › Adders › "Half adder" has `path` `["Arithmetic", "Adders"]`.
  - **Review Focus 2:** a chip whose `folderId` names a missing folder is at the top level.
  - A chip with no `saved` has `draftOnly: true` and `placeable` = err `ChipNotSaved`.
  - The open chip has `placeable` = err `WouldContainItself`.
  - A chip that places the open chip also has err `WouldContainItself`.
  - The open chip is still listed.
  - `prunedKeys` drops `folder:<deleted>` and keeps `builtin`.
- [ ] **Step 2:** Run `pnpm vitest run src/features/chip-library`. Expect FAIL.
- [ ] **Step 3:** Implement. Build a map from parent to children once, so building the tree is O(n log n).
- [ ] **Step 4:** Run the tests. Expect PASS, at ≥ 95 % branches.
- [ ] **Step 5: Commit:** `feat(chip-library): library tree view model with built-ins and placeability`.

### Task 6: Library search and filters (judgement)

**Files:**
- Create: `src/features/chip-library/domain/library-search.ts` and `library-search.test.ts`

**Interfaces:**
- Consumes: `LibraryNode` from Task 5.
- Produces:
  ```ts
  export type Tier = 0 | 1 | 2 | 3;   // path, name, tag, colour (D8)
  export interface LibraryFilter { readonly query: string; readonly starred: boolean; readonly tags: ReadonlySet<string> }
  export interface Match { readonly node: Extract<LibraryNode, { type: "chip" | "part" }>; readonly tier: Tier }
  export const normalize: (text: string) => string;            // NFD, strip combining marks, lower-case, trim
  export const rankMatches: (nodes: readonly LibraryNode[], filter: LibraryFilter, colorName: (hex: string) => string | undefined) => readonly Match[];
  export const filteredTree: (nodes: readonly LibraryNode[], matches: readonly Match[]) => { readonly nodes: readonly LibraryNode[]; readonly expanded: ReadonlySet<string> };
  export const isFiltering: (filter: LibraryFilter) => boolean;
  export const allTags: (nodes: readonly LibraryNode[]) => readonly string[];   // distinct, sorted
  ```
  - Parts match on name only (tier 1), and the `starred` and tag filters exclude them.
  - With an empty query, every chip that passes the filters matches at tier 1.
  - `filteredTree` keeps only the matches and the folders that lead to them, puts every kept folder's key in `expanded`, and orders siblings by their best tier, then by name.

- [ ] **Step 1: Write the failing tests:**
  - The query "adders" matches every chip under Arithmetic › Adders at tier 0, and `expanded` includes `folder:<arithmetic>` and `folder:<adders>`.
  - The query "half" matches "Half adder" at tier 1. A chip tagged "half" in another folder matches at tier 2 and ranks after it.
  - The query "red" with `colorName = (hex) => hex === "#ef4444" ? "Red" : undefined` matches a red chip at tier 3.
  - A chip that matches by path and by name ranks at tier 0.
  - **Review Focus 3:** "SUMADOR", "sumador" and "sumadór" all find "Sumador".
  - The `starred` filter drops unstarred chips and every part.
  - The tags filter `{gate, adder}` keeps only chips that have both tags.
  - An empty query with no filters gives `isFiltering` false.
- [ ] **Step 2:** Run the test. Expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the test. Expect PASS, at ≥ 95 %.
- [ ] **Step 5: Commit:** `feat(chip-library): ranked library search with star and tag filters`.

### Task 7: Placing chips in the editor (judgement)

**Files:**
- Create: `src/features/circuit-editor/domain/placement.ts`, `placement.test.ts`, `interaction-place.ts` and `interaction-place.test.ts`
- Modify: `domain/interaction.ts` (state, commands, announcement), `interaction-commands.ts` (one delegating line per new command only), `interaction-tap.ts` (the placing tap runs first) and `interaction-wiring.ts` (arming a pin clears `placing`)
- Modify: `domain/announcements.ts`, `application/editor-session.ts` (`ViewportBox`, `clientToCanvas`), `ui/use-canvas.ts`, `ui/CanvasOverlays.tsx`, `ui/WireMenus.tsx` (`CanvasMenuOverlay` uses the slot) and `ui/CircuitCanvas.tsx` (the `canvasMenu` prop)
- Create: `ui/PlacingBanner.tsx` and `application/library-bridge.ts`
- Modify: `src/features/circuit-editor/index.ts`, `messages/en.json` and `messages/es.json`

**Interfaces:**
- Produces in the domain:
  ```ts
  export type PlaceableKind = PlaceableInstance["kind"];   // actions.ts
  // placement.ts
  export const placementPosition: (scene: Scene, kind: PlaceableKind, world: Point) => Point; // centred on `world`, snapped with move.ts `snap`
  export const pinAt: (circuit: Circuit, direction: PinDirection, world: Point) => { readonly pin: PinDef; readonly instanceId: InstanceId; readonly position: Point }; // name from nextPinNames, width 1
  // interaction.ts
  InteractionState.placing?: PlaceableKind;
  InteractionState.recent: readonly PlaceableKind[];       // newest first, max RECENT_LIMIT = 5, no duplicates; initialInteraction sets []
  InteractionCommand +=
    | { readonly type: "armPlacement"; readonly kind: PlaceableKind }   // same kind again → cancel
    | { readonly type: "cancelPlacement" }
    | { readonly type: "placeAt"; readonly kind: PlaceableKind; readonly screen?: Point } // no screen → viewport centre
    | { readonly type: "addPinAt"; readonly direction: PinDirection; readonly screen: Point };
  Announcement += { readonly type: "placing"; readonly kind: PlaceableKind | undefined } | { readonly type: "placed"; readonly kind: PlaceableKind };
  ```
  - A tap while `placing` is set places at the tap, wherever it lands, and stays armed (D6).
  - `escape` cancels `placing` before anything else it does.
  - `armPlacement` clears `armed`, and arming a pin clears `placing`.
  - `placeAt` and the placing tap both emit `dispatch placeChip` with `piece(kind, placementPosition(...))`, push `kind` onto `recent`, and announce `placed`.
  - `addPinAt` emits `dispatch addPins` with one `pinAt(...)`.
- Produces for `chip-library`, in `application/library-bridge.ts`, exported from `index.ts`:
  ```ts
  export const armPlacement: (session: EditorSession, kind: PlaceableKind) => void;
  export const cancelPlacement: (session: EditorSession) => void;
  export const placeAtCentre: (session: EditorSession, kind: PlaceableKind) => void;
  export const placeAtClient: (session: EditorSession, kind: PlaceableKind, client: Point) => boolean; // false when `client` is not over the canvas
  export const usePlacing: (session: EditorSession) => PlaceableKind | undefined;
  export const useRecentPlacements: (session: EditorSession) => readonly PlaceableKind[];
  export interface CanvasMenuContext {
    readonly screen: Point;
    readonly close: () => void;
    readonly tidyWires: () => void;
    readonly place: (kind: PlaceableKind) => void;            // at the menu's point
    readonly addPin: (direction: PinDirection) => void;       // at the menu's point
  }
  ```
  - The index also exports `PlaceableKind`, `RenameChipDialog`, `RecolorChipDialog`, `DialogForm`, `DialogActions` and the swatch list as `chipSwatches()`. The last is renamed from `swatches`, and `ChipDialogs.tsx` exports it.
  - `CircuitCanvas` gains `readonly canvasMenu?: (context: CanvasMenuContext) => ReactNode`. When it's given, the canvas menu renders the slot instead of the default "Tidy wires" `PointMenu`.
  - `EditorSession.attachViewport(read: () => ViewportBox)`, where `ViewportBox = Size & { readonly left: number; readonly top: number }`, read from the canvas element's `getBoundingClientRect()`.
  - `EditorSession.clientToCanvas(client: Point): Point | undefined` turns a client point into canvas-local screen pixels, or gives `undefined` when the point is outside the canvas.
- Messages:

  | Key | en |
  |---|---|
  | `placing_banner({name})` | "Tap the canvas to place {name}" |
  | `placing_done` | "Done" |
  | `announce_placing({name})` | "Placing {name}. Tap or press Escape to stop." |
  | `announce_placing_stopped` | "Stopped placing." |
  | `announce_placed({name})` | "Placed {name}." |

- [ ] **Step 1: Write the failing tests:**
  - **In `placement.test.ts`:**
    - `placementPosition` puts a NAND's centre at the grid point nearest the world point.
    - `pinAt(circuit with A, "input", p)` names the new pin "B".
  - **In `interaction-place.test.ts`, using `interaction.fixtures.ts`:**
    - `armPlacement(nand)` sets `placing`, clears `armed` and announces placing.
    - Arming the same kind again cancels.
    - A tap at screen (200,120) while placing a NAND gives one `dispatch` effect, a `placeChip` whose position equals `placementPosition(scene, nand, screenToWorld(camera, (200,120)))`. `placing` is still set and `recent[0]` is the NAND.
    - `placeAt` with no screen places at the viewport centre.
    - Escape while placing clears only `placing`, and the selection survives.
    - A tap on a pin while placing still places (D6).
    - Arming a pin, via the `arm` command with a focused chip, clears `placing`.
    - `recent` keeps 5 kinds, newest first, with no duplicates.
    - `addPinAt("output", p)` dispatches `addPins` with one output.
  - **In `editor-session` tests:** `clientToCanvas` subtracts `left` and `top`, and gives `undefined` outside the box.
- [ ] **Step 2:** Run `pnpm vitest run src/features/circuit-editor`. Expect FAIL.
- [ ] **Step 3: Implement.**
  - Put the logic in `interaction-place.ts`. `interaction-commands.ts` gets one `case` per command that delegates to it.
  - `PlacingBanner` is a status overlay above the canvas with the text and a "Done" button, which calls `cancelPlacement`.
  - The `canvasMenu` slot is threaded through `CanvasOverlays` to `CanvasMenuOverlay`.
- [ ] **Step 4:** Run `pnpm vitest run` and `pnpm typecheck`. Then run `pnpm e2e --project=chromium e2e/canvas-pointer.spec.ts e2e/canvas-wiring.spec.ts`, which must still pass.
- [ ] **Step 5: Commit:** `feat(circuit-editor): armed placement, place-at-point and the canvas menu slot`.

### Task 8: Library panel, tree and search UI (judgement)

**Files:**
- Create: `src/shared/ui/TreeView.tsx` and `TreeView.module.css`, wrapping RAC `Tree`, `TreeItem` and `TreeItemContent`
- Create: `src/shared/ui/SearchField.tsx` (wrapping RAC `SearchField`), `FilterChip.tsx` (wrapping RAC `ToggleButton`) and `use-interaction-modality.ts` (re-exporting `useInteractionModality` from `react-aria`)
- Modify: `src/shared/ui/index.ts`
- Create: `src/features/chip-library/ui/use-library.tsx`, `LibraryPanel.tsx` with `LibraryPanel.module.css`, `LibraryTree.tsx`, `LibraryRow.tsx` with `LibraryRow.module.css`, and `LibrarySearch.tsx`
- Modify: `src/features/chip-library/index.ts`, exporting `useLibrary`
- Modify: `src/features/circuit-editor/ui/EditorLayout.tsx` and `.module.css`, adding a `library` slot
- Modify: `src/routes/projects.$projectId.tsx`
- Modify: `messages/en.json` and `messages/es.json`

**Interfaces:**
- Consumes: Tasks 5 and 6, plus the bridge from Task 7.
- Produces:
  ```ts
  // shared/ui/TreeView.tsx
  export interface TreeNode { readonly key: string; readonly textValue: string; readonly children?: readonly TreeNode[] }
  export function TreeView<Node extends TreeNode>(props: {
    readonly label: string; readonly items: readonly Node[];
    readonly expandedKeys: ReadonlySet<string>; readonly onExpandedChange: (keys: ReadonlySet<string>) => void;
    readonly onAction: (node: Node) => void;
    readonly renderRow: (node: Node) => ReactNode;
    readonly disabledKeys?: ReadonlySet<string>;
  }): ReactNode;
  // chip-library/ui/use-library.tsx
  export const useLibrary: (session: EditorSession) => {
    readonly toggle: ReactNode;                                      // toolbar button "Library", aria-expanded
    readonly panel: ReactNode;                                       // EditorLayout's `library` slot
    readonly quickAdd: (context: CanvasMenuContext) => ReactNode;    // Task 11 fills it; until then renders undefined
  };
  ```
  - `EditorLayout` gets `readonly library?: ReactNode`. On wide screens the grid is `"library canvas panel"`, and the library column is `auto`, so it is 0 wide when nothing renders. On phones the library renders its own `Sheet` and takes no grid area.

**Behaviour:**
- The panel is closed by default (D14). The toggle opens it: as the left column at ≥ 640 px, as a `Sheet` below that.
- At the top: a `SearchField` labelled "Search chips", then the filter chips: ★ "Starred", then one per tag from `allTags`.
- While `isFiltering`, the tree shows `filteredTree` with its `expanded`. Otherwise it shows the user's expanded keys, passed through `prunedKeys`.
- Each row is a colour square, the name, a ★ when starred, and "draft only" when it applies. Built-ins show the part name, and folders show ▸ or ▾.
- A row that isn't placeable is greyed out with `aria-disabled` and shows its reason under the name, through `editorErrorMessage` of the `PlaceError`.
- Each row has a "⋯" `MenuButton`, labelled "Actions for {name}". Task 9 fills its items; this task leaves it out of the DOM until then.
- Long names truncate with an ellipsis (`min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap` on the name). Review Focus 5.
- `onAction`:
  - a folder toggles open or closed;
  - a placeable chip or part, when `useInteractionModality()` is `"keyboard"`, goes to `placeAtCentre`;
  - otherwise it goes to `armPlacement`, and on phones the sheet closes so the canvas can be tapped.
  - An action on the row that is already armed calls `cancelPlacement`.
- The armed row shows `aria-current="true"` and an "Armed" badge.
- The toolbar's `toggle` comes before Undo. The route passes `library.panel` to `EditorLayout`.

**Messages:**

| Key | en |
|---|---|
| `library_button` | "Library" |
| `library_heading` | "Chip library" |
| `library_tree_label` | "Chips" |
| `library_search` | "Search chips" |
| `library_filter_starred` | "Starred" |
| `library_builtin` | "Built-in" |
| `library_draft_only` | "draft only" |
| `library_armed` | "Armed" |
| `library_row_actions({name})` | "Actions for {name}" |
| `library_no_results` | "No chips match." |

- [ ] **Step 1:** Write a failing e2e, `e2e/library-browse.spec.ts`. It uses a new fixture, `e2e/fixtures/library.json`, imported through the existing import helper. The fixture holds:
  - folders Arithmetic › Adders and Logic;
  - a saved "Half adder" in Adders;
  - a saved, starred "XOR" in Logic, tagged `gate`, coloured `#ef4444`;
  - a draft-only "Scratch" at the top level;
  - the open chip "Main".

  Its tests:
  - Open the Library: the first tree row is "Built-in". Expand Arithmetic and then Adders, and "Half adder" is visible.
  - Type "adders": "Half adder" is visible, and Logic isn't.
  - Type "red": "XOR" is visible.
  - Turn on "Starred": only XOR is listed.
  - "Scratch" is greyed out, with the not-saved reason.
  - At 320 × 640, a chip renamed to 60 characters leaves `document.documentElement.scrollWidth <= 320` (Review Focus 5).
- [ ] **Step 2:** Run `pnpm build && pnpm e2e --project=chromium e2e/library-browse.spec.ts`. Expect FAIL.
- [ ] **Step 3:** Implement the shared components, then the panel, then the layout and route wiring, then the messages.
- [ ] **Step 4:** Run the e2e on chromium and mobile-chrome, then `pnpm check`. Expect PASS.
- [ ] **Step 5: Commit:** `feat(chip-library): library panel with folder tree, search and filters`.

### Task 9: Row menus and library dialogs (judgement)

**Files:**
- Create: `src/features/chip-library/ui/LibraryDialogs.tsx`, `MoveToDialog.tsx` and `row-menu.ts`, the pure entries per node type
- Modify: `LibraryRow.tsx`, `LibraryPanel.tsx`, `messages/en.json` and `messages/es.json`

**Interfaces:**
- Consumes:
  - `RenameChipDialog`, `RecolorChipDialog`, `DialogForm`, `DialogActions` and `chipSwatches` from `~/features/circuit-editor`;
  - `ModalDialog`, `Select`, `TextInput` and `MenuButton` from `~/shared/ui`;
  - Task 4's actions, dispatched with `session.editor.getState().dispatch`;
  - `newFolderId()` from `~/shared/ids`, added in Task 2.
- Produces:
  ```ts
  export type RowCommand =
    | "open" | "rename" | "recolor" | "tags" | "star" | "unstar" | "moveTo" | "delete"   // chip
    | "newFolderInside" | "renameFolder" | "moveFolder" | "deleteFolder";                  // folder
  export const rowCommands: (node: LibraryNode) => readonly RowCommand[];  // parts and the builtins folder: []
  ```

**Behaviour:**
- **Menus:**
  - A chip's menu: Open, Rename, Colour, Tags, Star or Unstar, Move to…, Delete.
  - A folder's menu: New folder inside, Rename, Move to…, Delete.
  - Built-ins have no menu.
  - Right-click on a row, or a long-press held still (Task 10 wires the long-press), opens the same menu as "⋯".
- **Open** calls `session.editor.getState().openChip(chipId)` and closes the sheet on phones.
- **Above the tree** are "New chip" and "New folder".
  - The New chip dialog has Name (required), Colour (`chipSwatches`), and Folder (a `Select`, "Top level" plus every folder by its path joined with " › "). Saving dispatches `createChip` with `newChipId()` and the folder, then calls `openChip` (§3.2.4).
- **Tags** is a `TextInput` holding comma-separated tags, which go to `tagChip`.
- **Move to…** is a `Select` with "Top level" and every folder path.
  - For a folder, it leaves out the folder itself and its descendants (`isWithin`).
  - Saving dispatches `fileChip` or `moveFolder`.
- **Delete a chip** opens a `ModalDialog`:
  - text: "Delete {name}? Its saved version and draft are removed. This can't be undone.";
  - buttons: Cancel, and Delete.
  - If the dispatch fails, the dialog shows the translated error ("Used in Full adder") and stays open.
- **Delete a folder** has no confirmation: it is an undo step and nothing is lost.

**Messages**, each with an es twin:

| Key |
|---|
| `library_new_chip`, `library_new_folder`, `library_new_folder_inside` |
| `library_menu_open`, `library_menu_rename`, `library_menu_colour`, `library_menu_tags`, `library_menu_star`, `library_menu_unstar`, `library_menu_move`, `library_menu_delete` |
| `library_folder_label`, `library_top_level`, `library_tags_label`, `library_tags_hint` ("Separate tags with commas") |
| `library_delete_title({name})`, `library_delete_body`, `library_delete_confirm` |
| `library_folder_name`, `library_move_title({name})` |

- [ ] **Step 1: Write the failing tests:**
  - **`row-menu.test.ts`:** a starred chip has `unstar` and not `star`; a part has `[]`.
  - **`e2e/library-organize.spec.ts`, keyboard only on chromium:**
    - New folder "Gates" at the top, then New folder inside Gates, "Two input".
    - Move XOR to `Gates › Two input` through "Move to…", and it is listed under that path.
    - Try to move Gates into `Gates › Two input`: that option isn't offered.
    - Delete Gates: "Two input" moves to the top level, and XOR is still in it.
    - Delete "Half adder" with a parent that uses it: "Used in Full adder" is shown.
    - Delete "Scratch" and confirm: it's gone.
    - New chip "Sumador" in Arithmetic: the editor opens it (the URL's chip changes, and the Pins panel heading is "Pins 0").
- [ ] **Step 2:** Run the tests. Expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `pnpm build && pnpm e2e --project=chromium --project=mobile-chrome e2e/library-organize.spec.ts`, then `pnpm check`. Expect PASS.
- [ ] **Step 5: Commit:** `feat(chip-library): row menus, new chip and folder, move to, tags and delete`.

### Task 10: Drag rows to the canvas and between folders (judgement)

**Files:**
- Create: `src/features/chip-library/ui/use-row-drag.ts`, `DragGhost.tsx` and `DragGhost.module.css`
- Create: `src/features/chip-library/domain/drop-target.ts` and `drop-target.test.ts`
- Modify: `LibraryRow.tsx`, `LibraryTree.tsx` (the "Top level" drop row while a drag is on) and `LibraryPanel.tsx` (`isTucked` while dragging on phones)

**Interfaces:**
- Consumes: `stepIntent` (Task 1), the mechanism the spike recorded, `placeAtClient` (Task 7), and `isWithin`.
- Produces:
  ```ts
  export type DragItem = { readonly type: "chip"; readonly chipId: ChipId; readonly kind?: PlaceableKind } // kind set when placeable
                       | { readonly type: "folder"; readonly folderId: FolderId }
                       | { readonly type: "part"; readonly kind: PlaceableKind };
  export type DropTarget = { readonly type: "canvas" } | { readonly type: "folder"; readonly folderId?: FolderId } | { readonly type: "none" };
  export const dropAction: (project: Project, item: DragItem, target: DropTarget) =>
    | { readonly type: "place"; readonly kind: PlaceableKind }
    | { readonly type: "dispatch"; readonly action: EditorAction }
    | { readonly type: "refuse" };
  ```
  - Folder rows carry `data-drop-folder="<id>"`, and the "Top level" row carries `data-drop-folder=""`.
  - `use-row-drag` resolves the target with `document.elementFromPoint(...).closest("[data-drop-folder]")`, and otherwise checks `session.clientToCanvas`.

**Behaviour:**
- `dropAction` gives `refuse` for:
  - a folder dropped into itself or a descendant;
  - a part dropped on a folder;
  - a chip that can't be placed, dropped on the canvas;
  - a target of `none`.
- While a drag is on, the ghost shows the name and the colour square. It switches to a no-drop style and `aria-hidden` when the current target would be refused.
- A drop on the canvas calls `placeAtClient`. A folder drop dispatches `fileChip` or `moveFolder`.
- On phones the sheet is tucked from the start of the drag (`isTucked`). After a canvas drop it closes; otherwise it comes back.
- An intent outcome of `menu` opens the row's menu (D5), and `tap` goes to the normal `onAction`.
- Mouse drags use `MOUSE_THRESHOLD`.

- [ ] **Step 1: Write the failing tests:**
  - **`drop-target.test.ts`:**
    - a chip on a folder gives `fileChip`;
    - a chip on the top level gives `fileChip` with no folder;
    - Arithmetic on Adders gives `refuse` (Review Focus 1);
    - Adders on the top level gives `moveFolder`;
    - a draft-only chip on the canvas gives `refuse`;
    - NAND on the canvas gives `place`.
  - **`e2e/library-drag.spec.ts`:**
    - chromium, mouse: drag "Half adder" from the tree onto the canvas at (300,200). A new instance's centre lands within one grid cell of that page point, using `worldToPage`.
    - chromium, mouse: drag XOR onto the Arithmetic row, and XOR is under Arithmetic.
    - chromium, mouse: drag Arithmetic onto Adders. Nothing changes, and the ghost had the no-drop class just before the release.
    - mobile-chrome, touch: open the sheet, long-press "NAND" and drag it out onto the canvas. One more NAND is on the canvas and the sheet is closed. If the spike chose the grip fallback, drag from the grip instead.
    - mobile-chrome: a long-press held still on XOR opens its menu.
- [ ] **Step 2:** Run the tests. Expect FAIL.
- [ ] **Step 3:** Implement. Window listeners are added on `down` and removed on `up` or `cancel`. The tick runs on `requestAnimationFrame` while the drag is `pressing`.
- [ ] **Step 4:** Run `pnpm build && pnpm e2e --project=chromium --project=mobile-chrome --project=mobile-safari e2e/library-drag.spec.ts` and `pnpm check`. Expect PASS. If the touch helper can't drive mobile-safari, mark that test `test.skip` with the reason, as the spike recorded it.
- [ ] **Step 5: Commit:** `feat(chip-library): drag chips to the canvas and chips and folders between folders`.

### Task 11: Quick-add menu (judgement)

**Files:**
- Create: `src/features/chip-library/ui/QuickAdd.tsx` and `QuickAdd.module.css`
- Modify: `use-library.tsx` (fill in `quickAdd`), `src/routes/projects.$projectId.tsx` (pass `canvasMenu={library.quickAdd}`), `messages/en.json` and `messages/es.json`
- Create: `src/shared/ui/PointPopover.tsx`, a RAC `Popover` anchored at a screen point, like `PointMenu`, holding a dialog, so it can contain a search field and lists

**Interfaces:**
- Consumes: `CanvasMenuContext`, `useRecentPlacements`, `rankMatches`, `libraryTree` and `partName`.
- Produces: `QuickAdd({ session, context }: { session: EditorSession; context: CanvasMenuContext }): ReactNode`.

**Behaviour:**
- The popover sits at `context.screen`, and the search field has focus.
- With an empty query it lists these sections:
  - Recent (`useRecentPlacements`, by `partName` or the chip name);
  - Starred;
  - Pins: "Add input" and "Add output";
  - Built-in;
  - and at the end, "Tidy wires" (`context.tidyWires`).
- With a query, it lists `rankMatches` as one flat list, top 20.
- Unplaceable chips are left out.
- Picking a chip or part calls `context.place(kind)` and then `close()`. "Add input" calls `context.addPin("input")`.
- Escape closes. The arrow keys move through the list, and Enter picks (RAC `ListBox`). That keeps a mouse-free path.

**Messages:**

| Key | en |
|---|---|
| `quick_add_label` | "Add to canvas" |
| `quick_add_search` | "Search chips" |
| `quick_add_recent` | "Recent" |
| `quick_add_starred` | "Starred" |
| `quick_add_pins` | "Pins" |
| `quick_add_input` | "Add input" |
| `quick_add_output` | "Add output" |
| `quick_add_builtin` | "Built-in" |

The existing `canvas_menu_tidy` is reused.

- [ ] **Step 1: Write the failing test,** `e2e/quick-add.spec.ts`:
  - chromium: right-click empty canvas at the page point for world (400,240). Type "half", press Enter. A "Half adder" instance is centred within one grid cell of (400,240).
  - Right-click again, and the Recent section's first item is "Half adder".
  - Pick "Add output": the Pins panel lists a new output.
  - "Tidy wires" is still listed.
  - mobile-chrome: a long-press on empty canvas opens the quick-add.
- [ ] **Step 2:** Run the test. Expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `pnpm build && pnpm e2e --project=chromium --project=mobile-chrome e2e/quick-add.spec.ts`. Existing specs that open the canvas menu for Tidy (`grep -rl "Tidy" e2e`) must still pass. Then run `pnpm check`.
- [ ] **Step 5: Commit:** `feat(chip-library): quick-add menu at the press point`.

### Task 12: Phone path, accessibility, visuals and docs (judgement)

**Files:**
- Create: `e2e/library-place.spec.ts` and `e2e/library-support.ts`
- Modify: `e2e/a11y.spec.ts` and `e2e/visual.spec.ts`, with new baselines from Docker
- Create: `docs/adr/0046-chip-library-and-placement.md`
- Modify: `GLOSSARY.md` and this plan, adding a Status section

**Tests and docs:**
- **`library-place.spec.ts`:**
  - **Taps only, on mobile-chrome and mobile-safari:** open the Library sheet, search "adders", tap "Half adder" (the sheet closes and the banner says "Tap the canvas to place Half adder"), tap the canvas twice, and two Half adder instances exist. Tap "Done" and the banner is gone. This is the 4b part of spec §1's success path.
  - **chromium, keyboard:** focus the tree, arrow to NAND, press Enter, and one more NAND is centred in the view (within a grid cell). Press Escape with nothing armed and nothing changes.
  - **chromium:** arm XOR, then arm a wire pin on the canvas, and the placing banner is gone (D6).
- **`a11y.spec.ts`:** axe in every theme, with each of these open:
  - the library panel (wide);
  - the library sheet (phone);
  - a row menu;
  - the New chip dialog;
  - the Move to… dialog;
  - the Delete confirmation;
  - the quick-add popover;
  - the placing banner.
- **`visual.spec.ts`:** a new `library-panel` snapshot (desktop, the library open, Arithmetic expanded) and a `quick-add` snapshot. Regenerate with `pnpm e2e:visual:docker --update-snapshots=all`.
- **ADR 46:**
  - D1 to D14, with the spike's result;
  - the dependency direction;
  - the `canvasMenu` slot;
  - that it amends spec §5.4 (nested folders) and the payload wording in §7.1.
- **GLOSSARY:**
  - Armed placement (placing);
  - Built-in folder;
  - Recent;
  - Move to…;
  - an update to **Folder**, which can now be nested.

- [ ] **Step 1:** Write the specs. Run `pnpm build && pnpm e2e`. Expect the new tests to pass and the existing ones to stay green.
- [ ] **Step 2:** Run `pnpm e2e:perf`. Expect p95 ≤ 20 ms in both cases.
- [ ] **Step 3:** Run the visual baselines in Docker, then `pnpm check`. Expect it to exit 0.
- [ ] **Step 4:** Write ADR 46, the GLOSSARY entries, and a Status section in this plan: what shipped, rulings, follow-ups.
- [ ] **Step 5: Commit**, in two commits: `test(e2e): library placement on phones, a11y and visual baselines`, then `docs: record the chip library and placement decisions`.

## Drag spike result

Task 1 ran a throwaway page (a full-screen `div` canvas plus an open `Sheet` holding 40 rows, each `touch-action: pan-y`) driven by `stepIntent`. `pointermove`/`pointerup` listened on `window`, a 50 ms interval ticked while pressing, and a non-passive `touchmove` listener called `preventDefault()` only while `held` or `dragging`. The sheet was tucked (`isTucked`) when the drag started. Touch used real CDP `Input.dispatchTouchEvent` (the synthetic `touch` helper in `e2e/support.ts` can't scroll a list), so it ran on Chromium engines only. The page and spec were deleted afterwards.

| Check | mobile-chrome (Pixel 7, touch) | mobile-safari (iPhone 15) | chromium / webkit (mouse) |
| --- | --- | --- | --- |
| (a) long-press then drag from row 30 (after scrolling), drops on the canvas at the release point ±2 px, list scroll unchanged | pass | not run: no CDP touch in WebKit | n/a |
| (b) quick vertical swipe scrolls the list, no drag | pass | not run | n/a |
| (c) long-press held still reports `menu` | pass | not run | n/a |
| (d) mouse drag drops on the canvas | n/a | n/a | pass on both |

**Winner: long-press** (no grip handle needed), on the evidence of mobile-chrome. iOS Safari is unverified: Playwright's WebKit can't inject real touches, so the behaviour of `preventDefault()` on `touchmove` after a long-press (and whether iOS fires `pointercancel` when it claims the gesture) needs a manual check on a device or the simulator before Task 10 is called done. If iOS cancels the drag, fall back to the grip handle described in the Task 1 brief.

**Finding for Task 10:** while a `Sheet` is open, React Aria marks the rest of the page `inert`. Tucking the sheet hides it but the canvas stays inert, so `document.elementFromPoint` returns `<html>` over the canvas. The drop target must be found by testing the release point against the canvas's `getBoundingClientRect()`, not by `elementFromPoint`. Pointer events on `window` keep arriving, and the drag survives the tuck because the row stays mounted.
