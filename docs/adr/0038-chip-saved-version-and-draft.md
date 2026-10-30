# 38. Chips have a saved version and a draft (refines ADR 5)

Edits change a chip's autosaved draft; every chip that uses it keeps running the saved version until the user saves. Saving updates the saved version and the draft of every parent: wires to removed or width-changed pins are dropped, added pins appear unconnected, renames change only the label. The confirmation lists all effects; saving is not on the undo stack. A never-saved chip cannot be placed. A chip can't contain itself, directly or indirectly.
