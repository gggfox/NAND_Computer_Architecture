# Deploy examples

The app is a static single-page app (ADR 18). `pnpm build` emits it to `dist/client`, with the
SPA entry at `dist/client/_shell.html` (there is no `index.html`).

## Requirements for any host

1. Serve `dist/client` as the web root.
2. Rewrite unknown paths to `/_shell.html` with status **200** (not a 301/302 redirect, not a 404), so deep links such as `/chip/abc` load the app.
3. Do not rewrite `sw.js` or `manifest.webmanifest`. They must be served as real files.
4. Serve `sw.js` with `Cache-Control: no-cache` so browsers pick up new service workers.

## Examples

| File          | Host                      | Notes                                                    |
| ------------- | ------------------------- | -------------------------------------------------------- |
| `nginx.conf`  | Dokploy, any nginx        | `try_files $uri $uri/ /_shell.html;` plus cache headers  |
| `.htaccess`   | Hostinger, Apache         | `FallbackResource /_shell.html`; needs `mod_headers`     |
| `vercel.json` | Vercel                    | Rewrite excludes `sw.js`, manifest and `assets/`         |
| `_redirects`  | Cloudflare Pages, Netlify | `/* /_shell.html 200`; add a `_headers` rule for `sw.js` |

For Cloudflare Pages, add a `_headers` file next to `_redirects`:

```
/sw.js
  Cache-Control: no-cache
```

These files are examples: copy the one you need into the deployed output or host configuration.
They are not part of the build.
