# Fulxor build sessions in Digital Logic Sim: editor observations

Sources: Fulxor (Dominic LeBoeuf), "How to build a computer TUTORIAL" (51:40, **V1**) and "How to build RAM TUTORIAL" (24:34, **V2**). Both use Sebastian Lague's Digital Logic Sim (DLS).

**Method and limits.** I read the full captions and viewed about 25 sampled frames (60 scene-change frames for V1, 40 for V2). Both videos are edited: wiring is often fast-forwarded ("I'm going to fast-forward through..."), and the narration is about electronics, not UI. The sampled frames catch dialogs, library screens, and finished circuits more than drag gestures. So:
- **Observed** means seen in a frame or heard in the captions.
- **Inferred** means reasoned from the visible UI.
- Cursor mechanics (drag versus click, waypoint creation) are NOT directly observed. They need a 1-2 minute real-time watch or a hands-on DLS session.

## Summary

- DLS has no menu-driven palette. The bottom bar is a single horizontal strip of chip buttons: `MENU | IN/OUT | NAND NOT AND OR NOR XOR XNOR | <user chips...>`. Every saved chip is appended to it in creation order, so it grows into a long, scrolling strip (V1 10:43, V1 38:58). In V2 he trimmed it with a "Starred" list.
- Chips are flat coloured rectangles with the name centred (e.g. `AND` green, `XOR` pink, `NOR` purple, `4B-Adder` grey-blue, `RAM CELL` navy, `8TRI` green, `DFF REG` purple). Pins are small black nubs on the left (inputs) and right (outputs). Wide chips grow taller with pin count.
- Wires are thin dark-red lines (off) that turn bright red/pink when carrying 1. Bus wires are drawn much thicker (V2 22:30). Wires run mostly straight, with right-angle jogs at chosen waypoints (V1 12:43, V2 16:55).
- The circuit's own I/O are round dots on the left/right edge, each with a black name label (`A`, `B`, `Carry`, `Sub`, `Set`, `Reset`, `Q`, `-Q`, `WRITE`, `EN`). Each starts with the default name `IN` or `OUT`, and a rename dialog pops up for each one (V1 06:28, 12:46, 25:12, 28:45).
- Saving a chip uses a modal with a name field and CANCEL / CUSTOMIZE / SAVE (V1 02:41 onward). He saves roughly 20 times in V1 ("save that real quick", "save this", "we saved it").
- Settings (V1 06:05) expose the editing aids: **Snap to grid: Hold Ctrl**, **Straight wires: Hold Shift**, Show grid Ctrl+G, Sim Status Ctrl+Space, steps per clock tick (250) and per second (1000), and I/O / chip pin names set to "On Hover".
- Tidy layout is manual work. Fulxor repeatedly says things like "wire this up real quick" and fast-forwards through wiring; V2 17:55 has "a little bit messed up".

## Interaction table

