# 48. Duplicate, Array and the selection bar (reads the Phase 5 spec §3.1)

With chips selected, Duplicate copies them one grid step down and to the right, and Array adds a row, column or grid of copies from a dialog. Both copy the wires inside the selection and drop wires to chips outside it, and each is one undo step. They are reached from a selection bar, the chip menu, and `Ctrl`/`⌘`+`D` / `Ctrl`/`⌘`+`Shift`+`D`.

## Where the logic lives

- `circuit-editor/domain/array.ts`: where each copy goes (`arrayDeltas`), the dialog's "4 × 4, 16 chips" (`arraySummary`), and the default column count (`defaultColumns`).
- `copiesOf` in `domain/clipboard.ts` builds every copy for one `pasteItems` action, the same action paste uses (PR #28).
- `domain/interaction-duplicate.ts` holds the `duplicate`, `showArray`, `hideArray` and `array` commands. They are registered with the clipboard commands, which keeps `interaction-commands.ts` within its import limit.
- `domain/pieces-bounds.ts` measures a set of pieces; paste, Duplicate and Array share it.
- The Array dialog opens from interaction state (`arraying`), as the keyboard help opens from `help`, so the shortcut, the bar and the chip menu all open it the same way.

## Decisions

1. **Copy positions.** The step between copies is the selection's bounding box rounded up to whole grid steps, plus the spacing. In a grid, the originals are cell 0, so 1 cell with 15 copies in 4 columns is a 4 × 4 block. The summary counts the originals. Out-of-range values are rounded and clamped, not refused.
2. **Grid columns default to ⌈√(count + 1)⌉**, between 1 and 16, until the user edits them.
3. **Duplicate is a fixed step** of one grid step down and right. It doesn't use paste's "land in the middle of the view" rule. The copies become the selection, so repeating it makes a staircase.
4. **Duplicate leaves the clipboard alone.** Copy, Duplicate, Paste pastes what was copied.
5. **Pin names stay unique across copies.** Each copy sees the pins of the copies before it, so an input `A` copied three times gives `B`, `C` and `D`.
6. **After an Array, the originals and all the copies are selected**, so a follow-up Array or move acts on the whole block.
7. **The selection bar is docked, not floating (owner, 2026-11-03).** It sits at the top centre of the canvas, or the bottom centre on phones (`width <= 600px`, above the safe area). It shows only while chips are selected and nothing else is in progress: no drag, wiring, placement, menu, rename, bit picker or open Array dialog.
   - It was first built floating 8 px above the selection. There it covered neighbouring chips, and an e2e click meant for the NAND beside a selected input landed on the bar's Delete. The owner chose the docked bar.
   - Docked, the bar only needs to know whether it shows, so it no longer re-renders on every camera or selection change.
8. **Announcements use the clipboard's form**: "Chips duplicated: {count}" and "Chips added in an array: {count}", matching "Chips copied" and "Chips pasted".

## Calls made while building

- **Routing cost.** One `pasteItems` of 64 copies of a 4-NAND cell with 4 wires (256 parts, 256 wires) takes about 12 ms, so copies are routed as usual. When copies land on top of existing chips, the same paste takes about 70 ms. Array doesn't check for room; see the follow-ups.
- **`withCtrl` is a lookup table**, like the plain keys, to stay under the complexity limit.
- **`Size` is re-exported from `geometry.ts`**, so `interaction.ts` stays within its import limit.
- **Two Delete buttons.** With chips selected, both the editor toolbar and the selection bar have Delete. E2e specs that press Delete aim at the editor toolbar's.

## Follow-ups

- Warn in the Array dialog when the copies would land on other chips, or route copies by shifting the originals' routes.
- `route-perf.test.ts` flakes when the machine is busy (its scaling ratio went just over 3). It passes on its own.
