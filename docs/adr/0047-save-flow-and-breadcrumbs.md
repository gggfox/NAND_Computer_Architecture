# 47. Save flow and breadcrumbs (reads the Phase 4 spec §3.3.3 and §7.1)

Saving a chip now updates it everywhere it is used, and asks first only when the save would drop wires in the chips that use it. Discard returns a draft to its saved version. "Look inside" opens a placed chip and adds a breadcrumb; the breadcrumbs go back without saving. A dot marks a chip with unsaved changes, in the editor's header and on its library row. A reload reopens the chip named in `?chip=`.

The editor gets a chip header: a full-width row between the toolbar and the status row, on every width. It holds the breadcrumbs (a `nav` labelled "Chip path"), the unsaved dot, Save, and a "⋯" menu with "Discard changes…".

## Where the logic lives

- Whether a draft differs from its saved version is a pure function in `projects/domain/unsaved.ts` (`hasUnsavedChanges`, `unsavedState`), used by the header and the library rows.
- The save confirmation's list is a dry run of the existing `planSave` cascade, turned into consequences by `circuit-editor/domain/save-preview.ts`.
- The trail is pure functions in `circuit-editor/domain/breadcrumbs.ts`, held as `trail` next to `chipId` in the editor store, so every chip switch updates both in one `set`.
- Filing a chip at its first save is a library concern (spec §3.2.4). It reaches the header through a `firstSave` render slot (`FirstSaveSlot`), the way quick-add reaches the canvas through `canvasMenu` (ADR 46). `circuit-editor` still never imports `chip-library`; the route composes them.

## Decisions

1. **"Unsaved" ignores automatic routes.** A draft has unsaved changes when its pins, instances, wire ends, colours or hand bends differ from the saved version. The waypoints of automatic wires (`manualWaypoints: false`) don't count. Saving a child re-routes its parents' drafts but not their saved versions, so comparing routes would light the dot on every parent after each child save.
2. **Discard re-routes the restored draft, not the parents.** Parents draw a chip from its saved version, and Discard doesn't touch the saved version, so nothing in a parent moves. The stale routes are in the restored draft itself (a saved version keeps the routes it had when saved), so after a discard its automatic wires are routed again (`settled`). This is how we read §3.3.3's "re-route the wires in parent chips": no stale routes after a discard.
   - Hand-bent wires keep their bends, unless an end's stub is no longer straight: when the segment from a pin's anchor now to its nearest waypoint is neither horizontal nor vertical (`brokenStubs`), the wire is routed again. A diagonal stub is never a valid route, so this can't undo bends that still fit. (Added in the final fix wave.)
   - Not covered: an anchor that moved along its stub, which stays straight, keeps its old bends. The layout as saved isn't recorded, so a move like that can't be seen. If it matters later: carry the parents' saved hand bends when a child is renamed or saved, or record the anchors with the saved version (a format change).
3. **Discard is an undo step.** It already pushed history. The confirmation still asks first, but its copy doesn't claim it can't be undone.
4. **Breakage is decided by wires, not pins.** The save asks first only when the dry run drops at least one wire (`WiresRemoved`). A removed or resized pin that no parent wired breaks nothing, so it saves at once. When it asks, the list shows each parent's dropped wires and the removed or resized pins.
5. **Counts use the "Label: {count}" form**, as in `canvas_deleted`: "Wires removed in Full adder: 3". This avoids plural rules in Paraglide.
6. **The first save asks for a folder** (§3.2.4). Saving a never-saved chip opens a "Save {name}" dialog with the folder picker, preset to the chip's current folder. Confirming files the chip if the folder changed (`fileChip`, an undo step), then saves. Later saves never ask. A first save can't drop wires: a never-saved chip can't be placed, so it has no parents.
7. **The trail lives in the editor store** as `trail: readonly ChipId[]`, whose last item is always `chipId`. `openChip` (library, New chip, delete) starts a fresh trail, `lookInside` appends, and `goBack(index)` cuts it. After any commit, chips missing from the project are dropped; if the trail no longer ends at `chipId`, it becomes `[chipId]`. Going back saves nothing (§7.1).
8. **`?chip=` is read back.** The editor opens the URL's chip when it exists, and otherwise the project's `lastOpenedChipId`. A missing, unknown or malformed `?chip=` is corrected with `replace` on mount. After a reload the trail is one level.
9. **The header row** sits between the toolbar and the status row on every width. Save is a visible button, disabled when there is nothing to save. Discard sits in the "⋯" menu, which appears only for a saved chip with unsaved changes; a never-saved chip has no Discard.
10. **Library dot.** A saved chip with unsaved changes shows the dot on its row. A never-saved chip keeps its "Draft only" badge and shows no dot, so a row never has two markers.
11. **Outcomes are announced.** "Saved Half adder" and "Changes to Half adder discarded" are spoken through a polite status in the header. A refused save (`WouldContainItself`) shows through the existing session errors.
12. **No Ctrl/Cmd+S.** The canvas keymap acts only while the canvas has focus, and a save may need a dialog. Listed as a follow-up.
13. **The Done-when journey builds a real full adder** on a phone with taps only, from two half adders and an OR of three NANDs (spec §1). After the change inside the half adder, it checks the full adder's outputs, not just its labels.

