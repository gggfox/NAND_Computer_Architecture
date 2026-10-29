# UI primitives: React Aria Components vs Base UI

**Date:** 2026-10-29 · **Scope:** unstyled accessible primitives for a React 19 + TanStack Start SPA (logic-simulator canvas editor), styled with plain CSS / CSS Modules. Ark UI, Radix and Mantine are covered in a separate file.
**Sources:** primary only (npm registry, GitHub repos/releases/issues, official docs). `[analysis]` = my inference. `[uncertain]` = not confirmed in a primary source.

## TL;DR

- **React Aria Components (RAC)** covers 18 of the 20 needs fully, and the other 2 partially. Toast is still `UNSTABLE_`-prefixed, and drag-and-drop onto a free-form canvas needs the lower-level `useDrop` hook. Its strengths are i18n (34 bundled locales, including `es-ES`), touch, and drag-and-drop. Its weaknesses are a larger bundle and `exactOptionalPropertyTypes` friction.
- **Base UI** (`@base-ui/react`) covers 13 of the 20. It has **no tree view, color picker, tag group, virtualizer, drag-and-drop or shortcut primitive**, and these are open proposals or not planned. Its API is small and modern, with CSS-variable-rich styling. Its Drawer is excellent on mobile, and the package is smaller.
- [analysis] For this app (tree, color swatches, tags, drag from a list onto the canvas, es + RTL), **RAC is the better fit**. Base UI would need 5–6 extra libraries or hand-rolled widgets, and each one is a separate accessibility risk.

## Needs-coverage matrix

Key: ✅ first-party component · 🟡 partial, preview, or unstable · ❌ missing. A ❌ row names the fallback.

