# 22. Undo history is session-only and capped

Undo/redo history lives in memory for the current session (cap ~200 actions) and is not saved with the project, keeping files small and free of history migrations.
