# 24. TypeScript 7 with the oxc toolchain

TypeScript 7 (native) only, no TS 6 alias. Lint: oxlint + tsgolint (type-aware), with JS plugins sonarjs (cognitive complexity), eslint-plugin-boundaries (feature rules) and a local ban-throw rule; `import/no-cycle` for cycles. Format: oxfmt (beta; fall back to Prettier if it causes trouble). CSS: Stylelint with CSS Modules, ordering and a11y plugins, plus typed CSS Module class names. Also knip, lefthook, cspell (en + es).

Accepted losses: typescript-eslint `naming-convention` and `prefer-destructuring`; no custom type-aware rules (e.g. "Result must be handled"). Rejected: ESLint + typescript-eslint (no TS 7 support; jsx-a11y lacks ESLint 10 support), Biome as sole linter (typed rules still nursery). Revisit dependency-cruiser when its stable release supports TS 7, and a thin ESLint pass if custom typed rules become necessary. See docs/research/2026-10-29-lint-tooling-options.md.
