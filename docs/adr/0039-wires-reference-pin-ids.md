# 39. Wires to custom chips reference stable pin IDs; pin order lives in the Pins panel

Custom-chip pins have stable IDs; wires reference those IDs (plus an optional bit index, ADR 40), so renaming or reordering pins never reconnects anything. The chip's pin order is an explicit list edited in the Pins panel and is the order on the placed chip. Built-in parts keep fixed numbering (NAND 0=a, 1=b, 2=out).
