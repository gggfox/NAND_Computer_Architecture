# 46. Chip library and placement (amends the editor design §5.4 and the Phase 4 spec §7.1)

The chip library is its own feature, `chip-library`. It shows the project's chips in a tree of nested folders, with search and a Starred filter, and places chips on the canvas by tap, drag, keyboard or the quick-add menu. It is a column from 640 px wide and a bottom sheet on phones, and it starts closed on every width; the toolbar's "Library" button opens it.

This amends the editor design §5.4, where folders were one level of filter chips: folders now nest to any depth. It also amends the Phase 4 spec §7.1, which had `chip-library` export the placement payload: the payload is `PlaceableKind`, exported by `circuit-editor`.

## Dependency direction

`chip-library` imports `circuit-editor` (and `projects`, `shared`, `i18n`), the way `accessibility` does. `circuit-editor` never imports `chip-library`. The library must dispatch editor actions and drive placement, so a payload owned by the library would make the two features import each other.

The quick-add menu reaches the canvas through `CircuitCanvas`'s `canvasMenu` slot: a render function that gets a `CanvasMenuContext` (the press point in canvas pixels, `close`, `tidyWires`, `place(kind)` and `addPin(direction)`). The route passes the library's menu into the slot, so the editor draws the popover without knowing what is in it.

## Decisions

1. **Drag mechanism.** One pointer-event drag handles both tree to canvas and tree to tree, with a ghost under the finger. On touch it starts after a long-press; with a mouse, after a 4 px move. React Aria drag-and-drop is not used: Playwright touch can't drive HTML5 drag, and two drag systems would double the edge cases. Keyboard and screen-reader users move items with "Move to…".
   - A spike (a canvas plus an open sheet of 40 rows, real touches through CDP) chose long-press over a grip handle. On mobile Chrome a long-press then drag from a scrolled row dropped at the release point within 2 px and left the list scroll alone, a quick swipe scrolled without dragging, and a held long-press opened the menu. Mouse drags passed on Chromium and WebKit.
   - iOS Safari is not verified: Playwright's WebKit can't inject real touches. The WebKit touch drag test is skipped with that reason, and the tap path works there. If iOS cancels the drag, the fallback is a grip handle.
   - While a sheet is open, React Aria marks the rest of the page `inert`, so `elementFromPoint` over the canvas returns `<html>`. A drop hit-tests the canvas with its bounding rectangle (`clientToCanvas`), and uses `elementFromPoint` only to find folder rows.
2. **Dependency direction** as above; the placement payload is `PlaceableKind` from `circuit-editor`.
3. **Library edits are undo steps:** folder create, rename, move and delete, and chip file, star and tag. `createChip` applies to every snapshot, as before. `deleteChip` resets the undo history, and its confirmation says it can't be undone; otherwise a later save could write a saved version that places a chip deleted in another snapshot.
4. **Deleting the open chip** opens the first other chip in project order. The last chip in a project can't be deleted.
5. **Long-press on touch:** holding still opens the row menu, and moving after the long-press starts a drag. Every row also has a visible "⋯" menu button, and right-click opens the same menu.
6. **Armed placement stays armed.** Every tap on the canvas places a copy, wherever it lands, until Escape, a tap on the armed row, or "Done" in the placing banner. Arming a placement disarms a wire pin, and arming a pin stops a placement. Arming is interaction state, never an undo step (ADR 43); each part placed is one.
7. **Built-in rows** are fixed, in this order: NAND, Split 4, Split 8, Split 16, Merge 4, Merge 8, Merge 16. The clock is listed once it ships.
8. **Search tiers:** path, then name, then tag, then colour (a chip's swatch name, such as "red"). Matching ignores case and diacritics and uses substrings, with no fuzzy matching. Within a tier, results are sorted by name.
9. **Quick-add** has a search field, Recent, Starred, "Add input", "Add output" and "Tidy wires". Paste is left out until the editor has copy and paste. Recent holds the last 5 kinds placed this session, in interaction state, and isn't saved.
10. **Filing at first save moves to Phase 4c**, with the save flow. In 4b a new chip is draft-only and can't be placed.
11. **"Add NAND" stays in the toolbar.**
12. **Folder integrity.** The file format rejects a folder whose `parentId` names no folder, or whose parents form a cycle. A chip whose `folderId` names no folder is shown at the top level, so a chip is never hidden. A folder can't be moved into itself or into one of its own subfolders, by drag or by "Move to…".
13. **Names and tags.** Folder names are trimmed and must not be empty; two folders may share a name. Tags are trimmed and empty ones are dropped; duplicates are compared ignoring case and the first spelling is kept.
14. **The library starts closed** on every width, which leaves the canvas width, the perf runs and the existing visual baselines as they were.

The format change is additive: `Folder.parentId?` and `Chip.starred` (default `false`), with no version bump and no migrator (ADR 33).

## Calls made while building

- A row that can't be placed (a draft-only chip) stays keyboard-focusable and keeps its "⋯" menu. It is marked with `data-unavailable` and an accessible description giving the reason, not `aria-disabled`, which disabled the row's menu button. Enter or a tap on it places nothing.
- From the keyboard, Enter on a part places one at the centre of the view. A pointer or touch press arms it instead, and on phones the sheet closes so the canvas can be tapped.
- When the armed chip is deleted or another chip is opened, the library cancels the placement, and Recent shows only kinds that can still be placed. The interaction state doesn't check this itself; the editor already refuses a bad placement with a notice.
- The drop target is the canvas's rectangle, as in decision 1. Before every release the drag sends one more clock tick, so a held press is never read as a tap.
- On empty canvas, a long-press opens the quick-add menu with the Pan tool; with the Select tool it still starts the Phase 3 lasso. Right-click opens it with either tool.
- On phones the quick-add's search field takes focus when it opens, which brings up the keyboard.
- When the open chip changes, the route writes `?chip=` to the URL. Reading `?chip=` on load is left to Phase 4c, with the breadcrumbs.