Saving is still not an undo step (spec §5.11).

## Calls made while building

- **An outcome is spoken once.** The outcome keeps the editor's `history.present` and `trail` from right after the save or discard, and shows only while both are the same references. Coming back to the chip, or redoing a discard, doesn't announce it again. The project alone isn't enough, because opening a chip with nothing to route can leave `history.present` unchanged.
- **The header has no `Breadcrumbs.tsx` yet.** `ChipHeader.tsx` stayed under the ~150 lines at which the breadcrumbs would move to their own file.
- **The save-flow specs use their own fixture**, `e2e/fixtures/save-flow.json`, because `library.json`'s Half adder has no pins. It is built by the same builders as the other fixtures.
- **`library-drag.spec.ts` scrolls its row into view.** The header row makes the canvas row shorter on a 1280 × 720 desktop, so the library column scrolls.
- **When a wire drops, the confirmation lists every removed or resized pin**, including ones no parent wired.
- **An unconnected output inside a placed chip stops the whole simulation.** In the journey, deleting the wire into Half adder's CARRY stops Full adder's simulation ("A chip has an unconnected input…"), and its outputs read "unknown". That isn't new in 4c, but it is what "the carry out is no longer 1" looks like.
- **Reading `?chip=` back broke leaving and reopening a project, and importing over it** (4fc4a0f). `persistence.spec.ts` "survives leaving and reopening", `pins-panel.spec.ts` "a reorder inside a saved chip…" and `half-adder-phone.spec.ts` failed. They were first taken for pre-existing flakes; a clean bisect showed a regression, fixed in de595e4.
  - Cause: on re-entry the router mounted its cached match, the stale project, while the reload ran. That editor's mount-time `?chip=` correction navigated, which cancelled the reload and left the stale project open. An import let a stale URL chip override the file's own last-opened chip.
  - Fix: the project route keeps nothing once it is left (`gcTime: 0`), and an import of the open project clears `chip` from the URL before `router.invalidate()`.
  - Trade-off, accepted: re-entering a project shows the empty Pending screen while it loads, instead of the previous project.
- **A child save can light a parent's dot through a hand-bent wire.** When a child's save or rename re-routes a hand-bent wire in a parent's draft, the wire turns automatic, and the parent shows the unsaved dot. That is a real difference between the draft and the saved version, not route noise: decision 1 ignores automatic routes only. Review Focus 1 (no dot on a parent after a child save) holds for parents whose affected wires are automatic.
- **The e2e export schema accepts string pin keys**, since a custom chip's wires name its pins by id.

## Follow-ups

- Ctrl/Cmd+S (decision 12).
- Small cleanups and tests left from review:
  - `unsaved.ts`: an unreachable `"chipId" in kind` branch holds branch coverage at exactly 95 %; check `type === "custom"` instead.
  - `chip-edits.ts` `discardDraft`: an unreachable `chip === undefined` branch and a second `findChip`.
  - `openChip` leaves `lastError` null on an unknown chip while `lookInside` sets `ChipNotFound`; `goBack` drops a `switchTo` error silently.
  - `saveStep` has no unit test; `SaveDialogs` imports `ChipHeader.module.css`; dialog titles read the open chip's live name.
  - `useLinkedSession` holds two effects; extract the mount correction if it grows.
  - `FirstSaveDialog`'s unchanged-folder and refused-`fileChip` branches are untested, and nothing asserts a chip is placeable right after its first save; `unsavedDot` in e2e is scoped with `:not([role=treegrid] *)`; a silent `chip?.name ?? ""`.
  - Tests to add: a "counted once" save-preview test that can show the dedupe; trail tests for undo and redo and for routing on `lookInside` and `goBack`; a `chip-url` reload test that can tell the URL from the last-opened fallback; a "new stays new with edits" tree test.
