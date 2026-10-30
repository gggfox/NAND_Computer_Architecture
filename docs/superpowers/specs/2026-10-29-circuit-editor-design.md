# Circuit editor: design

Date: 2026-10-29. Status: draft, awaiting owner approval.

This is the second design. It builds on the strict template (`docs/superpowers/specs/2026-10-29-strict-template-design.md`, ADRs 0001–0036, PR #1). The template shipped a thin demo: a fixed 2-input NAND circuit with no wiring, dragging, deleting or pin editing. This design adds the real editor. Research behind it:

- `docs/research/2026-10-29-dls-editor-ux.md`: Lague's editor code and videos.
- `docs/research/2026-10-29-fulxor-build-sessions.md`: how a heavy user builds in Digital Logic Sim (DLS).

The decisions below were made with the owner in this session, using browser mockups.

## 1. Intent and why

The owner wants to build Nand2Tetris-style circuits on a phone, a tablet or a desktop with as little friction as possible. DLS is mouse-and-keyboard only: right-click menus, hover-only pin names, modifier keys, and pins about 16 px on a phone. Its heaviest users lose most of their time to repetitive manual work:

- tidying wires by hand;
- placing 16 identical chips one by one;
- typing pin names into dialogs, one per pin;
- an overflowing chip bar;
- save, go back and redo whenever a chip used elsewhere changes.

This editor should feel better than DLS the first time someone builds a half adder on a phone. Touch, mouse, keyboard and screen readers are all first-class (ADR 3, WCAG 2.2 AA).

## 2. Goals (all ship in this version: the owner chose "ship all")

1. **Chips show their pins.** Pin names are always visible on the chip, and bus pins look different from 1-bit pins.
2. **Wiring.** Tap a pin, then tap another, with automatic clean routing and animation. Dragging from pin to pin also works. A wire's route can be adjusted by hand.
3. **Moving.** Drag chips with a finger or the mouse. Wires follow.
4. **Library.** Search, starred chips, folders and tags. Drag a chip from the library onto the canvas, or use a quick-add menu at the press point.
5. **Circuit inputs/outputs.** Placed freely on the canvas and managed in a Pins panel: name, bit width and order. No naming dialogs.
6. **Bulk work.** Selection, Duplicate (copy/paste), Array, wiring several pins at once, and "Suggest wires" (autocomplete).
7. **Delete.** Remove chips, wires and pins, all undoable.
8. **Chips with a saved version and a draft.** Edits to a chip are a draft until saved. Saving updates every chip that uses it.
9. **Navigation.** Pinch or scroll to zoom, pan, and a minimap. A toolbar switch decides what a one-finger drag on empty canvas does: pan or select.
10. **Accessibility.** Every action above can be done with the keyboard and from the screen-reader circuit view.

## 3. Non-goals and anti-goals

**Non-goals:**
- Real-time collaboration.
- Cloud sync and accounts (Convex later).
- Share links (later; ADR 6).
- Lague save-file import.
- Clock and display parts beyond the existing built-in clock.
- Custom themes.

**Anti-goals (my calls; the owner had none beyond "everything works"):**
- A drag or a wire animation that stutters on a mid-range phone.
- Any target smaller than 24 px.
- Any action that exists only on hover or right-click.
- Losing an edit because of a mode change.
- A suggestion or auto-route that changes the circuit without the user confirming it.

## 4. Constraints

- **The template's rules stand:** strict TS 7, oxlint boundaries, Result and error unions, Zod at trust boundaries, Paraglide en/es, React Aria behind `src/shared/ui`, the engine in a Worker, and the Canvas 2D renderer outside React.
- **Every edit is an action** (ADR 8): new behaviours are new `EditorAction` variants through the reducer, so undo/redo, keyboard, screen reader and E2E share one path.
- **Feature folders** (ADR 23). New code goes into `circuit-editor`, `chip-library`, `projects`, `simulation` and `accessibility`.
- **The save format is still a draft** (ADR 33). This design changes it: chip versions, pin order, manual waypoints and folders/tags. No migration is required yet.
- **Pin numbering ruling** (Task 12) is generalised here. Each instance has one pin-index space. A custom chip's pins are numbered by the Pins panel order: inputs first, then outputs.

## 5. Decisions the owner made

### 5.1 Chip and pin anatomy (mockup option A)
- A chip is a flat rounded rectangle in its chosen colour, with its name centred.
- Input pins sit on the left edge and outputs on the right. **Each pin's name is always visible inside the chip, next to the pin.**
- Bus pins are taller tabs labelled with their width, e.g. `d[4]`.
- The chip grows with pin count and name length. Use Lague's grid rule: a 1-, 4- or 8-bit pin takes 2, 3 or 4 grid cells, slack is spread evenly between pins, and width comes from the name.
- Pins show their level with the theme's signal colours, plus the dashed low cue.
- **Hover on desktop, or long-press on touch, over a pin** shows a card with its full name, width, live value (`0101 = 5`) and connections.
- **Long-press or right-click on a chip body** opens its menu: rename, recolour, duplicate, delete, look inside.
- The same information is exposed to screen readers.

### 5.2 Wiring
- **Tap a pin:** it highlights and starts a visual "armed" state. Legal targets stay bright; illegal ones fade, as when bit widths differ or two outputs would be joined.
- **Tap a second pin:** the wire animates in along an automatically computed clean route that avoids chips (right-angle segments, ADR 9).
- Tapping empty canvas or pressing Esc cancels the armed state.
- Dragging from pin to pin also works.
- **Long-press a wire** (or right-click it) to adjust its route by moving bends.
- **Branching:** an output can feed many inputs. Starting from a wire branches from its source, as in DLS. *(my call)*
- **Change from ADR 9:** auto-routing is now in this version, not "later". A new ADR records this.

### 5.3 Canvas navigation and selection
- **Toolbar switch for a one-finger drag on empty canvas:** Pan or Select (box/lasso), like the hand and arrow tools in Figma or Excalidraw.
- Pinch, two-finger drag, the scroll wheel and holding Space while dragging always pan and zoom.
- There is a minimap.
- Dragging a chip moves it, snapped to the grid. Its wires follow and re-route.

### 5.4 Library and adding chips (mockup option B)
- **Library button:** a bottom sheet on phones and a side panel on desktop. It has search, a starred filter, the user's folders and tags as filter chips, and a grid of chip tiles in their colours.
- **Drag a tile onto the canvas.** A ghost follows the finger and the chip drops where released.
- **Quick-add menu:** opens on long-press or right-click on empty canvas, at the press point. It has search, recent and starred chips, input/output pins, and paste. A chip picked there lands at the press point.

### 5.5 Circuit inputs and outputs (between options B and C)
- Input and output pins are pieces placed anywhere on the canvas, from the library or quick-add menu.
- They are auto-named (`A, B, C…` / `OUT1, OUT2…`, my call), renamed in place by tapping the label, and toggled by tapping an input's value.
- Multi-bit pins show their bits plus a decimal readout.
- **Pins panel** (header button "Pins N"; a sheet on phones, a side panel on desktop):
  - lists inputs and outputs;
  - rename, set bit width (1/4/8/16), drag to reorder, and add an input or output;
  - selecting a row highlights the pin on the canvas, and the other way round.
- **The panel's order is the pin order on the saved chip.** The canvas shows ① ② order badges.
- Deleting a wired pin removes its wires; undo restores them.

### 5.6 Chips: saved version and draft
- Every chip has a **saved version** and a **draft**.
- Editing changes the draft, which is autosaved so nothing is lost. Every chip that uses it keeps running the **saved** version.
- **Save** promotes the draft. Every parent picks up the change (refines ADR 5).
- **Opening a chip from inside a parent** shows breadcrumbs (`Full adder › Half adder`). The user edits, saves, and goes back.
- **When saving changes the pin set:**
  - a removed pin removes the pin and its wires in every parent;
  - a renamed pin only updates the label, because pins have stable IDs.
  - The save confirmation lists the effects, e.g. "Removes 3 wires in Full adder". *(my call)*
- Saved chips appear in the library and are dragged in like any other chip.

### 5.7 Bulk work
- **Duplicate:** copy/paste of the selection, keeping internal wires and dropping wires to chips outside it. *(my call)*
- **Array:** with a selection, choose a count, direction (row, column or grid) and spacing. Copies are placed snapped to the grid.
- **Wiring several pins at once:** select several pins, then tap a source.
  - A 1-bit source fans out to all of them.
  - A multi-bit source is wired bit by bit in selection order. *(my call)*
- **Suggest wires (autocomplete):**
  - It proposes connections for unconnected pins, first by matching or similar names (`clk`→`clk`, `d0..d3`→`q0..q3`), then by the only legal option.
  - Proposals show as ghost wires: accept all, accept one, or dismiss.
  - It never wires anything without confirmation.

### 5.8 Delete and undo
- Select chips, wires or pins, then press Delete, use the menu entry, or long-press → Delete.
- Removing a chip removes its wires. Everything is undoable through the existing session-only history (ADR 22).

### 5.9 Language in the URL
- The language stays **out** of the URL. A recipient sees their own saved choice or their browser language.
- This keeps the current behaviour; it is recorded as an ADR.

### 5.10 Buses and single bits (owner decision: both)

- **Bit taps.** While a 1-bit wire is being drawn, tapping a bus pin shows a small bit picker (`d0 d1 d2 d3`) and the wire attaches to that one bit.
  - A wire end therefore targets either a whole pin or a single bit of a pin. `PinRef` gains an optional bit index.
  - Bus-to-bus wires require equal width.
  - The pin card shows which bits are used.
- **Split and merge built-ins**, for users who prefer the explicit way:
  - `SPLIT n` turns one n-bit input into n 1-bit outputs;
  - `MERGE n` turns n 1-bit inputs into one n-bit output;
  - n is 4, 8 or 16;
  - they are listed in the library like any built-in part.
- **Flattening.** Both forms reduce to per-bit signals; the engine stays 1-bit.
- **Wiring several pins at once** uses bit taps for multi-bit sources (5.7).
- **Suggest wires** may propose bit-tap connections (`d0..d3` → bits of `q[4]`).

### 5.11 Calls made after the builder check (not owner decisions)

- **Wires reference pin IDs, not positions** (follows from 5.6: renames keep wires).
  - `PinRef` points at a pin's stable ID for custom chips.
  - The Pins panel order is a separate ordered list stored on the chip.
  - Reordering pins never reconnects anything.
  - Built-in parts keep their fixed pin numbering (NAND 0=a, 1=b, 2=out; input 0=out; output 0=in).
- **The save cascade.**
  - Saving a chip updates both the saved version and the draft of every parent. That means:
    - wires to a removed pin are dropped;
    - wires to a pin whose width changed are dropped;
    - added pins appear unconnected;
    - renames change only the label.
  - The confirmation lists every effect before saving.
  - Saving is not on the undo stack. The confirmation step and "Discard draft" cover mistakes, and undo history stays per session (ADR 22).
- **Creating chips.**
  - There is no special root chip. A project holds any number of chips, and it opens on the last one edited.
  - The library has "New chip", which asks for a name and colour, then opens an empty chip.
  - A chip that has never been saved has no saved version. It shows in the library as "draft only" and can't be placed until its first save.
  - A chip can't be placed inside itself, directly or through any other chip.
- **Look inside** opens the chip's draft for editing, with breadcrumbs. The draft runs its own simulation with its own input toggles. Live probing of one particular instance inside a parent is out of scope.
- **Branching:** a branch is an independent wire from the same source pin. The router may draw shared trunks with junction dots, but the model has no wire-on-wire anchors.
- **The clock is in scope**, per the template's v1 goals: play, pause, single-step and adjustable speed. The engine protocol gains a clock signal and a run loop. Circuits containing a clock simulate instead of erroring.

## 6. What changes in existing code (for the planner)

- **`projects` domain model** (draft format, ADR 33):
  - chips gain `saved` and `draft` circuits;
  - custom-chip pin definitions gain order, name, width and stable ID;
  - wires gain a "manual waypoints" flag so auto-routing leaves hand-moved bends alone;
  - folders and tags are created and assigned.
  - The demo's protected input/output instances go away. The root circuit becomes a normal chip, which the project opens on (my call).
- **`circuit-editor` actions:**
  - add `connectWire`, `removeWire`, `moveWaypoint`, `addPin`, `removePin`, `renamePin`, `setPinWidth`, `reorderPin`, `duplicate`, `array`, `renameChip`, `recolorChip`, `saveChip`, `discardDraft`, `acceptSuggestedWires`, and selection actions;
  - remove `ProtectedInstance` for user circuits.
- **`simulation` bridge:** `toNetlistSource` must flatten custom chips (saved versions) down to NANDs, and expand multi-bit pins and wires into per-bit signals. Today it returns `UnsupportedPart` for custom chips and the clock. The engine stays 1-bit per signal.
- **Rendering:**
  - chip anatomy, pin labels, bus tabs;
  - armed and legal-target states, wire animation, ghost wires;
  - selection box and lasso;
  - minimap.
- **`chip-library` feature:** library sheet/panel, folders and tags, search, starred, recent, and quick-add menu.
- **`accessibility`:** a keyboard and screen-reader path for every action. The canvas summary grows into a full structural view (chips, pins, wires), with commands for each action.

## 7. Left to the builder

- **Auto-routing algorithm.** Orthogonal routing on the grid, avoiding chip rectangles, e.g. A* on a visibility/grid graph. Recompute on chip move, and respect manual waypoints.
- **Gesture thresholds:** long-press duration, drag slop, double-tap.
- **Hit-testing and nearest-legal-pin snapping** for 24 px targets.
- Animation timings, which honour `prefers-reduced-motion`.
- Minimap placement.
- Keyboard shortcut map (borrow from DLS where sensible).
- Name-similarity rules for Suggest wires.
- Array spacing defaults.
- Performance budgets: drag at 60 fps on a mid-range phone with a few hundred chips.

## 8. Risks to spike early

- React Aria drag-and-drop from the library sheet to the canvas on Android Chrome (RAC #6365). Already flagged in the template spec §9.
- Gesture disambiguation on the canvas: pinch vs drag vs long-press vs tap-to-wire, using Pointer Events.
- Auto-routing speed when dragging chips in large circuits.
- Flattening custom chips and multi-bit buses into the engine, including determinism with seeded races.
