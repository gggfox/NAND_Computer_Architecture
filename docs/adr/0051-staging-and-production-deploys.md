# 51. Staging and production deploys from one GHCR image

Every commit on `main` that passes CI goes to `staging.nand.gggfox.com`. A person promotes staging to `nand.gggfox.com` with a manual workflow. Both run on Dokploy.

The `Deploy staging` workflow starts when CI passes on `main`. It builds the app, pushes a private image to GHCR as `:<sha>` and `:staging`, and fast-forwards the `staging` branch. The `Promote to production` workflow tags the image of the staging commit as `:production` and fast-forwards the `production` branch. It does not rebuild, so production runs the image that staging ran.

Dokploy always runs the immutable `:<sha>` reference, never a mutable tag. A mutable tag can come from the server's image cache, so a stale rollout can look green. After each rollout, a health gate polls `/version.json` until it reports the deployed commit.

The deploy secrets are in `secrets/<env>.env`, encrypted with sops and age. Only the CI age key is a GitHub secret (`SOPS_AGE_KEY`). This copies the deploy pattern of the Tavli project.

The build stays host-neutral ([ADR 18](0018-host-neutral-static-build.md)): the Dockerfile only packages `dist/client` with `deploy/nginx.conf`. A ruleset blocks deletion of, and force pushes to, `staging` and `production`.
