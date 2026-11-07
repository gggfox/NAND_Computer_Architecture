# Deploy examples

The app is a static single-page app (ADR 18). `pnpm build` emits it to `dist/client`, with the
SPA entry at `dist/client/_shell.html` (there is no `index.html`).

## Requirements for any host

1. Serve `dist/client` as the web root.
2. Rewrite unknown paths to `/_shell.html` with status **200** (not a 301/302 redirect, not a 404), so deep links such as `/chip/abc` load the app.
3. Do not rewrite `sw.js` or `manifest.webmanifest`. They must be served as real files.
4. Serve `sw.js` with `Cache-Control: no-cache` so browsers pick up new service workers.

## Examples

| File          | Host                      | Notes                                                                                         |
| ------------- | ------------------------- | --------------------------------------------------------------------------------------------- |
| `nginx.conf`  | Dokploy, any nginx        | `index _shell.html;` + `try_files $uri /_shell.html;` plus cache headers                      |
| `.htaccess`   | Hostinger, Apache         | `FallbackResource` (off for `/assets/`), `DirectoryIndex _shell.html`; needs `mod_headers`    |
| `vercel.json` | Vercel                    | Rewrite excludes `sw.js`, manifest and `assets/`                                              |
| `_redirects`  | Cloudflare Pages, Netlify | `/assets/*` 404 (Netlify only), then `/* /_shell.html 200`; add a `_headers` rule for `sw.js` |

For Cloudflare Pages, add a `_headers` file next to `_redirects`:

```
/sw.js
  Cache-Control: no-cache
```

On Cloudflare Pages and Netlify, `/* /_shell.html 200` only applies when no static file matches, so `sw.js`, the manifest and assets are served as-is.
Netlify returns 404 for a missing `/assets/*` file. Cloudflare Pages does not support the 404 status in `_redirects`, so it serves the shell for a missing asset.

`vercel.json` must be copied to the project root (Vercel reads it from there, not from the output directory).

These files are examples: copy the one you need into the deployed output or host configuration.
They are not part of the build.

## The live deploy (Dokploy)

[ADR 51](../docs/adr/0051-staging-and-production-deploys.md) describes the design.

| Environment | URL                               | Branch       | Updated by                                |
| ----------- | --------------------------------- | ------------ | ----------------------------------------- |
| staging     | <https://staging.nand.gggfox.com> | `staging`    | `Deploy staging`, after CI passes on main |
| production  | <https://nand.gggfox.com>         | `production` | `Promote to production`, started by hand  |

The image is `ghcr.io/garzafox/nand_computer_architecture`. The Dokploy project is "NAND".

### Promote staging to production

1. Open <https://staging.nand.gggfox.com> and check the release.
2. Run the workflow:

   ```bash
   gh workflow run promote-production.yml
   ```

3. Wait until the run passes. Its health gate checks that production serves the staging commit.

### Edit the deploy secrets

The secrets are in `secrets/staging.env` and `secrets/production.env`, encrypted with sops and age.
Your age key must be in `~/.config/sops/age/keys.txt`.

1. Open the file in your editor. sops decrypts it and encrypts it again on save:

   ```bash
   sops secrets/staging.env
   ```

2. Do the same for `secrets/production.env` if the value applies to both.
3. Commit the encrypted file.

Each file holds these keys:

| Key                      | Value                                                |
| ------------------------ | ---------------------------------------------------- |
| `DOKPLOY_API_URL`        | `https://dokploy.gggfox.com`                         |
| `DOKPLOY_API_KEY`        | A Dokploy API key                                    |
| `DOKPLOY_APPLICATION_ID` | The Dokploy application of this environment          |
| `GHCR_PULL_USERNAME`     | The GitHub user that owns `GHCR_PULL_TOKEN`          |
| `GHCR_PULL_TOKEN`        | A classic PAT with only `read:packages`, for Dokploy |

The GHCR image is private, so the rollout stops with an error until both files have `GHCR_PULL_USERNAME` and `GHCR_PULL_TOKEN`.

### Set or rotate the CI age key

The CI key is the repository secret `SOPS_AGE_KEY`. Its local copy is `~/.config/sops/age/nand.txt`.

1. Set the secret from the local copy:

   ```bash
   grep AGE-SECRET-KEY ~/.config/sops/age/nand.txt | gh secret set SOPS_AGE_KEY
   ```

2. To rotate it, make a new key with `age-keygen`, and put its public key in `.sops.yaml`.
3. Re-key both files:

   ```bash
   sops updatekeys secrets/staging.env
   ```

   ```bash
   sops updatekeys secrets/production.env
   ```

4. Set `SOPS_AGE_KEY` to the new private key (step 1).
