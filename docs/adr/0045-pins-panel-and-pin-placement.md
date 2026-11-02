# 45. Pins panel and pin placement (amends ADR 44)

The Pins panel is the only place pin order is defined. The panel's order is the pin order: canvas badges, the circuit summary and the pins of a saved chip inside a parent all follow it. Adding several pins at once is one `addPins` action, so it is one undo step. The panel is a side panel from 640 px wide and a bottom sheet on phones. A drag in the panel moves only the dragged row.

New pins stack in columns: inputs left of the leftmost part, outputs right of the rightmost, one piece's height plus `PIN_ROW_GAP` apart. Grid snapping wins over an exact gap, so a piece whose height plus the gap is off-grid is followed at the next grid line and the gap is at least `PIN_ROW_GAP`. "Tidy pins" rebuilds the columns with `moveChips`, in panel order, and anchors each column at the current position of its first pin, not at the other parts. The new-column rule applies only when no piece of that direction exists. A first pin dragged into the circuit therefore takes its column with it; the owner drags it out and tidies again.

Snapping applies to dropped pin pieces: a drop near a column snaps to its slot, and a guide line shows the column while dragging.

Tapping a 1-bit input piece toggles it. A multi-bit input is not toggled by a tap; its value is set in the panel. Dragging or long-pressing an input body never toggles it.

Rename in place goes through the label hit on a pin piece, or `F2` on the selected pin, and opens a popover. Closing it ends the rename with `endRename` and keeps the selection. A refused rename shows its reason inline only.

A refused connection shows a translated reason on the canvas and announces it in the live region. The notice survives mouse hover and is cleared by every other gesture and command, since clearing on hover would hide it on the first mouse move after a click.

Known limit: at the phone's fit zoom a pin's 24 px target covers its piece, so a tap arms the pin instead of toggling the input. Fixing it changes the pin-over-body hit priority and is left to the owner (see the plan's Status section).
