# 8. Every edit is a typed action through one dispatcher

All project changes are expressed as a discriminated union of actions and applied in one place. Undo/redo, keyboard editing, the screen-reader view, E2E tests and future MCP agents all drive the editor through the same actions, so none of them needs its own path into the state.
