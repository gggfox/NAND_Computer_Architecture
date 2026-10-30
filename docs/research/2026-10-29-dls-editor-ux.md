# Digital Logic Sim: editor UX research (2026-10-29)

Scope: the circuit EDITOR of Sebastian Lague's Digital Logic Sim (DLS). Save format and
simulation are covered in `2026-10-29-strict-template-stack.md` §0 and not repeated.

Sources: `github.com/SebLague/Digital-Logic-Sim` @ `7aeb66d` (2025-05-05, "v2" Unity/C#); paths below
are relative to `Assets/Scripts/`. Videos: "Exploring How Computers Work" (`QZwneRb-zqA`, 18:12, "V1")
and "How Do Computers Remember?" (`I0-izyq6q5s`, ~19:00, "V2"); these show the old v0 editor.
Timestamps are from captions plus sampled frames (not a full frame-by-frame watch).
Code line ranges were read directly; the "px" figures are my arithmetic, marked (calc).

## 1. Summary

- DLS is **mouse + keyboard only**. There is no touch code at all (`grep -i touch` returns nothing;
  `Seb/Helpers/Input/InputHelper.cs` wraps mouse, keys, scroll). Right-click, hover, Alt/Shift/Ctrl
  modifiers and scroll wheel carry a lot of the design. Touch is not a port; it is a redesign.
- Core model is a **world-space canvas on a grid** (`GridSize = 0.125`), orthographic camera, with a
  separate fixed 16:9 screen-space UI layer (bottom bar, popups). Everything pin-related is sized in
  grid units, so geometry rules are simple and portable.
- The **chip is a rectangle with pins on its left (inputs) and right (outputs) edges only**.
  Height is computed from pin count and bit-width; width from name length; user can only enlarge it.
  Pin order on a saved chip comes from the Y position of the circuit's IN/OUT pins (top to bottom).
- **Placement is "ghost follows cursor, click to drop"**; overlap with another element makes the drop
  illegal (red). Shift/Alt keeps stamping copies. This depends on hover and does not map to touch.
- **Wiring = press on a pin, drag or click-click with waypoints, release/click on a compatible pin or on
  an existing wire** (branch). Wires can only join source-to-target; wire-to-wire joins are limited.
- Wires are **edited in a dedicated mode** (context menu "Edit"): drag vertices, insert at hover point,
  Delete removes a vertex. Good model, but entered via right-click.
- **Undo/redo is per-chip, action-based**, covering move/add/delete/wire add/delete (`UndoController.cs`).
- **Editing a chip used elsewhere** works by chip name: save rewrites parent chips; removed pins drop
  their wires (`Project.cs:178-217`, `UpdateAndSaveAffectedChips`). A chip cannot contain itself.
- Biggest touch blockers: pins are ~20 px at 1080p default zoom (calc); left-drag on empty canvas is
  box-select so panning needs Alt/middle-mouse; context menu is right-click only; no tap-to-place.

## 2. How DLS does it (per interaction)

| Interaction | Behaviour | Code | Video |
|---|---|---|---|
| Pick a chip to place | Click a button in bottom bar -> `StartPlacing(desc)`; chip is created at mouse and follows it. Collections (starred folders) open a popup; Ctrl/Alt/Shift-click on a collection takes its first chip. | `Graphics/UI/Menus/BottomBarUI.cs:150-232` (placing at 207-232), `Game/Interaction/ChipInteractionController.cs:861-940` | V1 3:09 (only AND, NOT buttons), 4:12 (new chip appears in bar) |
| Drop chip | Left click `FinishPlacingNewElements`; refused if any element `IsValidMovePos == false` (bounding boxes overlap another element). Invalid = red selection box. | `ChipInteractionController.cs:582-620`, `753-764`; colours `DrawSettings.cs:92-95` | n/a (v0 has no overlap rule visible) |
| Stamp many | Hold Shift/Alt while dropping: `DuplicateElements(newlyPlaced)` restarts placement. Shift+scroll while placing several adds vertical spacing. | `ChipInteractionController.cs:616-619`, `246-251` | n/a |
| Cancel placement | Right-click, Esc, or Delete/Backspace. | `ChipInteractionController.cs:433-444`, `210-235` | n/a |
| Select one | Mouse **down** on a chip selects and immediately starts moving (no drag threshold, no hold). | `ChipInteractionController.cs:505-510`, `801-814` | n/a |
| Multi-select | Shift or Alt+click toggles; drag from empty canvas = box select (chips by centre point, dev pins by overlap); Shift/Alt keeps existing selection. | `ChipInteractionController.cs:407-431`, `511-516`, `652-669`; `SubChipInstance.cs:121`; `DevPinInstance.cs:83-87`; `KeyboardShortcuts.cs:48` | n/a |
| Move | Drag selection; snap uses the element's *first pin* as anchor (`SnapPoint`) so pins land on grid lines. Wires whose both ends are in the selection move wholesale; others stretch. Illegal pos on release cancels the move. | `ChipInteractionController.cs:688-798`, `555-580`; `SubChipInstance.cs:111-119`; `GridHelper.cs` | V1 3:50 |
| Straight-line move | Hold Shift; locks to the first dominant axis (0.035 world-unit threshold). | `ChipInteractionController.cs:735-749`, `1059-1064` | n/a |
| Duplicate | Alt/Shift+D: copies selection (and wires fully inside it, plus linked bus partner), enters placement with relative layout preserved. | `ChipInteractionController.cs:202-208`, `310-405`; `KeyboardShortcuts.cs:23` | n/a |
| Delete | Delete/Backspace: selection, else wire under mouse, else the hovered vertex in wire-edit mode. Context menu "Delete" too. Bus origin/terminus delete together. | `ChipInteractionController.cs:117-178`, `210-224` | n/a |
| Start wire | Mouse down on a pin -> `WireToPlace`, free end follows mouse. | `ChipInteractionController.cs:478-483`, `547-553` | V1 3:20-3:50 |
| Waypoints | While wiring, left click on empty canvas adds a vertex (`CanAddWirePoint`); Delete removes the last vertex, or cancels when none left. | `ChipInteractionController.cs:459-468`, `847-859`, `210-216`; `WireInstance.cs:220,234-243` | V2 2:00 (curved in v0) |
| Finish wire | Mouse up (drag style) or click (click-click style) on a valid pin or wire. Hovered pin turns dark grey if invalid. | `ChipInteractionController.cs:672-678`, `816-845`; `DevSceneDrawer.cs:863-868` | V1 3:50 |
| Validity rules | Needs source+target (unless a wire end is involved), equal bit counts; no wire-to-wire; source pin to wire only when the wire is a bus wire; bus ends only with their linked partner. | `ChipInteractionController.cs:76-113` | n/a |
| Branch from a wire | Mouse down on a wire (not in edit mode) starts a new wire anchored at the closest point on that wire (`connectionPoint` + segment index); drawn with a dot (radius 0.06). Ending on a wire works too. | `ChipInteractionController.cs:485-502`, `527-545`; `DevSceneDrawer.cs:754-761` | n/a |
| Edit wire | Right-click wire -> EDIT: vertices shown as dots (r 0.07); drag vertex; click on segment inserts vertex (white insertion dot r 0.04); first/last vertex fixed unless it joins a wire; Enter/Esc/click empty exits. | `ContextMenu.cs:96-100,376-379`; `DevSceneDrawer.cs:790-838`; `ChipInteractionController.cs:486-496`, `622-639` | n/a |
| Delete wire | Hover + Delete, or context menu. | `ChipInteractionController.cs:144-148,171-178` | n/a |
| Straight/snapped wires | Pref "Snap to grid" and "Straight wires": `Hold Ctrl/Shift`, `If grid shown`, `Always`. Straight = axis-lock from previous point. | `Game/Project/Project.cs:481-482`; `WireInstance.cs:207-218`; `PreferencesMenu.cs:34-46` | n/a |
| Add circuit input/output | They are "chips" in the bottom bar **IN/OUT** collection (IN/OUT x 1/4/8-bit) placed like any element; become `DevPinInstance`. IN/OUT is starred by default along with NAND. | `Game/Project/BuiltinCollectionCreator.cs:8-34`; `ChipInteractionController.cs:942-955`, `DevPinInstance.cs` | V1 3:09 (v0: pins pre-exist at left/right edge of a bounded box; no add/remove) |
| Toggle input | Click the state indicator (circle for 1 bit, 2x2 / 4x2 grid of squares for 4/8 bit, one square per bit). Only input pins, only when editing (not view mode), not while wiring. Sim paused still updates (separate `PlayerInputState`). | `DevSceneDrawer.cs:597-680`; `DevPinInstance.cs:120-123`; `PinInstance.cs:71-79` | V1 3:26, V2 1:52 |
| Rename pin / bit display | Right-click pin -> EDIT: text field (max "MY LONG PIN NAME" chars), plus decimal display mode wheel (off/unsigned/signed/hex) for multi-bit. Enter confirms, Esc cancels. | `PinEditMenu.cs:12-105`; `ContextMenu.cs:83-94,410-414` | V2 1:14 (SET/RESET labels shown on pins) |
| Pin colour | Context menu colour list on input pins / sub-chip output pins (8 colours). | `ContextMenu.cs:27-30,358-369`; `DrawSettings.cs:64-86` | n/a |
| Show pin names | Pref per scope (I/O pins, chip pins): Always / On hover / Tab toggle. | `DevSceneDrawer.cs:90-133`; `Project.cs:146-149,161-163`; `PreferencesMenu.cs:17-26` | V2 1:36 (labels always on) |
| Instance label | Context menu LABEL: text under the chip. | `DevSceneDrawer.cs:208-221`; `ChipLabelMenu.cs` | V2 10:30 (labels A, B drawn as header band in v0) |
| Pan / zoom | Pan: middle-drag or Alt+left-drag. Zoom: wheel (zoom-to-cursor) or Alt+right-drag; ortho size 0.2-64, start 5. View state remembered **per chip name**. Ctrl+R resets. Open chip auto-fits contents. | `Game/Interaction/CameraController.cs:15-19,77-158,184-253` | n/a (v0 canvas is fixed-size) |
| Context menu | Right-click on chip/pin/wire; items vary by type (VIEW, OPEN, LABEL, DELETE, FLIP, EDIT, REBIND, colours). Opens anchored to cursor, expands up/down by screen position. | `ContextMenu.cs:128-224`, `266-334` | n/a |
| View inside a chip | Context menu VIEW pushes a read-only copy bound to the live sim state on `chipViewStack`; banner with Back (or Esc). `CanEditViewedChip` = stack depth 1. | `Project.cs:38-45,121-144`; `ViewedChipsBar.cs` | n/a |
| Open another chip to edit | Context menu OPEN or library; prompts if unsaved changes. | `ContextMenu.cs:416-437`; `Project.cs:60-84` | n/a |
| Save as chip | Menu SAVE (Ctrl+S): name field + buttons CANCEL / CUSTOMIZE / SAVE (or CANCEL / CUSTOMIZE / RENAME / SAVE AS when the name changed). New chips are auto-starred to the bottom bar. Name rules: non-empty, valid filename, unique unless it is the active chip. | `ChipSaveMenu.cs:13-41,55-114,145-156,166-170`; `Project.cs:178-216` | V1 4:12 (type name at top-left, "Create" button; truth table pops up), 4:40 |
| Chip look | CUSTOMIZE screen: name location (Middle/Top/Hidden), colour picker + hex field, drag triangular handles on 4 sides to resize (height snaps so pins stay on grid, width snaps to even grid when snapping), place in-chip displays. | `ChipCustomizationMenu.cs:45-107`; `Graphics/World/CustomizationSceneDrawer.cs:293-345` | V2 10:30 (orange chip, name band on top) |
| Edit a chip used elsewhere | Saving calls `UpdateAndSaveAffectedChips`: parents re-saved; rename rewrites names in parents; pins whose ID disappeared have their wires removed in parents. Delete removes instances from parents. `CanAddSubchip` blocks self-containing cycles (button greyed). | `Project.cs:178-197`, `306-470`; `DevChipInstance.cs:178-186`; `BottomBarUI.cs:205-207` | n/a |
| Undo / redo | Ctrl+Z / Ctrl+Shift+Z. Per-chip list of typed actions: move, add/delete elements, add/delete wire (delete stores a full wire-state snapshot). Not pin rename/colour/label. | `UndoController.cs:10-120`; `ChipInteractionController.cs:190-191` | n/a |
| Unsaved changes | `ActiveChipHasUnsavedChanges` compares last-saved description vs current; popup on New/Open/Quit. | `Project.cs:218-227`; `UnsavedChangesPopup.cs` | n/a |
| Library / search | Ctrl+L library (collections with chips, starred list reorderable); Ctrl+F search popup with recent chips. | `ChipLibraryMenu.cs:125-210`; `SearchPopup.cs`; `BottomBarUI.cs:388-391` | V1 bar grows: AND NOT NAND OR XOR |

## 3. Pin and chip anatomy

World units; `GridSize = 0.125` (`DrawSettings.cs:12`). Default camera ortho size 5 (10 units tall).

**Pins on a chip** (`DrawSettings.cs:13-26`, `SubChipInstance.cs:143-211`, `PinInstance.cs:44-61`)
- 1-bit pin: filled circle, diameter 0.185 (`PinHeight1Bit`), black, hover = white, invalid-target = dark grey.
- 4-bit pin: pill/rect 0.3 tall x 0.176 wide (0.95 x diameter). 8-bit: 0.43 tall. Multi-bit pins are the only bus display on the chip edge; no bit count text on the chip.
- Layout slots (in grid cells, top to bottom): 1-bit = 2, 4-bit = 3, 8-bit = 4 (`CalculateDefaultPinLayout`). Min chip height = sum of slots x 0.125. Extra height is spread evenly between pins. A single pin is vertically centred.
- Inputs on the left edge, outputs on the right (`faceRight = isSourcePin`; buses can flip). Pin centre sits at the chip edge: `x = size.x/2 + 0.05/2 - 0.015`, so it overlaps the outline by about half.
- Hit area: 1-bit circle r = 0.185/2 + 0.015, offset 0.02 outward; multi-bit is the drawn rect. Whole chip body is a separate hit target; pin wins if mouse is over both (`DevSceneDrawer.cs:298-306`).
- Chip width: max(name text width + 0.125, 4 x pin radius). Min height: max(pin stack, 3 cells, or 4 cells for two-line names). Two-line names split at the space that best balances lengths when name > 6 chars (`SubChipInstance.cs:289-366`).
- Chip body: rect + 0.05 darker/lighter outline; name font 0.25 (JetBrains Mono Bold), black/white text chosen by luminance, name at Middle, Top (with a darker header band) or Hidden. Selection box padding 0.08; selection tint white 10%.
- Pin label: font 0.2 bold, white on 70% black pill, 0.15 x 0.1 padding, offset 0.05 outward from the pin (`DevSceneDrawer.cs:193-206`). Chip label sits 0.2 below the chip.

**Circuit I/O pins (DevPin)** (`DevPinInstance.cs`, `DevSceneDrawer.cs:585-695`)
- Three parts in a row: state indicator, line (0.03 thick), handle + pin. Handle is a thin grey bar (width 0.128, height of the indicator) used to grab/move the element. Pin sits 6 cells (1/4 bit) or 9 cells (8 bit) from the handle.
- State indicator: 1-bit circle r 0.2 with 0.0175 outline. 4-bit: 2x2 squares, 8-bit: 4x2, each 0.21 (drawn at 0.9). Bit order: MSB top-left.
- Multi-bit pins show a decimal/hex readout under the indicator (font 0.2, dark 17% backing).
- Pins are also ordered by Y when the chip is saved (`SaveSystem/DescriptionCreator.cs:50-53`), so *layout is semantic*: moving an IN pin above another reorders the chip's pins.

**Wires** (`DrawSettings.cs:27-28`, `DevSceneDrawer.cs:728-788`, `WireLayoutHelper.cs`)
- Polyline of straight segments, thickness 0.025 (highlight 0.037). Hit distance about 0.05 from the line.
- Multi-bit wire is drawn as N parallel strands (offset 2 x thickness x 0.925), alternating strands slightly lighter; strands flip sides on hairpin bends (dot < -0.75). Not a single fat line.
- Draw order: placing wire on top; edit-mode wire; bus wires; higher bit-width; HIGH above LOW; child wires beneath parents (`DevSceneDrawer.cs:941-963`).
- Wire colour = driving pin's state colour (8 hue palettes, each with low/high/hover; disconnected = black). Unconnected wire in progress is black.

**Colours** (`DrawSettings.cs:60-113`): background `#424245`, grid `#313133` (lines 0.0035, skipped by zoom: every line < ortho 8, every 4th < 32, else every 16th); pin black; HIGH red `(0.95,0.3,0.31)`, LOW dark red `(0.2,0.1,0.1)` for default palette. UI panel 41/255, bottom bar 29/255, library chip button highlight `(0.32,0.61,0.85)`.

**UI layer** (`Seb/SebVis/UI/UI.cs:20,77-100`, `BottomBarUI.cs:14-17`): fixed 100 x 56.25 unit 16:9 canvas, letterboxed on any other aspect. Bottom bar 3 units tall; buttons 2.4 tall with 0.25 gaps; `MENU` button then horizontally scrollable starred chips. Chip buttons are text only, in the chip's name; bar scrolls by wheel or middle-drag.
(calc) At 1080p / ortho 5 = 108 px per world unit: grid 13.5 px, 1-bit pin 20 px, wire 2.7 px, indicator 43 px, bar 58 px, button 46 px. On a 390 x 844 phone the 16:9 UI would be about 219 px tall and a 1-bit pin about 16 px.

## 4. Keyboard shortcuts (`Game/Interaction/KeyboardShortcuts.cs`)

| Keys | Action |
|---|---|
| Ctrl+N / S / L / P / Q / F | New chip / Save chip / Library / Preferences / Quit to main menu / Find chip |
| Ctrl+Z, Ctrl+Shift+Z | Undo, redo |
| Alt+D or Shift+D | Duplicate selection |
| Delete / Backspace | Delete selection, wire under mouse, last wire point, or cancel placement |
| Esc | Cancel everything; close menu/popup; Back when viewing a sub-chip |
| Enter | Confirm in menus; exit wire-edit mode |
| Ctrl (held) | Snap to grid |
| Shift (held) | Straight-line move / straight wires |
| Shift or Alt (held) | Multi-mode: add to selection, keep placing copies, box-select additively |
| Shift+scroll | Vertical spacing while placing several |
| Ctrl/Alt/Shift + click collection | Place the collection's first chip without opening it |
| Alt+left drag, middle drag | Pan |
| Wheel, Alt+right drag | Zoom |
| Ctrl+G, Ctrl+R | Toggle grid, reset camera |
| Tab | Toggle pin names ("Tab to toggle" mode) |
| Space, Ctrl+Space | Step sim when paused, toggle pause |
| Mouse: right-click | Context menu; cancels placement |

## 5. What will NOT translate to touch (and why)

- **Right-click context menu** (the entry point for rename pin, edit wire, delete, view, open, label, colour). No secondary button. Needs long-press or a visible selection toolbar.
- **Hover**: pin highlight, "pin under mouse wins over chip", on-hover pin names, wire hover highlight, hover validity colour while wiring, insertion dot on wire edit. Touch has no pre-contact state; targets must be resolved at press time with generous slop and feedback during drag.
- **Ghost chip following the cursor, then click to drop**: needs a pointer position before contact. Touch alternatives: drag from the library onto the canvas, or tap to drop at screen centre and then move.
- **Mouse-down selects and drags immediately; empty-canvas drag = box select**: collides with one-finger pan, and pinch needs a second finger. Panning needs two-finger drag or a pan tool; box select needs a mode.
- **Modifier keys** (Shift/Alt/Ctrl multi-mode, snap, straight line, duplicate, stamp): need on-screen toggles (multi-select mode, snap/straight in a toolbar) and a Duplicate button.
- **Scroll-wheel zoom, middle-drag, Alt-drag**: replaced by pinch and two-finger pan.
- **Pin hit size**: 20 px (calc) at default zoom, 16 px on phone-sized screens; WCAG 2.5.8 wants 24 px minimum and platform guidelines 44-48 px. The DLS layout assumes zoom-in for precision. Web needs a larger invisible hit area for pins (and a magnetic snap-to-nearest compatible pin during wire drag) or an enlarged "touch mode" scale.
- **Wire hit width** (about 0.05 world units, ~5 px): essentially untappable by finger. Branching from a wire and selecting a wire need a larger tolerance or a "tap pin or junction" model.
- **Tiny text-only bottom bar with a scrolling strip** (46 px high, driven by wheel/middle-drag), fixed 16:9 letterboxed UI: does not adapt to portrait phones; the web layout must be responsive, not scaled.
- **Escape / Delete as the only way to undo a half-finished action** (wire in progress, placement): need visible Cancel/Undo buttons.
- **Tab to toggle pin names**, Ctrl+key shortcuts: keyboard-only affordances; on touch they need toolbar buttons.
- **Screen readers**: DLS draws everything to a canvas (custom `Seb.Vis` renderer); there is no semantic tree. A11y must be designed from scratch (see ideas).

## 6. Differences between V1/V2 videos (old v0) and the current code

- v0 canvas is a **fixed bordered rectangle** (V1 3:12 frame); IN/OUT dots at the left/right borders are pre-placed, not added from a library. Current: infinite pannable canvas, IN/OUT are placeable elements, with 1/4/8-bit variants.
- v0 wires are **smooth curves** (Bezier-like, V2 2:00, 11:05 frames); current wires are **polylines with user waypoints** (`WireInstance.cs`).
- v0 buses were drawn as a **bracket on the left grouping 4 stacked pins with a decimal readout** (V1 11:08 frame); current has real 4/8-bit pins and multi-strand wires plus Merge/Split and Bus chips.
- v0 bottom bar: `CREATE` button first, then chips (`AND NOT NAND OR XOR ADDER ...`); current: `MENU` button first, starred chips and collections after it; "Create" is now Save (Ctrl+S) with a customize step.
- v0 truth table pops up automatically when creating the chip (V1 4:14 frame). Not found in the current repo code I read.
- v0 name entry is large type in the top-left (V1 4:14); current is a centred modal with CANCEL / CUSTOMIZE / SAVE buttons.
- v0 chips show an instance label as a header band ("A", "REGISTER (4-bit)", V2 10:30); current has Name location Top and a separate per-instance LABEL under the chip.
- v0 had no visible tri-state, unconnected-input colour; current distinguishes disconnected (black) wires.

## 7. Ideas worth keeping

1. **Pin layout rules in grid cells** (2/3/4 cells per 1/4/8-bit pin, even spacing of slack, chip height = sum) are simple, deterministic and easy to implement as pure functions; reuse them, possibly with a larger cell for touch.
2. **Pins ordered by Y position of the circuit's IN/OUT pins** gives a direct-manipulation way to define a chip's interface order. On touch also offer reorder handles.
3. **Inputs toggled from a per-bit state indicator**, one square per bit, MSB first; decimal/hex/signed readout for multi-bit. Visible, discoverable, no hover needed.
4. **Wire colour follows the driving pin; HIGH drawn above LOW** (and multi-bit above single-bit): readable at a glance.
5. **Validity feedback while wiring** (pin turns grey if the connection is illegal; compatible wires highlight) and **bit-width equality as the single rule** make wiring errors self-explanatory.
6. **Wire-edit mode** (explicit, vertices as dots, insertion dot) is a clean touch-friendly model if entered by tapping a selected wire.
7. **Placement legality via bounding boxes with red tint, refuse drop**, plus **cancel-restores-original-position** on invalid move.
8. **Per-chip remembered camera and fit-to-contents on open**.
9. **Unsaved-changes comparison by description diff** (not a dirty flag) and **parents rewritten on pin removal** keep the library consistent.
10. **Cycle prevention at the library button** (greyed out if the chip would contain itself), which avoids an error dialog.
11. **Pin-name display preference** (Always / On hover / Toggle). On touch, "toggle" and "always" suffice; "hover" becomes "show for selected chip".
12. **Starred bar + collections popup** as quick access; **Find chip** with recents.
13. **Read-only "view inside" stack** with a Back banner and live signals, useful for teaching.
14. Things to fix rather than copy: no touch; right-click-only actions; no bit-width change after placing a pin (must delete and re-add); no keyboard/AT access; tiny hit targets; fixed 16:9 UI.
