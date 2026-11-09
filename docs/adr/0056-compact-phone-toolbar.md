# 56. A compact editor toolbar on phones

On a phone, the editor toolbar showed every tool in a panel of five or six rows. The canvas got less than half of the screen.

## Decisions

- Below 640 px, the layout breakpoint from `EditorLayout`, the toolbar keeps the frequent tools: Library, Undo, Redo, Add NAND, Pan or Select, and Delete.
- The other tools go to a More tools menu (⋯): the colour for new wires, Tidy wires, Suggest wires, Keyboard shortcuts, Export and Import.
- Zoom out, Zoom in and Fit move to a magnifying glass button in the top-right corner of the canvas. Its popover stays open, so the user can press a control more than one time.
- A pinch zooms and a two-finger drag pans, as before (spec §5.3).
- Undo, Redo, Pan and Select show icons, and Add NAND shows "+ NAND". The full text stays as the accessible name (`CompactLabel`).
- CSS media queries switch the two layouts. Both are in the DOM, so the first render and hydration do not change.
- From 640 px, the toolbar is the same as before.

## Consequences

- On a phone, the toolbar takes two rows in English and in Spanish, and the canvas gets most of the screen.
- E2E helpers press a tool through `pressEditorTool` and `pressZoomTool` (`e2e/toolbar-support.ts`). These open the menu or the zoom popover on a phone.
- A new tool must go in the toolbar's wide list and, if it is not frequent, in the More tools menu (`more-tools.ts`).
