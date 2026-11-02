# Editor Phase 4a: Pins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Status

Tasks 1-10 are done. Controller rulings that changed the plan:

- Tidy anchors each column at its first pin's current position and stacks the rest below; the new-column rule applies only when no piece of that direction exists.
- Task 6 (shared UI) and Task 7 (Pins panel) were built and reviewed as one dispatch.
- Tapping an input piece toggles it; existing e2e specs that tapped input pieces were updated in Task 5.
- The WidthMismatch test uses a 4-bit and an 8-bit bus pin (4-bit to 1-bit always offers a bit).
- Implementers verified UI through Playwright, not the browser pane.
- Pin stacking keeps grid snapping, so the gap below a piece is at least `PIN_ROW_GAP`, not exactly it.
- The refusal notice survives mouse hover and is cleared by every other gesture and command.
- `endRename` is its own interaction command, so closing the popover does not clear the selection.
- `ReorderList` takes `selectedKeys`/`onSelect(keys)`/`getText`; the extra shared/ui pieces stay.
- A drag in the Pins panel moves only the dragged row.
- Stale visual baselines were regenerated in Task 9.
- The phone fit-zoom problem stays a follow-up for the owner (spec §5.1 hit priority).

Known follow-ups:

- Phones: at fit zoom (0.25) a pin's 24 px target covers its 10 px piece, so a tap arms the pin instead of toggling the input (Ruling 11); zoom in to toggle. A canvas tap near the right edge did not select OUT.
- Focus: typing within about 2 frames after the Add dialog closes can lose a name (double-rAF race). Deleting the last pin drops focus to the body; focus "Add inputs..." instead.
- Panel selection follows focus, which may re-announce noisily. With several pieces selected, extra rows have no `aria-selected`, and Ctrl/Shift no longer extend the selection there.
- Tests: 6 Linux-WebKit `createProject` flakes (retry-green); harden it. The phone spec reads results through Export.
- Pin placement: stored off-grid pieces make the guide off-grid; a slot snap can overlap a piece already there; a drop after a mid-drag Escape can show a refusal.
- Canvas: a tap on an input body while a pin is armed cancels wiring and also flips the input. The rename popover goes stale on resize or undo.
- Tidy with 0 or more than 1 piece per pin is untested.
- Small cleanups: share the `Edit<Type>` alias; cache `pieceHeight` by width; `CircuitSummary` empty-name fallback when a pin def is missing.

**Goal:** Let the owner add, name, order, line up and use a chip's input and output pins quickly, on every device, and say why an illegal connection is refused.

**Architecture:**
- **Pure logic in `circuit-editor/domain/`:**
  - auto-names and column positions for new pins;
  - Tidy moves;
  - snapping a dropped pin piece;
  - refusal reasons.
- **One new edit action, `addPins`**, so adding several pins is one undo step. Tidy reuses `moveChips`.
- **Canvas gestures gain:**
  - toggling an input by tapping it;
  - renaming in place by tapping a pin piece's label;
  - a visible, announced notice when a connection is refused.
- **Pins of a saved chip inside a parent already show in panel order, with their names** (`customPins` in `chip-layout.ts`). Design §3.1.4 needs no new code; Task 9 checks it stays that way.
- **The Pins panel** is a new `ui/` component tree. It sits at the top of the existing right-hand `panel` area on screens 640 px and wider, and opens as a bottom sheet on phones. It edits only through `dispatch` and interaction commands.

**Tech Stack:**
- TypeScript 7 and React 19 with the React Compiler;
- React Aria Components, used only through `src/shared/ui`;
- Zustand (vanilla) and Canvas 2D;
- Vitest, Paraglide JS, and Playwright with axe.