| Need | React Aria Components 1.22.1 | Base UI 1.9.0 |
|---|---|---|
| Menu (+ submenus) | ✅ `Menu`, `MenuTrigger`, `SubmenuTrigger` [rac-menu] | ✅ `Menu`, `Menubar` [bui-llms] |
| Context menu, long-press on touch | ✅ `MenuTrigger trigger="contextMenu"` (right-click; long-press on touch; OS/screen-reader keyboard shortcuts), added in 1.20 [rac-1.20][rac-menu] | ✅ `ContextMenu`: "right click or long press"; no delay prop documented [bui-ctx] |
| Dialog / alert dialog | ✅ `Dialog`, `Modal`, `role="alertdialog"` | ✅ `Dialog`, `AlertDialog` |
| Bottom sheet / drawer | ✅ `Sheet` (new in 1.22, Oct 2026; snap points, swipe, stacking, start/end mirroring for RTL) [rac-1.22][rac-sheet]. Very new; see issues #10749 and #10854 | ✅ `Drawer` (stable since 1.3; snap points, `SwipeArea`, nested drawers, `VirtualKeyboardProvider`) [bui-rel][bui-drawer] |
| Popover | ✅ `Popover`, `DialogTrigger`; `PreviewTrigger` (hover, focus or long press) [rac-1.20] | ✅ `Popover`, `PreviewCard` |
| Tooltip | ✅ `TooltipTrigger`, `Tooltip` | ✅ `Tooltip` |
| Tabs | ✅ `Tabs` | ✅ `Tabs` |
| Tree view (chip library folders) | ✅ `Tree` (selection, expand, drag-and-drop, load-more) + `useTreeData`; also `NavigationTree` (1.21) [rac-exports][rac-1.21] | ❌ open proposal mui/base-ui#3327. Fallback: hand-roll an APG tree, or use React Aria `Tree` |
| Combobox / search | ✅ `ComboBox`, `Autocomplete`, `SearchField` | ✅ `Combobox`, `Autocomplete` |
| Tag group | ✅ `TagGroup` (+ `TokenField`, alpha) [rac-1.20] | ❌ no Chip/Tag component (discussion #4808 closed). Fallback: `ToggleGroup`, `Combobox` multiple-value chips [uncertain], or hand-roll |
| Color picker (chip colors) | ✅ `ColorSwatchPicker`, `ColorPicker`, `ColorArea`, `ColorWheel`, `ColorSlider`, `ColorField` [rac-exports] | ❌ proposal #3351 ("waiting for 👍"). Fallback: `RadioGroup` of swatches (good enough for a fixed palette) [analysis] |
| Slider | ✅ `Slider` | ✅ `Slider` |
| Switch | ✅ `Switch` | ✅ `Switch` |
| Toast | 🟡 `UNSTABLE_ToastRegion` / `UNSTABLE_ToastQueue`; F6 landmark navigation [rac-toast] | ✅ `Toast` (F6 landmark, update by id) [bui-rel][bui-toast] |
| Drag-and-drop, list to canvas | 🟡 `useDragAndDrop` for collections (`GridList`, `ListBox`, `Table`, `Tree`) + `useDrag` / `useDrop` hooks for custom targets such as a canvas [rac-dnd][rac-exports] | ❌ none. Fallback: dnd-kit or pointer events (not covered here) |
| Virtualized lists | ✅ `Virtualizer` + `ListLayout` / `GridLayout` / `TableLayout` / `WaterfallLayout` [rac-exports] | ❌ no primitive. Docs show `@tanstack/react-virtual` with Combobox [bui-combobox] |
| Disclosure / accordion | ✅ `Disclosure`, `DisclosureGroup` | ✅ `Accordion`, `Collapsible` |
| Toolbar | ✅ `Toolbar` | ✅ `Toolbar` |
| Keyboard shortcuts | ✅ `Keyboard` component + simplified `useKeyboard` shortcut API (1.20) [rac-1.20] | ❌ none. Fallback: custom keydown handler or a small hotkeys library |
| RTL / i18n strings | ✅ `I18nProvider`, 34 bundled locales | 🟡 `DirectionProvider` only (RTL behavior). You supply all strings and labels [bui-dir] |

Count (20 needs): RAC has 18 ✅ and 2 🟡 (toast, canvas DnD). Base UI has 13 ✅, 1 🟡 and 6 ❌.

## 1. Version, stability, cadence, maintainers, license, size

| | React Aria Components | Base UI |
|---|---|---|
| Latest | `react-aria-components` **1.22.1** (2026-10-09); hooks `react-aria` 3.53.1 [npm-rac] | `@base-ui/react` **1.9.0** (2026-10-09) [npm-bui] |
| 1.0 | Stable 1.x line, released Dec 2023 [uncertain: date from memory]; versions 1.17 to 1.22 all shipped in 2026 | **1.0.0 on 2025-12-11**. The old package `@base-ui-components/react` was frozen at 1.0.0-rc.0 and renamed [npm-bui][bui-rel] |
| Cadence | About monthly minors: Apr 14, May 28, Jun 18, Jul 31, Sep 1, Oct 8 (2026) [npm-rac] | About monthly minors: 1.3 to 1.9 from Mar 12 to Oct 9 (2026) [npm-bui] |
| Maintainers | Adobe (adobe/react-spectrum monorepo, about 16k stars). Top committers devongovett, snowystinger, LFDanLu, reidbarber [gh-rs] | Seven-person team "from the creators of Radix, Material UI, and Floating UI" (Colm Tuite, Marija Najdova, Michał Dudak and others), hosted under mui/base-ui (about 11k stars). Top committers include atomiks (Floating UI) [bui-about][gh-bui] |
| License | Apache-2.0 | MIT |
| Peer deps | React 16.8 to 19 | React 17, 18 or 19; `date-fns` optional |

**Bundle size.** These are my measurements with esbuild: ESM, minified, react external, gzip -9. They are `[analysis]` because real numbers depend on the app's bundler.

| Import set | RAC 1.22.1 | Base UI 1.9.0 |
|---|---|---|
| Menu + Popover + Dialog (+ Modal/Button in RAC) | 53 KB gz | 67 KB gz |
| Everything on the needs list that each library actually has (RAC 36 exports incl. Tree/Color/DnD/Virtualizer; Base UI 14 components) | 154 KB gz | 127 KB gz |
| Whole package | 284 KB gz | 182 KB gz |

[analysis] Shared internals cost each library roughly 50–70 KB up front. After that, RAC costs more because it does more: date/number i18n and 34 locale string tables. RAC ships `@react-aria/optimize-locales-plugin` to strip unused locales, and 1.22 added Turbopack support for it [rac-1.22]. Use it, restricted to en + es. Bundle size has historically been the top RAC complaint (#4356, #5639, #5798, all closed) [gh-rs-size].

## 2. Accessibility evidence

- **RAC:** The docs say "All components are extensively tested using many popular screen readers and devices," that the library is built on the ARIA APG, and that it normalizes browser and assistive-technology differences. Dialogs include hidden dismiss buttons for mobile screen-reader users [rac-home]. Adobe ships it inside React Spectrum, its own design system. Open a11y-labelled issues: **30**, but that count covers the whole monorepo, Spectrum included [gh-rs-a11y]. Representative issues:
  - #10310: JAWS/NVDA detected as mouse modality in Chromium.
  - #9737: invalid menu label due to `inert`.
  - #9556: wrong `aria-posinset` with sections.
- **Base UI:** The docs follow the APG and say the library is "tested across a broad range of browsers, devices, platforms, screen readers". No specific assistive technology is named. Focus styling, contrast (the docs recommend APCA; WCAG 2.2 AA still requires 4.5:1 / 3:1) and labels are left to you [bui-a11y]. Open a11y-labelled issues: **7** [gh-bui-a11y], for example:
  - #5794: iPhone VoiceOver closes the whole menu after the last submenu item.
  - #4184: NVDA/JAWS don't announce Progress/Meter labels.
  - #4253: Toast undo action can't be reached in time (WCAG 2.2.1 Timing).
- [analysis] Both libraries are credible, and the issue counts are not comparable across repos. RAC has the longer track record and a far larger surface of accessible complex widgets (tree, grid DnD, color). Those complex widgets are exactly where hand-rolled replacements usually fail WCAG.

## 3. Touch and mobile behaviour

- **RAC press model:** `usePress` / `Pressable` normalize mouse, touch, pen and keyboard: drag-off cancels, long-press selects, text selection is prevented, scroll is locked, and multi-touch is handled. Hover styles apply only to a mouse, so there is no sticky hover on touch [rac-home]. `trigger="longPress"` on MenuTrigger gives secondary actions, with Alt+↓ as the keyboard equivalent [rac-menu].
- **RAC Sheet:** built on native scroll gestures. 1.22 added overlay placement that accounts for the virtual keyboard [rac-1.22]. It is new, and there are fresh bugs: #10749 (a mouse can't swipe a Sheet) and #10854 (slow-drag dismissal is tied to viewport height) [gh-rs-drag].
- **RAC DnD:** Mouse and touch use native browser DnD APIs. Mobile screen-reader users double-tap to start a drag, swipe between targets, and double-tap to drop. A keyboard drag moves with Enter, Tab and Enter, and announcements are built in [rac-dnd]. Caveat: #6365, "Some RAC ListBox drag-and-drop examples in the docs don't work on Chrome for Android", has been open since 2024 [gh-rs-drag].
  - [analysis] Dropping onto a `<canvas>` editor needs `useDrop` on the canvas wrapper, with your own hit-testing to map coordinates to the grid. Touch reliability on Android should be prototyped early.
- **Base UI:** `ContextMenu` long press is supported, but no duration or threshold setting is exposed [bui-ctx]. Drawer is the strongest mobile piece: swipe CSS variables (`--drawer-swipe-progress`, `--drawer-keyboard-inset`), snap points, nested stacks, and `VirtualKeyboardProvider` (1.6), with swipe and virtual-keyboard handling improved again in 1.9 [bui-drawer][bui-rel]. There is no DnD primitive at all.

## 4. Styling with plain CSS / CSS Modules

- **RAC:** Every component renders a default class, such as `react-aria-Button` or `react-aria-SheetOverlay`. `className` and `style` accept either a value or a function of render props, and states appear as data attributes such as `[data-pressed]`, `[data-selected]`, `[data-dragging]`, `[data-position]` and `[data-stack-index]` [rac-home][rac-sheet-types].
  - A plain CSS Modules pattern: `.btn[data-pressed]{…}`.
  - Theming is entirely up to you through CSS custom properties. RAC exposes a few variables, such as `--trigger-width` on popovers [uncertain].
  - The npm package marks only `*.css` as having side effects; the components ship no CSS of their own.
- **Base UI:** `className` and `style` accept either a string/object or a function of state. States appear as data attributes (`[data-checked]`, `[data-highlighted]`, `[data-starting-style]` / `[data-ending-style]` for transitions). Components expose many **CSS variables** (`--anchor-width`, `--available-height`, the drawer swipe variables) and **constants** such as `MenuPositionerCssVariables`. There are no default class names [bui-style]. The `render` prop is used for composition.
- [analysis] Both work well with CSS Modules and no Tailwind. Base UI's CSS-variable-driven animation (swipe progress, `starting-style`) feels more "pure CSS". RAC's default class names let you write a global theme stylesheet without passing `className` everywhere.

## 5. i18n/RTL, React 19 / SSR, TypeScript

- **i18n:**
  - RAC bundles translated strings for **34 locales**, including `es-ES` (verified in the package `dist/private/intl`) [npm-rac-files]. It also covers localized date and number parsing, 13 calendars and RTL layout [rac-home]. Sheet `start`/`end` mirror under RTL [rac-sheet-types].
  - Base UI has `DirectionProvider` for RTL behavior (keyboard direction, positioning) [bui-dir] and ships **no translated strings**, so every aria-label and live-region message is yours. NumberField got Persian digits in 1.5 [bui-rel].
- **React 19 / SSR:** Both list React 19 as a peer dependency.
  - RAC: open #7474 "I18nProvider breaks client hydration in TanStack Start" and #10570 (SelectionIndicator offset after SSR in StrictMode) [gh-rs-ssr].
  - Base UI: open SSR markup issues #5597 (radio `aria-labelledby` / `tabindex` in server HTML) and #5821 [gh-bui-ssr].
  - [analysis] In SPA mode (SSR off for the editor routes), both mostly go away. If Start SSR stays on, pass the locale to `I18nProvider` explicitly from the server.
- **`exactOptionalPropertyTypes`:**
  - **Base UI fixed it** (#1916, closed 2026-01-16, PR #3302, plus an ESLint rule so optional props accept `undefined`) [gh-bui-1916].
  - **RAC has not:** #8717 "`react-aria` should support `exactOptionalPropertyTypes`" is open, and passing `undefined` props to RAC components errors under EOPT. Workarounds are conditional spreads [gh-rs-8717].
  - [analysis] This is a real ergonomic cost if the repo enables EOPT. Mitigate it with thin typed wrapper components, which the project will write anyway for CSS Modules.

## 6. Notable drawbacks / community complaints

- **RAC:**
  - Bundle weight (historical issues).
  - Verbose composition: many parts, plus Context/slots indirection.
  - Toast is still `UNSTABLE_`. Sheet and TokenField are brand-new or alpha.
  - EOPT friction.
  - The issue tracker is shared with React Spectrum (about 674 open issues across the monorepo) [gh-rs].
  - `react-aria` is now a single package with subpath imports (`react-aria/useDrag`, `react-stately/useTreeData` in the 1.22 type exports) [rac-exports]. Older blog posts reference `@react-aria/*` packages.
- **Base UI:**
  - Narrower scope. No tree, color, tags, grid list, DnD, virtualization or date pickers: these are all open proposals (#3327 Tree, #4789 Grid List, #3351 Color Picker, #1709 pickers) [gh-bui-prop].
  - Young (stable for 10 months), with "preview" features still landing, such as menu filtering in 1.9 [bui-rel].
  - Behavior changes inside minors: Accordion keyboard navigation changed in 1.6, and `sanitizeValue` was renamed to `normalizeValue` in 1.5 [bui-rel].
  - About 442 open issues [gh-bui].

## Recommendation [analysis]

Choose **React Aria Components** as the primitive layer. It is the only option of the two with first-party accessible Tree, ColorSwatchPicker, TagGroup, Virtualizer, keyboard-shortcut and touch- and screen-reader-aware DnD hooks. These are the widgets that are hardest to make WCAG 2.2 AA-compliant yourself. It also ships Spanish strings and RTL.

Mitigations:
1. Enable the locale-optimization plugin for en + es.
2. Wrap each primitive in a project component with a CSS Module, which also absorbs the EOPT friction.
3. Prototype list-to-canvas DnD with `useDrag`/`useDrop` on iOS Safari and Android Chrome in week 1 (#6365).
4. Pin minor versions for `UNSTABLE_Toast` and `Sheet`.

Base UI is the better choice only if the app drops the tree/color/tag/DnD needs or accepts several third-party add-ons. Its Drawer would be the one piece worth envying.

## Sources

- [npm-rac] https://registry.npmjs.org/react-aria-components · https://registry.npmjs.org/react-aria
- [npm-rac-files] https://unpkg.com/react-aria-components@1.22.1/?meta
- [rac-exports] https://unpkg.com/react-aria-components@1.22.1/dist/types/exports/index.d.ts
- [rac-sheet-types] https://unpkg.com/react-aria-components@1.22.1/dist/types/src/Sheet.d.ts
- [rac-home] https://react-aria.adobe.com/
- [rac-menu] https://react-aria.adobe.com/Menu
- [rac-sheet] https://react-aria.adobe.com/Sheet
- [rac-toast] https://react-aria.adobe.com/Toast
- [rac-dnd] https://react-aria.adobe.com/dnd
- [rac-1.20] https://github.com/adobe/react-spectrum/releases/tag/react-aria-components@1.20.0
- [rac-1.21] https://github.com/adobe/react-spectrum/releases/tag/react-aria-components@1.21.0
- [rac-1.22] https://github.com/adobe/react-spectrum/releases/tag/react-aria-components@1.22.0
- [gh-rs] https://github.com/adobe/react-spectrum
- [gh-rs-a11y] https://github.com/adobe/react-spectrum/issues?q=is%3Aopen+label%3Aaccessibility (#10310, #9737, #9556)
- [gh-rs-drag] https://github.com/adobe/react-spectrum/issues/6365 · /issues/10749 · /issues/10854
- [gh-rs-size] https://github.com/adobe/react-spectrum/issues/4356 · /issues/5639 · /issues/5798
- [gh-rs-ssr] https://github.com/adobe/react-spectrum/issues/7474 · /issues/10570
- [gh-rs-8717] https://github.com/adobe/react-spectrum/issues/8717
- [npm-bui] https://registry.npmjs.org/@base-ui/react · https://registry.npmjs.org/@base-ui-components/react
- [bui-llms] https://base-ui.com/llms.txt
- [bui-rel] https://base-ui.com/react/overview/releases
- [bui-about] https://base-ui.com/react/overview/about
- [bui-a11y] https://base-ui.com/react/overview/accessibility
- [bui-style] https://base-ui.com/react/handbook/styling
- [bui-ctx] https://base-ui.com/react/components/context-menu
- [bui-drawer] https://base-ui.com/react/components/drawer
- [bui-toast] https://base-ui.com/react/components/toast
- [bui-combobox] https://base-ui.com/react/components/combobox (Virtualized section)
- [bui-dir] https://base-ui.com/react/utils/direction-provider
- [gh-bui] https://github.com/mui/base-ui
- [gh-bui-a11y] https://github.com/mui/base-ui/issues?q=is%3Aopen+label%3Aaccessibility (#5794, #4184, #4253)
- [gh-bui-ssr] https://github.com/mui/base-ui/issues/5597 · /issues/5821
- [gh-bui-1916] https://github.com/mui/base-ui/issues/1916
- [gh-bui-prop] https://github.com/mui/base-ui/issues/3327 · /issues/3351 · /issues/4789 · /issues/1709 · /issues/4808
