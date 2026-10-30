# 42. Canvas gestures: fixed thresholds, a wheel that pans, and a tool switch

Drag slop is 4 px for a mouse and 10 px for touch and pen. A long-press is 500 ms within slop. There is no double-tap. A mouse secondary button opens the chip menu at once, and the canvas prevents `contextmenu`. A device check on iOS Safari and Android Chrome kept these defaults ([spike](../research/2026-10-30-gesture-spike.md)).

The wheel follows Figma and Excalidraw: plain wheel and trackpad scroll pan, `Ctrl`/`⌘` + wheel zooms at the cursor (a trackpad pinch arrives this way), `Shift` + wheel pans sideways. This matches two-finger drag panning on touch. Space + drag pans with any tool.

A tool switch (`pan` or `select`) decides what a one-finger drag on empty canvas does. It defaults to `select` with a fine pointer and `pan` with a coarse one. A finger dragging a chip always moves it, whatever the tool. A second finger during a one-finger drag commits the drag so far as one `moveChips` and then pinches, so a mode change never loses work.

Why: one rule per input device keeps gestures predictable, and committing on a second finger means the user never sees a drag silently undone.