No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-02-editor-phase-4-library-pins-save-design.md` (§3.1, §3.4, §5–§7.1). Parent spec: `docs/superpowers/specs/2026-10-29-circuit-editor-design.md` §5.5.

**Task labels:**
- **[mechanical]** tasks can go to a smaller implementer model.
- **[judgement]** tasks need a frontier model.

Every task gets a review either way.

## Global Constraints

- **Code rules:**
  - Features expose only `index.ts`, with no cross-feature internals.
  - `throw` is banned in `domain/`; return `Result`.
  - Only `src/shared/ui` imports react-aria.
  - Zod only at trust boundaries.
- **Strings:** every user-facing string goes through Paraglide, in both `messages/en.json` and `messages/es.json`.
- **Lint limits:**
  - files ≤ 300 lines;
  - functions ≤ 50 lines;
  - ≤ 3 parameters;
  - complexity ≤ 10;
  - ≤ 10 import dependencies per file.
- **Files near the cap:** `interaction-commands.ts` and `gestures.ts` are close to the line limit. New logic goes in new files.
- **Coverage:** each file in `src/features/*/domain/**` needs ≥ 95% branch coverage.
- **Performance:** `pnpm e2e:perf` must keep p95 ≤ 20 ms in both cases (zoom 0.17, and glow at zoom 0.51).
- **Targets:** touch targets are ≥ 24 px (WCAG 2.5.8).
- **Accessibility:** axe passes with every new panel, sheet, dialog and popover open, in every theme.
- **Pin order:** the panel order (`circuit.pins`) is the only source of pin order (design §5). Canvas positions never change it.
- **Visual baselines:** generate them only with `pnpm e2e:visual:docker --update-snapshots=all`, and look at every PNG before committing.
- **Gate:** `pnpm check` passes at the end of every task.

## Review Focus

1. **Adding pins when names are already taken.** Example: the owner renamed `B` to `C` and then adds 2 inputs. Expect `B` and `D`, with no duplicates. Tested in Task 1.
2. **Adding the first pin to an empty chip, or to a chip with no other parts.** New pins must land at a sensible on-grid spot, not at `NaN`, and not on top of each other. Tested in Task 1.
3. **Tidy on a chip with only pins, with pins of mixed widths, or with nothing to move.** Columns must not overlap. When everything is already in place, nothing is dispatched (no empty undo step). Tested in Task 2.
4. **Pressing Enter on the last row while naming, or entering an empty or whitespace-only name.** Editing ends on the last row. An empty name keeps the old name and shows the `EmptyName` reason, and nothing else is changed. Tested in Task 7.
5. **A refused connection by drag release, not only by tap.** The same reason must be shown and announced. Tested in Task 4.

---

### Task 1: Auto-names and column positions for new pins [judgement]

**Files:**
- Create: `src/features/circuit-editor/domain/pin-placement.ts`
- Test: `src/features/circuit-editor/domain/pin-placement.test.ts`

**Interfaces:**
- **Produces:**
  - `nextPinNames(circuit: Circuit, direction: PinDirection, count: number): readonly string[]`
  - `columnPositions(scene: Scene, direction: PinDirection, widths: readonly BitWidth[]): readonly Point[]`
  - `PIN_ROW_GAP = GRID` (the space between stacked pieces)
  - `PIN_COLUMN_GAP = 2 * GRID` (the space between a pin column and the other parts)
- **Consumes:**
  - `Scene` and `layoutIn` from `geometry.ts`;
  - `GRID` and `layoutOfKind` from `chip-layout.ts`.

**Naming rule:**
- **Inputs** use `A…Z`, then `AA, AB…`, like spreadsheet columns.
- **Outputs** use `OUT1, OUT2…`.
- Names are taken in sequence, skipping any name already used by a pin of either direction. The check is case-sensitive.

**Placement rule:**
- **When pieces of `direction` already exist,** the new pieces stack below the lowest one:
  - they use that piece's `x`;
  - each new piece's top is `PIN_ROW_GAP` below the bottom of the one above it;
  - a piece's height comes from `layoutOfKind` for a pin of that width.
- **When there is none,** the new pieces start a new column:
  - inputs go `PIN_COLUMN_GAP + GRID` left of the leftmost non-pin part;
  - outputs go `PIN_COLUMN_GAP` right of the rightmost non-pin part's right edge;
  - the first piece's top is at the top of the non-pin parts.
- **With no non-pin parts,** inputs use `x = 0` and outputs use `x = 6 * GRID`, both with `y = 0`.
- Every point is snapped to the grid with `snap` from `move.ts`.

- [ ] **Step 1: Write the failing tests**
  - `nextPinNames` on an empty circuit gives `["A","B","C"]` for 3 inputs, and `["OUT1","OUT2"]` for 2 outputs.
  - With pins `A`, `C` and `OUT1` already present, 2 inputs give `["B","D"]` and 1 output gives `["OUT2"]`.
  - With `A` through `Z` all used, 1 input gives `["AA"]`.
  - `count` 0 gives `[]`.
  - `columnPositions`:
    - On the demo-shaped circuit, with inputs at `(0,0)` and `(0,80)`, `["input",[1,1]]` gives `[{x:0,y:160},{x:0,y:240}]`, since a 1-bit piece is 40 px high and the gap is 40.
    - With one NAND at `(160,40)` and no pins, `["output",[1]]` gives `x = 160 + nandWidth + 80`, snapped, with `y = 40`.
    - With no parts at all, `["input",[1,4]]` gives `[{x:0,y:0},{x:0,y:80}]`.
    - Every result has `x` and `y` as multiples of 40.
- [ ] **Step 2:** Run `pnpm vitest run src/features/circuit-editor/domain/pin-placement.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement both functions in `pin-placement.ts`.
- [ ] **Step 4:** Run the same command. Expected: PASS, and branch coverage ≥ 95% for this file.
- [ ] **Step 5: Commit.** `feat(circuit-editor): name and place new pins in columns`

### Task 2: `addPins` action and Tidy moves [mechanical]

**Files:**
- Modify:
  - `src/features/circuit-editor/domain/actions.ts`: add the action.
  - `src/features/circuit-editor/domain/reducer.ts`: register it.
  - `src/features/circuit-editor/domain/editor-error-messages.ts`: only if a new error appears; none is expected.
- Create:
  - `src/features/circuit-editor/domain/pin-batch-edits.ts`
  - `src/features/circuit-editor/domain/pin-tidy.ts`
- Test:
  - `src/features/circuit-editor/domain/pin-batch-edits.test.ts`
  - `src/features/circuit-editor/domain/pin-tidy.test.ts`

**Interfaces:**
- **Consumes:** Task 1's `columnPositions` and `PIN_ROW_GAP`; `addPin`'s `insertionIndex` behaviour (pins go after the last pin of the same direction); `blockedRerouted` from `route-edits.ts`.
- **Produces:**
  - The action:
    ```ts
    | {
        readonly type: "addPins";
        readonly chipId: ChipId;
        readonly pins: readonly { readonly pin: PinDef; readonly instanceId: InstanceId; readonly position: Point }[];
      }
    ```
  - `addPins: Edit<"addPins">` in `pin-batch-edits.ts`. It fails with `DuplicatePin` or `DuplicateInstance` exactly as `addPin` does, and with `NothingToMove`-style `{ type: "NothingToAdd" }` for an empty list. Add `NothingToAdd` to `EditorError` and give it a message: en "Choose how many pins to add first.", es "Elige primero cuántos pines añadir.".
  - `tidyMoves(scene: Scene): readonly Move[]` in `pin-tidy.ts`:
    - inputs go in one column and outputs in another, each top to bottom in `circuit.pins` order;
    - the columns are placed with Task 1's no-existing-column rule, measured from the non-pin parts only;
    - pieces are spaced by their heights plus `PIN_ROW_GAP`;
    - pieces already in place are left out, as `movesFor` does.
- [ ] **Step 1: Write the failing tests**
  - `addPins` with 3 inputs adds 3 definitions after the existing inputs, in the given order, and 3 pin pieces at the given positions.
  - `applyAction` followed by one `undo` removes all 3, which shows it is one history step.
  - An empty list returns `err({type:"NothingToAdd"})`.
  - A repeated pin id returns `DuplicatePin`.
  - `tidyMoves` on the demo with input B dragged to `(400,400)` moves only B, back below A.
  - On a tidy circuit it returns `[]`.
  - On a circuit with only pins, it builds the columns at `x = 0` and `x = 6*GRID`.
  - With a 16-bit input above a 1-bit input, the second piece's top is the first's bottom + 40.
- [ ] **Step 2:** Run `pnpm vitest run src/features/circuit-editor/domain/pin-batch-edits.test.ts src/features/circuit-editor/domain/pin-tidy.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `addPins`, routed through `blockedRerouted` like `addPin` with every new instance id. Then implement `tidyMoves`, and add the messages.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(circuit-editor): add several pins in one step and tidy pin columns`

### Task 3: Snap a dropped pin piece into line [judgement]

**Files:**
- Create: `src/features/circuit-editor/domain/pin-snap.ts`
- Modify:
  - `src/features/circuit-editor/domain/interaction.ts` (`previewOf`);
  - the move-drag end in `interaction-drag.ts`;
  - `src/features/circuit-editor/adapters/draw-overlays.ts`: the guide line.
- Test:
  - `src/features/circuit-editor/domain/pin-snap.test.ts`
  - an added case in `interaction-drag.test.ts`

**Interfaces:**
- **Produces:**
  - `snapPinDrop(scene: Scene, instanceId: InstanceId, proposed: Point): { readonly position: Point; readonly guideX?: number }`
  - `PIN_SNAP = GRID`
- **Consumes:** Task 1's `PIN_ROW_GAP`.

**Rule:**
- The rule applies only when the drag moves exactly one instance and that instance is a pin piece.
- **x:** if `proposed.x` is within `PIN_SNAP` of the `x` of another piece of the same direction, take the nearest such `x`, and set `guideX` to it.
- **y:** then, if `proposed.y` is within `PIN_SNAP` of a slot directly below or above a piece in that column, take the slot's `y`. A slot is the piece's bottom + `PIN_ROW_GAP`, or the piece's top − `PIN_ROW_GAP` − its own height.
- Otherwise the proposed, grid-snapped position stands.
- The drag preview uses the snapped position, so the ghost lands where the drop will. The renderer draws a 1 px dashed vertical guide at `guideX` while dragging.
- [ ] **Step 1: Write the failing tests**
  - In the demo, dragging B to `(40,200)` gives `x = 0` with `guideX = 0`.
  - Dragging B to `(200,200)` gives no snap.
  - Dragging B to `(0,60)`, which is near A's bottom slot `y = 80`, gives `y = 80`.
  - A two-chip drag gets no snap: the existing `moveChips` assertion still holds.
- [ ] **Step 2:** Run `pnpm vitest run src/features/circuit-editor/domain/pin-snap.test.ts src/features/circuit-editor/domain/interaction-drag.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `snapPinDrop`. Apply it in the move preview and at drag end, and draw the guide.
- [ ] **Step 4:** Run the same command, then `pnpm e2e:perf`. Expected: PASS, with p95 ≤ 20 ms.
- [ ] **Step 5: Commit.** `feat(circuit-editor): snap dragged pins into line`

### Task 4: Say why a connection is refused [judgement]

**Files:**
- Modify:
  - `src/features/circuit-editor/domain/wiring-targets.ts`: `illegal` carries the reason.
  - `src/features/circuit-editor/domain/interaction-wiring.ts`: tap and drag release.
  - `src/features/circuit-editor/domain/interaction.ts`: the `refused` announcement and the `notice` state.
  - `src/features/circuit-editor/domain/announcements.ts`
  - `src/features/circuit-editor/ui/CanvasOverlays.tsx`: the visible notice.
- Test: `wiring-targets.test.ts`, `interaction-wiring.test.ts`, `interaction-wiring-drags.test.ts` and `announcements.test.ts`.

**Interfaces:**
- **Produces:**
  - `Completion`'s illegal case becomes `{ readonly type: "illegal"; readonly reason: ConnectionError }`. When the bit fallback fails, the reason is the original `WidthMismatch`.
  - `Announcement` gains `| { readonly type: "refused"; readonly reason: ConnectionError }`. Its text is `editorErrorMessage(reason)`, which reuses the existing `editor_error_*` strings.
  - `InteractionState` gains `readonly notice?: ConnectionError`. It is set together with the `refused` announcement, cleared by the next gesture or command, and shown by `CanvasOverlays` as a visible, non-modal line over the canvas. The line is `aria-hidden`, because the live region already speaks it.
- **Behaviour:**
  - **Tap:** with a pin armed, tapping an illegal pin still arms the tapped pin, as today, and also sets `notice` and announces `refused`.
  - **Drag:** releasing a wire drag within reach of an illegal pin sets the same notice, and no wire is made.
- [ ] **Step 1: Write the failing tests**
  - Armed on the demo NAND's `a` (already driven by A), tapping input B's pin gives `notice.type === "InputAlreadyDriven"`, and the effects include `{type:"announce", announcement:{type:"refused", reason: …}}`.
  - Output to output gives `OutputToOutput`.
  - In the bus fixture, 4-bit to 1-bit with no bit possible gives `WidthMismatch`.
  - A drag released over the driven NAND input gives the same notice.
  - The next tap clears `notice`.
  - `announcementText` for `refused` equals `m.editor_error_input_already_driven()`.
- [ ] **Step 2:** Run the four test files. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the four test files. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(circuit-editor): show and announce why a connection is refused`

### Task 5: Canvas pin interactions: toggle, rename in place, order badges [judgement]

**Files:**
- Create:
  - `src/features/circuit-editor/domain/interaction-pins.ts`: toggle and rename gestures.
  - `src/features/circuit-editor/ui/PinRenamePopover.tsx`
- Modify:
  - `hit-test.ts`: a new hit `{ type: "label"; instanceId }` for a pin piece's name, which `layoutOf` places outside the body.
  - `interaction-tap.ts`
  - `interaction.ts`:
    - `Effect` gains `{ type: "setInput"; pinId; value }`;
    - `InteractionState` gains `renaming?: { instanceId; screen }`;
    - `InteractionCommand` gains `{ type: "selectPieces"; instanceIds }` and `{ type: "startRename"; instanceId }`.
  - `interaction-store.ts`: run `setInput` through `editor.setInput`.
  - `adapters/draw-parts.ts`: badges and the multi-bit decimal.
  - `ui/CanvasOverlays.tsx`
- Test: `interaction-pins.test.ts`, plus new cases in `hit-test.test.ts` and `interaction-store.test.ts`.

**Interfaces:**
- **Consumes:** `editor.setInput(pinId, value)`, which already exists; `renamePin`, which already exists.
- **Produces, for Task 7:** the commands `selectPieces` and `startRename`.

**Behaviour:**
- **Tapping an input piece.**
  - A plain tap on a **1-bit** input piece's body flips its value and keeps the existing select-on-tap.
  - Shift-tap only selects.
  - A multi-bit input is not toggled from the canvas; its value is set in the Pins panel (Task 7).
  - A multi-bit piece's body shows its decimal value instead of one level.
- **Renaming in place.**
  - Tapping a pin piece's **label** opens `PinRenamePopover` at the label: a text field with Enter to save and Escape to cancel.
  - The `startRename` command does the same for the focused piece, and so does the key `F2`. Add `F2` to `keymap.ts` and to the keyboard help.
  - An empty name shows `editorErrorMessage({type:"EmptyName"})` inline and keeps the popover open.
- **Order badges.** Each pin piece draws its 1-based panel index within its direction (`①`, `②`, … drawn as a number in a small circle) at the body's top-left. It uses the theme's chip text colour.
- [ ] **Step 1: Write the failing tests**
  - A tap on demo input A's body gives a `setInput` effect with value 1, and the selection is `[A]`.
  - A second tap gives value 0.
  - Shift-tap gives no `setInput`.
  - A tap on the output OUT gives no `setInput`.
  - A tap at A's label point gives `renaming.instanceId === A`.
  - The hit test at the label point returns `label`.
  - `selectPieces([B])` gives the selection `[B]` and focuses B.
- [ ] **Step 2:** Run the new and changed test files. Expected: FAIL.
- [ ] **Step 3:** Implement the domain parts, then the popover and the drawing.
- [ ] **Step 4:** Run the test files, `pnpm check` and `pnpm e2e:perf`. Expected: PASS, with p95 ≤ 20 ms.
- [ ] **Step 5: Commit.** `feat(circuit-editor): toggle, rename and number pins on the canvas`

### Task 6: Shared UI pieces: Sheet, NumberField, ReorderList [mechanical]

**Files:**
- Create in `src/shared/ui/`, each with a `.module.css` and its generated `.d.ts`:
  - `Sheet.tsx`
  - `NumberField.tsx`
  - `ReorderList.tsx`
- Modify: `src/shared/ui/index.ts`.
- Test: React Testing Library tests next to them, if `src/shared/ui` already has that pattern. Otherwise they are covered by the e2e tests in Task 9.

**Interfaces (produced):**
- `Sheet({ title, isOpen, onClose, children })`: a React Aria `Modal` styled as a bottom sheet. It has a focus trap, closes on Escape and on a tap outside, and has a visible title.
- `NumberField({ label, value, minValue, maxValue, onChange })`: wraps RAC `NumberField` with − and + buttons that are each ≥ 24 px.
- `ReorderList<Item>({ label, items, getKey, renderRow, onMove, selectedKey, onSelect })`:
  - wraps RAC `GridList` with `useDragAndDrop` reordering;
  - calls `onMove(key, toIndex)`;
  - each row has a drag handle;
  - keyboard reordering works through RAC's built-in drag-and-drop keyboard support.
- [ ] **Step 1:** Write the three components, following `ModalDialog.tsx` and `Select.tsx` for structure and token use.
- [ ] **Step 2:** Run `pnpm check`. Expected: PASS, including knip, which will report the new exports as unused until Task 7. If knip fails on them, fold this task into Task 7's commit instead.
- [ ] **Step 3: Commit.** `feat(ui): add sheet, number field and reorderable list`

### Task 7: The Pins panel [judgement]

**Files:**
- Create in `src/features/circuit-editor/ui/`:
  - `PinsPanel.tsx`: the host. It owns the "Pins N" button, renders inline at 640 px and wider, and opens a `Sheet` below that width.
  - `PinsList.tsx`: the Inputs and Outputs sections.
  - `PinRow.tsx`
  - `AddPinsDialog.tsx`
  - `PinsPanel.module.css`
- Create: `src/features/circuit-editor/domain/pin-rows.ts`, a pure view model. Test: `pin-rows.test.ts`.
- Modify:
  - `src/features/circuit-editor/index.ts`: export `PinsPanel`.
  - `src/routes/projects.$projectId.tsx`: `panel={<><PinsPanel session={session} /><CircuitSummary session={session} /></>}`.

**Interfaces:**
- **Consumes:**
  - Task 1's `nextPinNames` and `columnPositions`;
  - Task 2's `addPins` and `tidyMoves`;
  - the existing actions `renamePin`, `setPinWidth`, `reorderPin`, `removePin` and `moveChips`;
  - Task 5's commands `selectPieces` and `startRename`;
  - `editor.setInput`;
  - Task 6's components.
- **Produces:**
  - `pinRows(circuit: Circuit, selection: ReadonlySet<InstanceId>): { inputs: readonly PinRowModel[]; outputs: readonly PinRowModel[] }`
  - `PinRowModel = { pinId; instanceId; name; width; ordinal; selected }`

**Behaviour:**
- **Header.** "Pins N", where N is the number of pins, opens or closes the panel.
  - On 640 px and wider the panel is open by default, at the top of the right-hand column, above the summary.
  - On phones the button opens the sheet.
- **Rows.** Each row has a drag handle, a badge, a name field, a width `Select` (1/4/8/16), a value control and a ⋯ menu.
  - **Value control:** a switch for 1-bit inputs, `NumberField` from 0 to 2^w − 1 plus the bit string (e.g. `0101`, bit 0 rightmost) for multi-bit inputs, and the read-only value for outputs (multi-bit: decimal plus bit string).
  - **Menu:** Move up, Move down, Delete.
  - Moving a row dispatches `reorderPin`.
  - Changing the width dispatches `setPinWidth`.
  - Delete dispatches `removePin`.
- **List-style naming.**
  - The name field commits on Enter and on blur through `renamePin`.
  - Enter then focuses the next row's name field, across Inputs into Outputs.
  - Enter on the last row leaves editing.
  - Escape restores the old text.
  - An empty name shows `EmptyName` inline and doesn't move on.
- **Add inputs… / Add outputs….**
  - Each opens `AddPinsDialog`, with a count `NumberField` from 1 to 16 (default 1) and a 1/4/8/16 width `Select` (default 1).
  - Confirming dispatches one `addPins`, with Task 1's names and positions and fresh ids.
  - Focus then goes to the first new row's name field, with its text selected.
- **Tidy pins.** The button dispatches `moveChips` with `tidyMoves`. It is disabled when the list is empty.
- **Selection sync.**
  - Selecting a row sends `selectPieces([row.instanceId])`.
  - A row is highlighted when its piece is in `selection.instances`.
- **Strings:** add all of the following in `en` and `es`:
  - `pins_heading` "Pins {count}"
  - `pins_inputs`
  - `pins_outputs`
  - `pins_add_inputs`
  - `pins_add_outputs`
  - `pins_add_count`
  - `pins_add_width`
  - `pins_tidy`
  - `pins_move_up`
  - `pins_move_down`
  - `pins_delete`
  - `pins_name_label` "Name of {direction} {ordinal}"
  - `pins_width_label`
  - `pins_value_label`
  - `pins_empty` "No pins yet. Add inputs and outputs here."
- [ ] **Step 1: Write the failing tests for `pin-rows.ts`.**
  - The demo gives inputs `A` (ordinal 1) and `B` (ordinal 2), and outputs `OUT` (ordinal 1).
  - The row for a selected piece has `selected: true`.
  - After `reorderPin(B, 0)` the inputs are `B`, then `A`.
- [ ] **Step 2:** Run `pnpm vitest run src/features/circuit-editor/domain/pin-rows.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `pin-rows.ts`, then the components, keeping each component file ≤ 300 lines and ≤ 10 imports.
- [ ] **Step 4:** Run `pnpm check`. Expected: PASS.
- [ ] **Step 5: Check it in the browser.**
  - Run `lsof -iTCP:5173` first, then use `preview_start` only if the server isn't already up.
  - Add 3 inputs and name them with Enter. Tidy. Reorder. Change a width.
  - Use `read_page` and `find`, not screenshots.
- [ ] **Step 6: Commit.** `feat(circuit-editor): add the Pins panel`

### Task 8: The summary names pins by their names [mechanical]

**Files:**
- Modify:
  - `src/features/accessibility/ui/CircuitSummary.tsx`;
  - `messages/en.json` and `messages/es.json`;
  - `e2e/support.ts`: the `inputSwitch` names and the `output` matcher.

**Change:**
- An input switch is labelled `m.input_named({ name: def.name })`, which gives "Input A".
- An output reads `m.output_named_value({ name, value })` "Output {name}: {value}", and `m.output_named_unknown({ name })` "Output {name}: unknown".
- Remove `input_a`, `input_b`, `output`, `output_numbered`, `output_value` and `output_unknown` once nothing uses them.
- Update the e2e `output()` helper to `/^Output OUT: /u`.
- [ ] **Step 1:** Make the change.
- [ ] **Step 2:** Run `pnpm check` and `pnpm e2e --project=chromium`. Expected: PASS.
- [ ] **Step 3: Commit.** `fix(accessibility): name pins in the summary by their own names`

### Task 9: E2E: pins panel, half adder on a phone, axe, visuals [judgement]

**Files:**
- Create:
  - `e2e/pins-panel.spec.ts`
  - `e2e/half-adder-phone.spec.ts`
  - `e2e/pins-support.ts`: helpers for opening the panel, adding pins, naming rows and tapping a pin.
- Modify:
  - `e2e/a11y.spec.ts`: axe with the panel, the sheet, `AddPinsDialog` and the rename popover open, in every theme.
  - `e2e/visual.spec.ts`: one new snapshot of the demo with the Pins panel open.

**Tests:**
- **`pins-panel.spec.ts`**, on every project except `@visual`:
  - Add 2 inputs: rows `C` and `D` appear, the pieces line up under B (checked through the exported file positions), and one Undo removes both.
  - Name rows with Enter.
  - Reorder with Move down: the badge order follows, and the exported `pins` order changes.
  - Tidy puts a dragged-away B back in the column.
  - Toggling a 1-bit input on the canvas flips the summary switch.
  - Tapping a label, typing and pressing Enter renames the pin.
  - A refused tap shows "That input already has a wire." on screen and in the live region.
  - After a reorder, the chip's saved version lists its pins in the new order. Seed a saved chip and place it in a second chip through the fixture, since the library comes in 4b.
- **`half-adder-phone.spec.ts`**, on `mobile-chrome` and `mobile-safari` only, taps only with no keyboard shortcuts:
  - Start a new project and delete the demo's NAND and OUT.
  - In the Pins panel sheet, add outputs SUM and CARRY, and keep inputs A and B.
  - Add NANDs with the toolbar button.
  - Wire the half adder (XOR from 4 NANDs, AND from 2 NANDs) by tap-tap.
  - Check all four input combinations through canvas taps against the summary outputs: `SUM = A xor B` and `CARRY = A and B`.
- [ ] **Step 1:** Write the specs. Run `pnpm e2e`. Expected: PASS. Run Firefox through Docker, using the command from the handoff, then delete `.pnpm-store/`.
- [ ] **Step 2:** Run `pnpm e2e:visual:docker --update-snapshots=all`, check every changed PNG, and keep only the intended changes.
- [ ] **Step 3:** Run `pnpm e2e:perf`. Expected: p95 ≤ 20 ms in both cases.
- [ ] **Step 4: Commit.** `test(e2e): cover the Pins panel and a half adder built by taps on a phone`

### Task 10: Record decisions [mechanical]

**Files:**
- Create: `docs/adr/0045-pins-panel-and-pin-placement.md`. It records:
  - the panel order is the only pin order;
  - new pins stack in columns, and Tidy rebuilds the columns;
  - snapping applies to dropped pin pieces;
  - tapping toggles only 1-bit inputs, and multi-bit values are set in the panel;
  - rename in place goes through the label hit and `F2`.
- Modify:
  - `GLOSSARY.md`: add **Pins panel**, **pin piece**, **Tidy pins** and **order badge**, if missing.
  - This plan: add a "Status" section listing the controller rulings and the known follow-ups.
- [ ] **Step 1:** Write them.
- [ ] **Step 2:** Run `pnpm check`. Expected: PASS (spell).
- [ ] **Step 3: Commit.** `docs: record pins panel and pin placement decisions`

---

## Done when

- [ ] Pins can be added several at a time, named like a list, reordered, resized, deleted, snapped and tidied, by touch, mouse and keyboard, on every Playwright project. Every edit is one undo step.
- [ ] Inputs toggle on the canvas, labels rename in place, and badges match the panel order.
- [ ] A refused connection shows and announces a translated reason.
- [ ] A half adder is built and checked with taps only on `mobile-chrome` and `mobile-safari`.
- [ ] `pnpm check`, `pnpm e2e` (with Firefox in Docker) and `pnpm e2e:visual:docker` pass, and axe passes in every theme. `pnpm e2e:perf` keeps p95 ≤ 20 ms.
