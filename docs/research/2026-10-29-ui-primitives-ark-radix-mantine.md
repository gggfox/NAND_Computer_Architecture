# UI primitives: Ark UI vs Radix Primitives vs Mantine

Date: 2026-10-29. Scope: an accessible component foundation for a React 19 + TanStack Start SPA
(digital-logic simulator with a canvas editor). Styling must be pure CSS / CSS Modules over our own
design tokens (CSS custom properties). Targets: WCAG 2.2 AA, touch as important as mouse and keyboard,
en + es. React Aria Components and Base UI are covered in a separate document.

Labels: **[analysis]** marks my inference. **[uncertain]** marks claims I could not fully verify from a
primary source. Version and release data comes from `npm view` and the GitHub API, run on 2026-10-29.

## Needs-coverage matrix

Legend: Y = first-party component. P = partial or composable from parts. N = not provided (needs a fallback).

| Need | Ark UI 5.40 | Radix (`radix-ui` 1.8.1) | Mantine 9.7 (`@mantine/core`) |
|---|---|---|---|
| Menu (+ submenus) | Y `Menu` | Y `DropdownMenu`, `Menubar` | Y `Menu`, `Menu.Sub`, `Menubar` |
| Context menu + long-press | Y `Menu.ContextTrigger`, about 700 ms long-press for touch/pen [1] | Y `ContextMenu`, "long press on touch devices" [2] | Y `Menu.ContextMenu`, 500 ms `longPressDelay` [3] |
| Dialog | Y `Dialog` | Y `Dialog`, `AlertDialog` | Y `Modal` (Mantine's `Dialog` is a non-modal floating box) |
| Bottom sheet / drawer | Y `Drawer` (Preview): swipe, snap points [4] | N (Vaul is unmaintained [5]) | P `Drawer position="bottom"`, no swipe or snap points documented [6] |
| Popover | Y | Y | Y |
| Tooltip | Y (ignores touch pointers) [7] | Y (ignores touch pointers) [7] | Y (`events` option includes touch) [7] |
| Tabs | Y | Y | Y |
| Tree view | Y `TreeView`: typeahead, multi-select, checkboxes, async, rename, virtualization example [8] | N | Y `Tree`: virtualization via `flattenTreeData`, drag and drop [9] |
| Combobox / search | Y `Combobox`, `Listbox` | N (only `Select`) | Y `Combobox`, `Autocomplete`, `Select`, `MultiSelect` |
| Tag group | P `TagsInput` (an input, not a static tag list) | N | P `Pill`, `Chip`, `TagsInput` |
| Color picker | Y `ColorPicker` | N | Y `ColorPicker`, `ColorInput`, `Hue/AlphaSlider` |
| Slider | Y (+ `AngleSlider`) | Y | Y (+ `RangeSlider`) |
| Switch | Y | Y | Y |
| Toast | Y `Toast` / `createToaster` | Y `Toast` | P `Notification` (static) + `@mantine/notifications` |
| DnD between list and canvas | N | N | N (`Tree` DnD is within the tree only) |
| Virtualized lists | P (examples, bring your own virtualizer) | N | P (Tree/Combobox examples use `@tanstack/react-virtual`) [9] |
| Disclosure / accordion | Y `Collapsible`, `Accordion` | Y `Collapsible`, `Accordion` | Y `Collapse`, `Accordion`, `Spoiler` |
| Toolbar | N (`ToggleGroup` only) | Y `Toolbar` | Y `Toolbar` |
| **Score (Y + ½P)** | **14.5 / 18** | **10 / 18** | **15 / 18** |

The common fallbacks, needed whichever library we pick, are:

- **Drag and drop:** dnd-kit or Pragmatic drag-and-drop. We need a custom adapter for the canvas drop target and a keyboard alternative. WCAG 2.2 SC 2.5.7 requires a single-pointer alternative to dragging.
- **Virtualization:** TanStack Virtual.

[analysis] Radix leaves the most gaps for this app: tree, combobox, color picker, bottom sheet and tag group. All five would have to come from other libraries.

## 1. Version, maintenance, license, size

| | Ark UI | Radix Primitives | Mantine |
|---|---|---|---|
| Current version | `@ark-ui/react` 5.40.0 (2026-10-29), on `@zag-js/*` 1.47.0 | `radix-ui` 1.8.1 (2026-10-12), plus per-package `@radix-ui/react-*` | `@mantine/core` 9.7.4 (2026-10-25) |
| Stable releases | 58 in 2025, 20 in 2026 so far | 14 in 2025, 12 in 2026 | 41 in 2025, 34 in 2026 |
| Commits, last 6 months | 100+ (ark), 100+ (zag) | 100+ | 100+ |
| Open issues (GitHub search) | ark 0, zag 5 | 130 (15 labelled bug) | 15 |
| Stars | 5.4k | 19.4k | 31.9k |
| License | MIT | MIT | MIT |
| Peer React | `>=18` | `^16.8 … ^19.0` | `^19.2.0` |
| Runtime deps | 69 `@zag-js/*` packages | 55 `@radix-ui/*` packages | 5 (`@floating-ui/react`, `clsx`, `react-remove-scroll`, `react-number-format`, `type-fest`) |

**Radix maintenance.** The npm timeline shows a gap and then a revival:

- The last stable release before the gap was 1.4.3 on 2025-08-13.
- Over the next roughly 10 months only `-rc` snapshots were published. 1.5.0 shipped on 2026-06-06.
- Since then releases have been steady: 1.6.0 to 1.6.7 (June–July), 1.7.0 (2026-10-05) and 1.8.0/1.8.1 (2026-10-12).
- Recent commits are mostly from `chaance`, the long-time maintainer (561 contributions). They are a11y and touch fixes, for example "dialog: Fix overlay taps not dismissing on iOS Safari (#4209)" and "core: Fork `aria-hidden` (#4213)", dated 2026-10-13/14.
- The official release notes confirm React 19.2 and iOS fixes in the June and July 2026 releases [10].

In the same period, shadcn/ui's changelog has a July 2026 entry titled "Base UI as the Default". The body was not retrievable. Its October 2026 entries still ship blocks "for Base UI, React Aria and Radix" [11].

[analysis] The "Radix slowed down" reports were true for August 2025 to May 2026. As of today, Radix is maintained again, but with a narrow bus factor and a smaller backlog-closing rate than Mantine. Secondary blogs claiming the repo has been dormant since February 2026 are contradicted by the GitHub data, so I discard them.

**Mantine** states its policy: patches every one to two weeks, minors every one to two months, majors every one to two years. It is led by one maintainer (Vitaly Rtishchev) with more than 500 contributors [12]. [analysis] The bus factor is high, but the project has a 5-year track record.

**Ark** is maintained by the Chakra team (Segun Adebayo). Zag state machines are shared across React, Solid, Vue and Svelte. [analysis] The near-zero open-issue count suggests aggressive triage or a move to Discussions, not an absence of bugs. Treat it as a weak signal.

**Bundle size.** I measured it locally with esbuild: minified ESM, gzip -9, React external, production define. The sets are not identical, so treat the numbers as an order-of-magnitude comparison. [analysis]

| Import set | min | gzip |
|---|---|---|
| Ark: Dialog only (`@ark-ui/react/dialog`) | 64 KB | 21 KB |
| Radix: Dialog only | 42 KB | 14 KB |
| Mantine: `MantineProvider` + `Modal` | 99 KB | 30 KB |
| Ark: 14 widgets (incl. TreeView, Combobox, ColorPicker, TagsInput) | 401 KB | 110 KB |
| Radix: 11 widgets (no tree, combobox or color picker exist) | 163 KB | 51 KB |
| Mantine: 15 widgets (incl. Tree, Combobox, ColorPicker, TagsInput) | 299 KB | 92 KB |

Mantine's CSS adds `styles.css` at 295 KB raw / 41 KB gzip. Per-component files are also available (`@mantine/core/styles/*.css` and `*.layer.css`, 210 files) for unstyled or partial use.

## 2. Accessibility evidence and open issues

- **All three** claim WAI-ARIA APG conformance in their docs and run axe in tests:
  - Mantine has a `@mantine-tests/core/src/axe.tsx` helper.
  - Zag has Playwright e2e axe utilities in `e2e/_utils.ts`.
  - Radix has axe in, for example, `e2e/toast.spec.ts` (GitHub code search).
  - None of the three publishes a screen-reader support matrix [analysis]. axe is automated only, so we must do our own VoiceOver/TalkBack/NVDA passes.
- **Radix:** 25 open issues match aria, screen reader, touch or iOS. Notable ones:
  - #3146: Select fails WCAG 2.5.2 Pointer Cancellation (open since 2024).
  - #4221: DropdownMenu opens on touch `pointerdown`, so a scroll that starts on it opens the menu.
  - #4128: Popover hardcodes `loop: true`, so Tab cannot leave a non-modal popover.
  - #4115: Toast viewport enters Dialog's `aria-hidden` subtree.
  - #3962: VoiceOver announces the wrong item count in Select.
  - #4250: Select `hideOthers` warning.
  - #1772: Shadow DOM breaks overlays.
- **Mantine:** 6 match. Examples:
  - #9331: Menu `aria-disabled` is overwritten since 9.7.4 (a regression three days old).
  - #8626: Select options are not read inside Modal.
  - #8932: unreliable aria-live on Select errors.
  - #9342 and #9339: IME composition bugs in Cascader and MultiSelect. These matter for i18n input generally, but less for en/es.
- **Mantine docs caveats:**
  - `Menu` with `trigger="hover"` "is not accessible".
  - Menu targets must be `button`s for Space and Enter to work.
  - The Drawer docs warn against disabling `trapFocus`, `returnFocus` and related options [3][6].
  - The Tree docs do not specify roles or arrow-key behaviour beyond requiring `role="tree"`. [uncertain] whether it fully matches the APG tree pattern [9].
- **Ark:** zero open issues match. Its TreeView documents the full APG keyboard model, including typeahead, `*` to expand siblings, Home/End, and F2 to rename [8]. [uncertain] There is no independent audit, and the low issue count is not proof of quality.

## 3. Touch and mobile behaviour

| Behaviour | Ark | Radix | Mantine |
|---|---|---|---|
| Context-menu long-press | Built in, about 700 ms, pen and touch only [1] | Built in [2] | Built in. iOS Safari lacks `contextmenu`, so it uses long-press, 500 ms default, and disables text selection [3] |
| Bottom sheet gestures | `Drawer`: `swipeDirection`, `snapPoints`, `closeThreshold` 0.25, velocity 700 px/s, `data-no-drag` opt-out [4] | None. Vaul README: "This repo is unmaintained" [5] | No swipe or snap documented [6] |
| Tooltip on touch | Source returns early on `pointerType === "touch"` [7] | Same [7] | `events` prop has a `touch` option [7] |
| Recent touch fixes | n/a | iOS dialog overlay tap dismissal (Oct 2026), iOS text selection in dialogs, Select touch-scroll (June 2026) [10] | Menu `click-hover` behaves as click on mobile [3] |

[analysis] Tooltips should never be the only carrier of information on touch, in any of the three libraries. Use visible labels or a long-press popover instead.

## 4. Styling with plain CSS and our own tokens

**Ark (headless).** It renders no styles.

- Parts carry `data-scope` and `data-part`, and states carry `data-state`, `data-highlighted` and similar, so CSS Modules can target `[data-part='item'][data-state='open']` or a `className` per part [13].
- Positioning uses CSS variables (`--x`, `--y`, `--available-height`, `--transform-origin`) and layering uses `--layer-index` and `--z-index` [1][13].
- [analysis] We fully own the look, and our tokens map 1:1 with no translation layer. Effort: we write every component's CSS.

**Radix (headless).** It also ships no styles.

- `data-state`, `data-side`, `data-align`, `data-highlighted` and `data-disabled` attributes are exposed.
- Prefixed variables are provided, for example `--radix-context-menu-content-transform-origin` and `--radix-…-available-height` [2].
- [analysis] Same ownership as Ark, and the slightly smaller per-component CSS surface makes it the easiest to style.

**Mantine (styled by default).** Owning the look takes one of three routes:

1. **Styles API on top of Mantine CSS.**
   - Every inner element has a named selector (`root`, `label`, …). It can be targeted with `classNames={{ root: css.root }}` from a CSS Module, or through the stable static classes `.mantine-Button-root`.
   - `vars` and `theme.components` override component variables such as `--button-bg`.
   - `classNames` is preferred over inline `styles`, which don't support pseudo-classes or media queries [14].
   - `styles.layer.css` wraps everything in `@layer mantine`, so unlayered app CSS wins without specificity fights (verified in the package).
2. **Token bridge.**
   - `MantineProvider` emits `--mantine-*` variables from the theme object.
   - `cssVariablesResolver` can rewrite them or add our own, per `light` and `dark` [15].
   - [uncertain] Overriding `--mantine-*` directly in our own `:root` CSS likely works because they are plain custom properties, but the docs only document the theme and resolver route.
   - [analysis] Our token data would have to be expressed as a Mantine theme, with 10-shade color tuples and a `primaryShade`, or remapped. This is a translation layer to maintain.
3. **Headless.**
   - Skip `styles.css` and use `HeadlessMantineProvider`. This removes classes, inline CSS variables, color-scheme features and global styles.
   - Caveats from the docs: style props like `color`, `radius` and `size` stop working; `Grid`, `SimpleGrid` and `Container` become unusable; `hiddenFrom`/`visibleFrom` don't work; and dark mode must be built by hand.
   - The per-component `unstyled` prop only affects the root component and "does not remove Mantine library styles from your `.css` bundle" [16].

**How the ~122 Mantine core components break down.** [analysis] This is an approximate hand classification of the `@mantine/core` list [17]:

| Category | Count | Examples |
|---|---|---|
| Layout, visual, typography, feedback (no ARIA pattern) | about 50 | Box, Stack, Group, Flex, Grid, SimpleGrid, Container, Center, Space, Paper, Card, AppShell, AspectRatio, Divider, Text, Title, Typography, Code, Kbd, Mark, Badge, ThemeIcon, Image, BackgroundImage, Avatar, Indicator, Loader, Skeleton, Progress, RingProgress, SemiCircleProgress, Timeline, List, Table, DataList, Alert, EmptyState, Notification, Overlay, LoadingOverlay, Transition, Affix, Portal, VisuallyHidden, RollingNumber, NumberFormatter, Highlight, Marquee, ColorSwatch, Blockquote |
| Form inputs and buttons (mostly native-element wrappers) | about 35 | TextInput, Textarea, PasswordInput, NumberInput, MaskInput, JsonInput, NativeSelect, FileInput, Checkbox, Radio, Button, ActionIcon, CloseButton, CopyButton, Chip, Pill, PinInput, Rating, Pagination, NavLink, Breadcrumbs |
| Composite or overlay widgets with real ARIA/keyboard logic | about 35 | Menu, Menubar, Modal, Drawer, Popover, HoverCard, Tooltip, Tabs, Accordion, Tree, TreeSelect, Combobox, Select, MultiSelect, Autocomplete, TagsInput, Cascader, ColorPicker, Slider, RangeSlider, AngleSlider, Switch, SegmentedControl, Stepper, Splitter, ScrollArea, Toolbar, Tour, FloatingWindow |

So against Ark's 52 components (plus 15 utilities) [18], Mantine's real "interactive" advantage is about 35 versus about 40. Ark covers similar widget ground, and the extra roughly 85 Mantine components are mostly layout and visual helpers that we would replace with our own CSS anyway. Many of those helpers also stop working in headless mode.

## 5. React 19 and TypeScript

- **Ark:** peer `react >=18`. It is TypeScript-first and exports state-machine types (`useTreeView`, `useMenu`). It is also ESM-only (`"type": "module"`), which fits Vite/TanStack Start. [uncertain] I did not verify that it compiles cleanly under `exactOptionalPropertyTypes`.
- **Radix:** peer `^19.0`. In 2026 it fixed several React 19 issues:
  - infinite re-render loops in Slot and composed refs;
  - stale `onEscapeKeyDown` handlers on 19.2;
  - a `useEffectEvent` regression.
  - It also removed a global `React.CSSProperties` augmentation [10].
  - [analysis] This was React-19 debt that was only recently paid down. Its types depend on `@types/react` as a peer.
- **Mantine:** 9.x requires React `^19.2.0` as a peer, so it is React 19 native. The types are comprehensive, and its `type-fest` dependency suggests strict typing [analysis].

## 6. Notable drawbacks

**Ark**

- It has the most component coverage of the headless options, but the largest JS for an equivalent set: about 110 KB gzip for 14 widgets, from about 69 Zag packages.
- Drawer, Splitter and Image Cropper are still marked **Preview** [4][8].
- There is no Toolbar or static tag group.
- Docs are generated per framework, so some pages are thin (ContextTrigger keyboard behaviour is undocumented) [1].
- Community and Stack Overflow footprint is small: 5.4k stars.

**Radix**

- Inventory gaps (tree, combobox, color picker, sheet, tag group) force us to mix in other libraries, which means inconsistent a11y models.
- It had a roughly 10-month stable-release drought.
- Long-lived a11y issues remain open (#3146 since 2024, #1772 since 2022).
- It relies heavily on a single maintainer.
- The ecosystem (shadcn) is shifting its default to Base UI [11].

**Mantine**

- It is a styled design system first. Fully owning the look means either fighting `@layer mantine` with the Styles API or going headless and losing style props, layout components and color scheme.
- Our tokens must be re-expressed in Mantine's theme shape.
- 41 KB gzip of CSS ships unless we cherry-pick per-component files.
- There is no swipeable bottom sheet.
- The project depends on a single lead maintainer.
- Patch releases can regress a11y (#9331).

**Overall** [analysis]

- For a pure-CSS, own-token, touch-heavy app, **Ark** is the strongest fit of these three. It is headless, has the best coverage of hard widgets (tree, combobox, color picker, gesture drawer) and has built-in long-press.
- **Mantine** is viable only in headless or `@layer` mode, and its 120-component headline overstates the interactive advantage.
- **Radix** covers too little of the needs list on its own.

## Sources

1. Ark UI Menu docs (ContextTrigger, long-press, CSS vars): https://ark-ui.com/docs/components/menu
2. Radix Context Menu docs: https://www.radix-ui.com/primitives/docs/components/context-menu
3. Mantine Menu docs (`Menu.ContextMenu`, `longPressDelay`, a11y): https://mantine.dev/core/menu/
4. Ark UI Drawer docs (Preview, `snapPoints`, `swipeDirection`): https://ark-ui.com/docs/components/drawer ; `@zag-js/drawer` 1.47.0 type definitions
5. Vaul README ("This repo is unmaintained"), last push 2025-10-03: https://github.com/emilkowalski/vaul
6. Mantine Drawer docs: https://mantine.dev/core/drawer/
7. Package source, 2026-10-29: `@zag-js/tooltip` `tooltip.connect.mjs` and `@radix-ui/react-tooltip` `dist/index.mjs` both contain `pointerType === "touch") return`; `@mantine/core` `Tooltip/use-tooltip.mjs` handles `touch` events
8. Ark UI Tree View docs: https://ark-ui.com/docs/components/tree-view
9. Mantine Tree docs: https://mantine.dev/core/tree/
10. Radix Primitives release notes: https://www.radix-ui.com/primitives/docs/overview/releases ; npm `radix-ui` version timeline; GitHub commits https://github.com/radix-ui/primitives/commits
11. shadcn/ui changelog: https://ui.shadcn.com/docs/changelog
12. Mantine About (release policy, maintainer): https://mantine.dev/about/
13. Ark UI styling guide: https://ark-ui.com/docs/guides/styling
14. Mantine Styles API: https://mantine.dev/styles/styles-api/
15. Mantine CSS variables: https://mantine.dev/styles/css-variables/
16. Mantine unstyled / headless: https://mantine.dev/styles/unstyled/
17. Mantine component index: https://mantine.dev/llms.txt
18. Ark UI component index: https://ark-ui.com/llms.txt
19. GitHub issues cited: https://github.com/radix-ui/primitives/issues/3146 , /4221 , /4128 , /4115 , /3962 , /4250 , /1772 ; https://github.com/mantinedev/mantine/issues/9331 , /8626 , /8932 , /9342 , /9339
