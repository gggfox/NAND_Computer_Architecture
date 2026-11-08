# 54. A drop lines wires up when half a grid is all it takes

Chips snap to the 40 px grid, but pins sit on 20 px half-grid rows. A pin piece's pin is half a grid below its top, and a NAND's output is a whole grid below its top. On the grid alone, a NAND's output and an output piece can never line up, so the wire between them always bends.

## Decisions

- After a drag snaps to the grid, `alignToWires` tries the drop as it is, half a grid up and half a grid down. It keeps the one where more wires between the dragged chips and the chips that stay put run straight. A tie keeps the grid point.
- So a chip can sit half a grid off the grid. The router is not affected, because pins stay on the half-grid rows.
- Tidy pins and new pin pieces stack on their column's rows (`snapFrom`): on the grid, or half a grid below it when the column's first piece is there. Any other offset snaps to the grid.
- The demo puts its output piece half a grid down, so the wire from the NAND is straight from the start.
- Keyboard moves keep their whole grid steps and do not align.

## Consequences

- Projects saved before this change keep their positions. Their wires straighten when the user drags a chip.
- One e2e test needs the output on the grid to cross a straight run, so it imports `v1-demo.json`, the old layout.
