# 4. Bit width is part of the data model from v1

Pins and wires carry a bit width in the engine and the saved file format from the first version, even though the v1 UI only exposes 1-bit. Nand2Tetris needs 16-bit buses early; adding width later would force a breaking file-format migration.
