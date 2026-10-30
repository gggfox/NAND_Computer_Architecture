# 25. State split: URL for location, Zustand for the open project, IndexedDB for durability

Location (project, chip, viewport, open panel) lives in TanStack Router search params validated with Zod (`validateSearch`); no separate URL-state library. The open project lives in a Zustand store outside React, changed only through actions (ADR 8) and autosaved to IndexedDB after each action. On load, the URL identifies the project, which is read from IndexedDB into the store.

Rejected: circuit data in the URL (history spam, length limits, back/forward becoming undo).
