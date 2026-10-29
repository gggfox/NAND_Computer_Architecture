# 26. React Aria Components behind our own UI layer

Complex interactive widgets use React Aria Components; gaps are built from React Aria hooks; simple visual pieces are plain CSS. Everything is wrapped in our own UI layer, and the rest of the app never imports React Aria directly. Base UI's Drawer is the fallback for mobile bottom sheets if RAC's new Sheet proves buggy. List-to-canvas drag-and-drop on Android Chrome (RAC issue #6365) is spiked before being relied on. The wrapper layer absorbs RAC's `exactOptionalPropertyTypes` typing gaps.

Rejected: Base UI (no tree, color picker, tag group, DnD, virtualization), Ark UI (needs dnd-kit + TanStack Virtual, no built-in i18n strings), Radix (too little coverage), Mantine (own styling system conflicts with token-driven pure CSS), fully custom (accessibility cost). See docs/research/2026-10-29-ui-primitives-*.md.