| Action | How it's done in DLS (observed unless marked inferred) | Where |
|---|---|---|
| Add a chip | Click its button in the bottom bar to enter placement (inferred: click, then click/drop on canvas). Built-ins appear first, user chips are appended. Library screen for the rest. | V1 00:56; bar frames V1 06:41 to 44:22 |
| Browse more chips | A "Library" screen with two lists: **Starred** (left) and **Collections** (right: BASIC, IN/OUT, MERGE/SPLIT, BUS, DISPLAY, MEMORY, OTHER). Buttons: ADD TO STARRED, MOVE UP/DOWN, JUMP UP/DOWN, USE, OPEN, DELETE, STATS, NEW COLLECTION. | V1 36:58 to 37:12; V2 17:27 |
| Chip organisation | Flat list in the bottom bar. A chip can be starred or dropped into a collection. Reorder via MOVE UP/DOWN. Names are abbreviated to fit the bar (`Cntrl Unt`, `PRG CNTR`, `DLtch Reg`, later `HA FA DL DFF`). | V1 36:58; V2 17:27 |
| Move a chip | Drag (inferred). Chips sit loosely on an open canvas, so there is no grid until Ctrl is held. | settings V1 06:05 |
| Multi-select | Said in V2 11:31: "If you hold shift..." (placing several copies). Selection and copy detail is NOT clearly observed. | V2 11:31 |
| Duplicate / place many | "You just click it four times", i.e. repeated placement from the bottom bar (4 RAM cells, V2 11:31). 16 cells were placed this way. | V2 11:31 |
| Delete | "Let me delete this real quick" and "delete our enable pin" in V2 09:12-09:20. He removes pins and chips mid-edit (V1 01:31 "remove one of these"). Method NOT shown. | V2 09:12 |
| Make a wire | From a pin to a pin. Gesture not observed. A bright-red wire to a gate pin is visible in V1 12:43, but the drag itself is not in a sampled frame. | V1 12:43 |
| Branch / join | Several wires fan out from one source with junction dots (V1 12:43; V2 16:28). A small dot marks the join. | V2 16:28 |
| Bend / route wires | Wires have right-angle jogs, so waypoints can be added. **Straight wires** is a hold-Shift setting. Long runs are tidied by hand into parallel tracks (V1 02:17 frame; V2 17:27 final layout). | settings V1 06:05; V2 18:59 |
| Colour wires | Wire colour is state-driven: dark red = 0, bright red = 1. Bus wires are thick brown-red. No per-wire colour choice seen. | V1 12:43; V2 22:30 |
| Wire a bus | Add a BUS-4/8 chip (Library, BUS section, V2 16:28 / 17:27) and connect 4/8-wide chip pins to it. Result is thick parallel bus lines. | V2 11:46-12:19; frame V2 18:59 |
| Add circuit input | IN/OUT button in the bar, then a rename dialog "IN" (selected text). Inputs are round buttons on the left edge. | V1 06:28, 12:46 |
| Add circuit output | Same, dialog default "OUT"; outputs are round "lamps" on the right (red when high). | V1 02:49 to 06:33 |
| Name a pin | Rename dialog (text pre-selected), then CONFIRM. Labels sit on the I/O dots, shown "On Hover" when settings say so. | V1 06:28 |
| Multi-bit I/O | IN-1/IN-4/IN-8 and OUT-1/4/8 chips; MERGE/SPLIT chips (1-4BIT, 1-8BIT, 4-8BIT, 4-1BIT, 8-4BIT, 8-1BIT). The V2 frame at 07:30 shows a thick 8-bit `IN` with 4x2 pin blocks feeding `DFF REG`. | V1 36:58; V2 07:30 |
| Toggle input | Click the round input dot (inferred; the sim shows it flipping on click). He states results ("when both inputs are off the output is on"). | V1 01:00-01:20 |
| Save as chip | Name dialog opened by the Save command; CANCEL / CUSTOMIZE / SAVE. SAVE is greyed until a name is typed. CUSTOMIZE edits chip colour and pin layout (not opened). | V1 02:41, 04:35, 12:20 |
| Chip size/colour | Chosen in CUSTOMIZE (inferred). Colour in the bar and on canvas matches the chip; gates are pre-coloured (AND green, XOR pink, NOR purple). | V1 06:41; V1 12:43 |
| Edit a chip used elsewhere | He opens it in place (library OPEN, or double-click, inferred), edits, saves, then returns ("go back to our RAM cell module", "go back to our CPU"). | V1 36:59; V2 18:07 |
| Zoom / pan | Used constantly. Close-up (V2 18:59) versus whole-circuit overview (V2 22:30). Mouse wheel to zoom and drag to pan (inferred); there is no zoom UI on screen. | V2 18:59, 22:30 |
| Undo | NOT observed. Frame V1 01:44 onward never shows an undo UI. | n/a |
| Keyboard | Ctrl+G grid, Ctrl+Space sim pause, hold Ctrl for snap, hold Shift for straight wires. | V1 06:05 |

## Pain points and opportunities for a touch-first web editor

1. **Layout is entirely manual and wiring is the time sink.** Long runs (V2 22:30: dozens of bus wires, tracks routed around RAM cells) and the "wire it up real quick" fast-forwards show wiring dominates. A web editor could offer:
   - auto-route (orthogonal wires that avoid chips);
   - always-on snap, not "hold Ctrl", which is unusable on touch;
   - "tidy wires / align" per selection.
