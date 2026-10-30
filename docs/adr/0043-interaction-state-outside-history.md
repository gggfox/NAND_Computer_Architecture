# 43. Selection, camera and tool are not edits

Selection, the camera and the tool live in an interaction store, not in the project. They are never actions, so undo and redo skip them. Moving a camera or changing selection cannot dirty a chip or fill the history.

A drag is one action: the preview is local, and one `moveChips` is committed when the gesture ends. A drag paints the parts that stay put once into a cached offscreen layer and redraws only the moved set each frame. With that, the `@perf` drag of 300 chips and 600 wires, at 4x CPU throttle on Pixel 7 emulation, reaches p95 of about 16.7 ms against the 20 ms budget. It was 33.3 ms before.

The camera (`zoom`, `x`, `y`) is in the URL, but only at rest. During a gesture it lives in the store. It is written with `replace: true` when the gesture ends, and 200 ms after the last wheel event, so back and forward are not flooded. The tool is a session preference: not in the URL, not saved. The minimap jump is instant, so it needs no reduced-motion handling. During its own drag the minimap keeps one transform for both drawing and pointer mapping, so the view does not chase the pointer.

Flattening stays on the main thread. After the Task 1 indexing and per-saved-chip memoisation it is near-linear: the budget test measured a 2000-NAND chain at 232 ms before and 10 ms after, and a 65k-NAND hierarchy at 2.4 s before and 0.7 s after (on a slow container). The tests enforce 80 ms and 1500 ms budgets (`to-netlist-source-perf.test.ts`). A drag commits once per gesture, so moving flattening into the worker would add a protocol round trip for no measured gain. Revisit if the budget fails at 82k NANDs.
