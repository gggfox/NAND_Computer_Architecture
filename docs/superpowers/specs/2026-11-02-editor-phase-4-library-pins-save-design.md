# Editor Phase 4: Pins, library and save flow (design)

**Builds on:** the circuit editor design (`2026-10-29-circuit-editor-design.md`, §5.4 Library, §5.5 Circuit inputs and outputs, §5.6 Saved version and draft, §5.11 calls), ADR 38 (saved version and draft) and ADR 39 (wires reference pin IDs). Those decisions still stand unless this document says otherwise. It adds what the owner decided for Phase 4 on 2026-11-02 and marks the builder's own calls.
**Issue:** #15, including the comment carried over from Phase 3.
**Branch:** `claude/phase-4-library-and-pins`, from `main` at 849d98d (PR #22, Phase 3, merged).

## 1. Intent and why

After Phase 3 you can wire NANDs, but you can't build a reusable chip. No UI places input or output pins, you can't find or place your own chips, and you can't save a chip into the parents that use it. The owner's path is simple gates → latches → half and full adders → an ALU, and each step reuses the one before. Phase 4 is where that reuse starts.

The owner asked for input and output pins on the canvas first. Asked which part would annoy them most if it were clumsy, the owner said all three, and **pins most of all**:
- **repetition:** place, drag, tap and rename each pin, one at a time;
- **keeping pins lined up neatly;**
- **remembering which pin is which** once the chip is used somewhere else.

For the library, the owner recalls a chip by its **folder path first, then its name, then its tags, then its colour**. They want **folders inside folders**, and **dragging chips between folders** matters to them.

For saving, the owner's model is simple: **Save updates the chip everywhere it is used**, and nothing gets in the way unless something breaks.

**Success:** on a phone, using taps only, you can build a half adder with named pins, save it into `Arithmetic › Adders`, open a full adder, find the half adder in the tree, drag it in, wire it and save. Later you can open the half adder from inside the full adder, change it, save, go back, and the full adder already runs the new version.

## 2. Delivery: three PRs, in this order (owner)

Each PR is usable on its own and merges to `main` before the next one starts.

1. **Pins (4a).** Everything in §3.1, plus the two items carried over from Phase 3 (§3.4).
2. **Library (4b).** The drag-and-drop spike first, then everything in §3.2.
3. **Save flow (4c).** Everything in §3.3. It completes issue #15's "Done when".

## 3. Goals

### 3.1 Pins (PR 4a)

1. **Pins panel, on the right (owner).**
   - On desktop it is a side panel on the **right**. On phones it is a bottom sheet. A header button "Pins N" opens it (spec §5.5).
   - It has two sections, Inputs and Outputs. Each row has a drag handle, an order badge (① ②), the name, and the bit width (1/4/8/16).
   - Dragging a row reorders the pins. **The panel order is the pin order of the saved chip**, as spec §5.5 says.
   - Selecting a row highlights its pin on the canvas, and selecting a pin on the canvas highlights its row.
   - Every row action also works from the keyboard. React Aria's GridList or ListBox reordering, behind `src/shared/ui`, is the likely base.
2. **Adding several pins at once, and naming them like a list (owner, option C).**
   - Each section has "Add inputs…" / "Add outputs…" with a count, so several pins are added in one step, and that step is one undo step.
   - New pins are auto-named `A, B, C…` / `OUT1, OUT2…`. The names skip any already in use.
   - New pins land on the canvas **already lined up**: below the existing column of that kind, or in a fresh column if there is none (see Tidy).
   - Typing names works like a list. The name field is focused, and **Enter saves the name and moves to the next row**, so naming four pins is type, Enter, type, Enter. Escape stops editing and keeps what was already saved.
   - Renaming in place on the canvas, by tapping a pin's label, still works (spec §5.5).
3. **Free placement with snapping and Tidy (owner, option A).**
   - Pins can be placed and dragged anywhere on the canvas, as spec §5.5 says. The owner **rejected docked side rails** (pins fixed to the canvas edges).
   - A pin dragged near other pins of the same kind snaps into line with them: same x and grid-aligned spacing.
   - **Tidy pins** puts inputs in a column on the left of the circuit and outputs in a column on the right, top to bottom in panel order. It is one undo step. Wires to moved pins re-route, as on any move.
   - The canvas shows the order badges ① ② on pin pieces.
4. **Remembering which pin is which (owner).**
   - A saved chip used in a parent shows its inputs down the left side and its outputs down the right, **top to bottom in panel order, each with its name beside it**.
   - Where a pin sits on the chip's own canvas does not affect this (my call). If you want the canvas to match, use Tidy pins.
5. **Pin values** (spec §5.5, unchanged). Tapping an input's value toggles it. Multi-bit pins show their bits plus a decimal readout.
6. **Deleting a wired pin** removes its wires, and undo restores them (spec §5.5, unchanged).

### 3.2 Library (PR 4b)

1. **Where it is (my call).** A bottom sheet on phones. On desktop it's a side panel on the **left**, since the Pins panel is on the right. A header button opens it.
2. **An expandable folder tree (owner, option B).**
   - **Folders can be nested to any depth (owner).** This changes spec §5.4, where folders were one level of filter chips.
   - Tapping ▸ opens a folder in place, and several folders can be open at once.
   - Chips are rows with a colour square, the name, and ★ when starred. Subfolders are listed before chips; both are sorted by name (my call).
   - A chip that has never been saved shows greyed out as "draft only" and can't be placed (spec §5.11).
   - Built-ins (NAND, SPLIT, MERGE and, once it ships, the clock) live in a fixed **Built-in** folder that can't be renamed, moved or deleted (my call).
3. **Search and filters.**
   - Search matches the **folder path, the name and the tags, ranked in that order** (owner's order of recall). A query can match any part of the path, so typing "adders" finds everything under `Arithmetic › Adders`.
   - While searching, the tree shows only matches and the folders that lead to them, already open.
   - ★ (starred) and each tag are filter chips above the tree.
4. **Filing chips: at creation, at first save, and any time later (owner).**
   - **New chip** asks for a name, a colour and, optionally, a folder (spec §5.11 plus the folder). It then opens the new, empty chip.
   - The first save of a chip lets you pick or change its folder.
   - **Drag chips, and whole folders, between folders in the tree (owner: important).** Dropping onto a folder row moves the item into that folder, and dropping at the top level moves it to the root. A folder can't be dropped into itself or into one of its own subfolders.
   - Every move also works from the keyboard and screen readers, through "Move to…" in the row menu.
5. **Row menu (my call).** Long-press or right-click a row.
   - Chip: Open, Rename, Colour, Tags, Star/Unstar, Move to…, Delete.
   - Folder: New folder inside, Rename, Move to…, Delete.
   - Deleting a folder moves its contents up one level; it never deletes chips.
   - Deleting a chip that other chips use is refused, with a translated reason naming one parent ("Used in Full adder"). Deleting a chip deletes both its saved version and its draft, and asks first.
   - "New folder" is also available at the top of the tree.
6. **Placing a chip on the canvas.**
   - **Two ways to place a chip, both always available (owner): tap, or drag and drop.**
     - **Tap:** tap a chip row and the chip is armed. On phones the sheet tucks away. Then tap the spot on the canvas where it should land. This is the same arm-then-tap pattern as wiring. Escape, or tapping the armed row again, cancels.
     - **Drag:** drag a row onto the canvas. A ghost follows the finger and the chip lands where it's released (spec §5.4).
   - A chip can't be placed inside itself, directly or through another chip (spec §5.11). The row shows why, with a translated reason.
   - The **quick-add menu** opens on long-press or right-click on empty canvas and has search, recent chips, starred chips, input/output pins and paste. A chip picked there lands at the press point (spec §5.4, unchanged).
   - There is a keyboard path too, e.g. Enter on a row places the chip at the centre of the view (my call).
7. **The demo's "Add NAND" toolbar button** stays until the library ships. The builder may remove it in 4b once NAND can be placed from the library and quick-add.

### 3.3 Save flow (PR 4c)

1. **Drafts** (spec §5.6, unchanged). Edits go into the chip's draft, which autosaves. Chips that use it keep running its **saved** version until Save.
2. **Save updates the chip everywhere it is used (owner).**
   - When the save **breaks nothing**, it happens at once, with no dialog.
   - When the save **breaks something**, a confirmation lists every effect before saving, e.g. "Removes 3 wires in Full adder". Two things count as breaking: a removed pin, and a pin whose bit width changed. Either one drops the wires to that pin in every parent (spec §5.11 cascade). Cancel changes nothing.
   - Renaming a pin or adding a pin never asks. A rename changes only the label, and an added pin appears unconnected (spec §5.11).
   - Saving is not on the undo stack (spec §5.11).
3. **Discard draft** throws away unsaved edits and returns the draft to the saved version. **It always asks first (my call)**, since it can't be undone.
   - **Required fix carried over from Phase 3:** after a discard, re-route the wires in parent chips, so they don't keep routes worked out for the chip's old shape. This must land before the Discard UI ships.
   - A chip that has never been saved has no Discard option.
4. **Look inside and breadcrumbs** (spec §5.6 and §5.11).
   - "Look inside" on a placed custom chip opens that chip's draft for editing. Breadcrumbs show the path, e.g. `Full adder › Half adder`.
   - The opened chip runs its own simulation with its own input toggles. Live probing of one instance inside a parent stays out of scope.
   - **After Save you stay in the chip you saved (my call).** Tapping "Full adder" in the breadcrumbs goes back, and the parent already runs the new version.
   - Opening a chip from the library starts a fresh breadcrumb trail.
5. **Unsaved-changes dot (my call).** The header shows a dot next to the chip name whenever the draft differs from the saved version, and the library row shows the same dot.

### 3.4 Carried over from Phase 3 (in PR 4a)

1. **A translated reason for illegal connections.** When a tap or drop is refused, show and announce why, for example "That input already has a wire" or "A 4-bit pin can't be wired to a 1-bit pin". Reuse the existing `editor_error_*` messages where they fit. Every new string goes into both `en` and `es`.
2. **Half adder on a phone, taps only.** An E2E test on the phone project builds a half adder with two inputs and two outputs using taps only. It runs at the end of 4a, using the Pins panel and the existing toolbar for NANDs. The full "Done when" journey runs at the end of 4c.

## 4. Non-goals

- Live probing of one particular instance inside a parent.
- Sharing, publishing or importing chips between projects.
- Version history beyond the saved version and the draft.
- Bulk editing of several pins' widths at once.
- The clock's play/pause/speed UI. It's in the overall scope, but not in this phase. If it doesn't exist yet, the Built-in folder simply doesn't list it.

## 5. Anti-goals (a failure even if it works)

- Pins docked to fixed side rails (the owner rejected this).
- A dialog on every save. The owner wants Save to just work unless something breaks.
- A save that silently drops wires in a parent without the confirmation listing it.
- Moving or deleting a folder that loses chips.
- Pin order on the saved chip quietly following canvas positions instead of the panel. Remembering which pin is which depends on one clear source of order.
- A library that only works by mouse drag. Every move and placement needs a tap path and a keyboard path.

## 6. Constraints

- The project rules in `CLAUDE.md` apply: feature folders exposing only `index.ts`, `Result` instead of `throw` in `domain/`, Zod only at trust boundaries, react-aria only in `src/shared/ui`, and every string through Paraglide in `en` and `es`.
- Lint limits: files ≤ 300 lines, functions ≤ 50 lines, ≤ 3 parameters, complexity ≤ 10, ≤ 10 imports per file. `interaction-commands.ts` and `gestures.ts` are near the line cap, so new logic goes in new files.
- `domain/**` needs 95% branch coverage per file, so logic goes in `domain/`, and `ui/` and `adapters/` stay thin.
- `pnpm e2e:perf` must keep p95 ≤ 20 ms in both cases.
- The library is a new `chip-library` feature (spec §6). It may not reach into `circuit-editor` internals; any shared contract goes through `index.ts`.
- **Format change (my call, after the builder check).** Folders gain an optional `parentId`, and chips gain `starred`, which defaults to `false`. The change is purely additive: existing files still parse, and flat folders become top-level folders. Under ADR 33 the format is still a draft (nothing has been shared yet), so there is no version bump and no migrator. Update the fixtures, and add a test showing that an old file without these fields loads.
- Axe passes with every new panel, sheet, menu and dialog open, in every theme.

## 7. What already exists (verified on `main` at 849d98d)

- `projects/domain/model.ts`: chips already have `saved` (optional) and `draft` circuits, `folderId` and `tags`. Pins have stable IDs, name, width and direction. Folders are flat (`id`, `name`).
- `circuit-editor/domain/actions.ts`: already has `addPin`, `removePin`, `renamePin`, `setPinWidth`, `reorderPin`, `createChip`, `renameChip`, `recolorChip`, `saveChip` and `discardDraft`.
- `projects/domain/save-cascade.ts` implements the cascade, and `containment.ts` implements the "not inside itself" check.
- `ui/ChipDialogs.tsx` has rename and recolour dialogs with the colour palette. Reuse them for New chip.

Phase 4 mostly adds UI on top of these, plus: batch pin add, snap and Tidy, folder nesting and moves, star, the cascade *preview* for the confirmation, and the re-route on discard.

## 7.1 Calls made after the builder check (Claude's, open to the owner's veto)

- **Parents show the saved version.** A placed chip's pin layout, and the logic it runs, always come from the saved version (ADR 38). The draft is only what "Look inside" edits. The unsaved-changes dot compares the draft with the saved version.
- **Reordering pins is not a breaking change.** Wires use pin IDs (ADR 39), so they survive a reorder. Saving a reorder asks nothing. It moves the pins on the chip in every parent, and the wires attached to that chip re-route, the same as after a resize.
- **Who owns what.**
  - The folder tree's domain logic goes in `projects/domain/folders.ts`, with 95% branch coverage: nesting, cycle checks, moving chips and folders, delete-moves-contents-up, and the path used by search.
  - The editor gets folder/star actions that call into it, in the same style as `createChip`.
  - `chip-library` is UI plus its own `domain/` for search ranking and tree view state. It reads the project through `projects` exports.
  - Placing a chip crosses features. `chip-library` exports a drag/placement payload type from `index.ts`, and `circuit-editor` accepts it through its own `index.ts`. The editor layout composes the two. Neither feature reaches into the other's internals.
- **Batch pin add** is a new action, `addPins`, which adds the definitions and their pieces in one undo step. It does not chain `addPin` calls.
- **The ①② badges show the panel index.** "Add inputs…" places the pieces itself, lined up as in §3.1.2. Snapping shows a guide while dragging and applies on drop.
- **The cascade preview** is a dry run of `save-cascade`. It counts the wires dropped in every **direct** parent, in both its saved version and its draft, because the cascade updates both (spec §5.11). Grandparents are never affected: a parent's own pins don't change.
- **Save in a nested chip saves only that chip.** Parent drafts autosave as always. Going back through the breadcrumbs saves nothing.
- **The URL holds the chip being edited** (ADR 16). The breadcrumb trail lives in session state, so after a reload you're in the same chip with a one-level trail.
- **Panels on desktop push the canvas** rather than covering it. Phone sheets overlay it. `pnpm e2e:perf` runs with the panels closed, as it does today.

## 8. Left to the builder

- The exact snap distance and column spacing for pins and Tidy.
- The exact ranking within each search tier, and fuzzy matching.
- Tree row height and touch targets (≥ 24 px, per the existing rule).
- The library's drag-and-drop mechanism, decided by the spike (§9).
- How the cascade preview is computed: a dry run of `save-cascade` is the obvious way.
- The default count for "Add inputs…" (my guess: 1, with a stepper).

## 9. Risks to spike early

- **React Aria drag-and-drop from the library tree to the canvas on Android Chrome (RAC #6365).** Spike this at the start of 4b. If it fails on Android Chrome, use pointer-event dragging with a ghost for tree → canvas, and keep React Aria for tree → tree moves if those work.
- **Dragging inside a scrolling bottom sheet on phones:** telling a row drag from a sheet scroll. Try a long-press to start the drag on touch.
- **Format migration** for nested folders: cover it with fixture tests before any UI depends on it.