2. **Straight wires and snap are modifier-keys.** Hold Shift and hold Ctrl (V1 06:05) have no touch equivalent. Make them toggles in a toolbar and default snap to on.
3. **Everything gets renamed one pin at a time through a modal.** Every IN/OUT starts as `IN`/`OUT` and pops a dialog (V1 06:28, 12:46, 25:12, 28:45; V2 21:30). For a 4-bit adder that is 12+ dialogs. Better: inline label editing, auto-naming (A0..A3), and "make N-bit pin" in one step.
4. **Mislabelled and forgotten pins mean re-editing.** "I forgot this one crucial part", "I got to carry these together. My bad" (V1 12:10; 09:53). Easy insertion of a pin into an already-saved chip, with existing uses patched, would help.
5. **The chip library is a flat, growing bottom strip.** User chips are appended in creation order, so the bar overflows (V1 44:22: `CPU` `4AND` `Cntrl Unt` `T FF` `PRG CNTR`). He abbreviates names to keep it usable (V2: `HA FA DL DFF`) and manages a Starred list. Offer search, tags/categories, favourites, and a searchable bottom sheet on phone.
6. **Repeated placement is click-by-click.** "You just click it four times", 16 cells (V2 11:31). Offer duplicate / array-place ("4x4 grid"), copy-paste with pins, and a pattern or bit-slice tool.
7. **Bit-width plumbing needs many chips.** MERGE/SPLIT variants (1-4, 1-8, 4-8, ...) and BUS-1/4/8 are separate library items (V1 36:58, V2 17:27). Make width a property of a pin and show one thick wire for N bits.
8. **Editing a chip used elsewhere is a back-and-forth.** He saves and returns repeatedly (V1 36:59; V2 18:07). A "edit in context" mode and clear dirty/saved indicator would reduce this.
9. **Zoom level is critical.** The same circuit is unreadable at overview scale (V2 21:30 frame: tiny labels) and he works zoomed in. Touch needs pinch zoom, double-tap-to-fit, and a minimap.
10. **No visible undo or select-box.** Selection/undo are unobserved. Both should be first-class on touch (undo button, lasso select, long-press menu).

## Representative frames

- **V1 06:19-06:41, SR latch.** Grey canvas. Two purple NOR gates in the centre, two input dots on the left labelled `Reset` and `Set`, two output dots on the right labelled `Q` and `-Q` (the second bright red, i.e. high). Cross-coupled bright-red feedback wires cross diagonally. The bottom bar shows `MENU` highlighted, then `IN/OUT NAND NOT AND OR NOR XOR XNOR Half Adder Full Adder 4B-Adder ALU SR`.
- **V1 12:43, ALU front end.** Four pink `XOR` gates in a column feed a grey-blue 4B-Adder chip. A big `Sub` input at the bottom-left is lit red, with red branch wires going up to every XOR and to the adder carry-in. Outputs on the right: `Carry/0` lit, then four `OUT` dots. Wires are straight with right-angle bends.
- **V1 36:58-37:12, library screen.** Two columns. Left: a scrolling list (`Half Adder`, `Full Adder`, `4B-Adder`, `ALU`, `SR`, `D Latch`, `DLtch Reg`, `MS DLtch`, `MS Dltch Reg`, `CPU` highlighted, `T FF` highlighted). Middle: collections (BASIC, IN/OUT, MERGE/SPLIT, BUS, DISPLAY, MEMORY, OTHER). Right: buttons REMOVE FROM STARRED, MOVE UP/DOWN, USE, OPEN, DELETE, NEW COLLECTION. Expanded, MERGE/SPLIT lists 1-4BIT ... 8-1BIT.
- **V2 07:30, RAM cell skeleton.** A thick 8-bit `IN` bus (a 4x2 block of dark-red pin squares) on the left goes into a purple `DFF REG` chip, then a green `8TRI` tri-state buffer, then a black `OUT` bus stub. Four round input dots stacked below, labelled `Y`, `X`, `WRITE`, `EN`.
- **V2 22:30, full RAM.** Overview of 16 navy `RAM CELL` chips in four columns, joined by thick bus loops arching across the top and bottom. Left: two groups of green `AND` gates plus `N` inverters, i.e. the address decoders, with a handful of lit bright-red wires. Everything is tiny. Wire spacing is hand-adjusted and some lines run diagonally.

Cleanup: downloaded media and sampled frames were deleted from the scratchpad.
