# 53. Amber is the default theme, and the index is a landing page

The index page now explains the project before it lists the projects. It has a hero with a NAND schematic and its truth table, the saved projects, and the five steps from NAND to a computer. The look is a heads-up display: a faint grid, thin frame lines, corner brackets and uppercase labels.

## Decisions

- A new theme, **Amber**, gives black surfaces, an orange accent and the Orbitron and Chakra Petch fonts. It is the first id in `themeIds`, and the first id is the default.
- With no stored choice, the app uses Amber. A `prefers-contrast: more` preference still gives High contrast. The OS light or dark preference no longer picks the theme. Light, Dark and High contrast stay in the theme picker.
- A theme can now change fonts and shapes as well as colours. `global.css` defines the font tokens (`--font-body`, `--font-display`) and the shape tokens (radii, letter case and tracking, `--frame-line`, `--frame-corners`, `--frame-clip`, `--page-pattern` and `--canvas-corners`). Their defaults keep the plain look, and only Amber changes them. The colour tokens stay in `themes.ts`, as ADR 10 says.
- The builder uses the same tokens, so in Amber it matches the landing page: uppercase controls, sharp corners, display-font headings and a grid behind the page. The toolbar, canvas, side panels, dialogs and landing cards are bevelled: `--frame-clip` cuts each corner at 45 degrees, and `--frame-corners` draws an accent line along each cut and a short way along each edge. A clipped element cannot show an outline outside itself, so a bevelled element that takes focus draws its focus ring inside.
- The canvas reads `--canvas-corners` with the colour tokens. In Amber it is `bevel`: chip and pin bodies have cut corners, and pin tabs, bit switches and order badges are square. Other themes keep `round`.
- Light, Dark and High contrast look as before.
- The fonts are npm packages (`@fontsource/chakra-petch`, the variable Orbitron package), so the build stays static and the service worker keeps them for offline use (ADR 18).
- The landing UI is the `landing` feature. The route keeps the data loading and the "New project" action.
- The index page now has the theme picker, next to the language picker.

## Consequences

- Visual baselines that do not pick a theme now show Amber. Generate them again with `pnpm e2e:visual:docker --update-snapshots`.
- Every theme must still pass the contrast tests in `themes.test.ts` and `themes-wire.test.ts`.
