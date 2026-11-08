# 55. CI uses fewer runner minutes

The repository is private, so GitHub bills each runner minute. From 1 to 8 November 2026, CI used about 3,700 minutes. One push to a pull request cost about 170 minutes.

## Decisions

- The `push` trigger runs only on `main`. Before, one push to a pull request branch started a `push` run and a `pull_request` run. The two runs had different refs, so the concurrency group did not cancel one of them.
- Pull requests run two Playwright projects: `chromium` and `mobile-safari`. They cover Blink, WebKit and touch input. Pushes to `main` run all six projects from ADR 34.
- A `build` job builds `dist/` one time and uploads it. The e2e and visual jobs download it and set `E2E_PREBUILT`, so the Playwright web server starts `pnpm preview` and does not build again.
- The required checks from ADR 35 stay `check`, `e2e` and `visual`.

## Consequences

- A bug that shows only in Firefox, desktop WebKit, phone Chromium or the tablet can merge. The `main` run finds it before staging deploys, because ADR 51 deploys only commits whose CI passes.
- If the `build` job fails, the e2e and visual jobs fail at the download step. Thus a failed build cannot pass the required checks.
- Local runs do not set `E2E_PREBUILT`, so `pnpm e2e` still builds first.
