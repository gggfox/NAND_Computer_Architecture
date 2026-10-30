# Glossary

Terms used across code, issues and docs. Use these names; avoid the listed synonyms.

- **NAND**: the only built-in logic primitive. Every other logic chip is built from NANDs.
- **Chip**: a reusable component with input pins and output pins. Either built-in (NAND, clock, I/O) or custom.
- **Custom chip**: a chip the user builds from other chips and saves with a name and color. _Avoid_: component, module, block.
- **Circuit**: the wiring inside a chip that the user edits on the canvas. _Avoid_: board, schematic.
- **Pin**: a connection point on a chip. Input pins receive signals; output pins drive them.
- **Wire**: a connection from one output pin to one or more input pins.
- **Signal**: the value on a pin or wire at a given tick (high/low).
- **Tick**: one step of the simulation. Every NAND takes one tick to update its output.
- **Built-in part**: a non-logic primitive (input pin, output pin, clock, later displays).
- **Bit width**: how many bits a pin or wire carries. Part of the file format from v1; the v1 UI only exposes 1-bit.
- **Project**: a named collection of custom chips. The unit of export, import and sharing.
- **Fork**: a copy of a shared project that becomes the recipient's own. _Avoid_: clone, duplicate.
- **Theme**: a named set of design tokens (colors, etc.) applied to both UI and canvas.
- **Action**: a typed, named description of one edit to a project (place chip, connect wire, rename...). The only way state changes. _Avoid_: command, mutation, event.
- **Folder** / **Tag**: user-defined ways to organise chips in the chip library.
- **Seed**: the number that decides how races resolve. Saved with the project; same seed + same inputs = same result. _Avoid_: random state.
- **Race**: two or more gates changing on the same tick in a way where the outcome depends on which "wins".
- **Saved version** / **Draft**: a chip's published circuit (what users of the chip run) and its in-progress edits. _Avoid_: published/unpublished, version 2.
- **Pins panel**: the list of a chip's inputs and outputs where names, widths and order are edited.
- **Bit tap**: a wire end attached to one bit of a multi-bit pin.
- **Pin piece**: the canvas piece of one of the chip's own input or output pins.
- **Step (clock)**: one toggle of the clock followed by a settle.
- **Split** / **Merge**: built-in parts converting between one n-bit pin and n 1-bit pins.
- **Library**: the browsable sheet/panel of chips (search, starred, folders, tags). **Quick-add menu**: the long-press/right-click menu that places a chip at the press point.
