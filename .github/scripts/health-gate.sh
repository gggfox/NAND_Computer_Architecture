#!/usr/bin/env bash
#
# Post-deploy health gate (ADR 51).
#
# Dokploy returns success when it queues a deployment, not when the new
# container serves. This script polls /version.json until it reports the commit
# of this run. On timeout it says how the deploy failed, because each failure
# has a different fix.
#
# Environment:
#   BASE_URL          public base URL, no trailing slash
#   EXPECTED_SHA      commit this run deploys
#   EXPECTED_IMAGE    immutable image reference that must run
#   TIMEOUT_SECONDS   optional, default 300
#   INTERVAL_SECONDS  optional, default 10
set -euo pipefail

: "${BASE_URL:?BASE_URL is required}"
: "${EXPECTED_SHA:?EXPECTED_SHA is required}"

VERSION_URL="${BASE_URL%/}/version.json"
EXPECTED_IMAGE="${EXPECTED_IMAGE:-<unknown>}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-300}"
INTERVAL_SECONDS="${INTERVAL_SECONDS:-10}"
DEADLINE=$((SECONDS + TIMEOUT_SECONDS))

attempt=0
last_failure="unreachable"
last_sha=""
last_status=""

echo "Polling $VERSION_URL for sha $EXPECTED_SHA (timeout ${TIMEOUT_SECONDS}s)"

while [ "$SECONDS" -lt "$DEADLINE" ]; do
	attempt=$((attempt + 1))
	body="$(mktemp)"
	status="$(curl -sS --max-time 10 -o "$body" -w '%{http_code}' "$VERSION_URL")" || status="000"

	case "$status" in
	200)
		observed="$(jq -r '.sha // empty' <"$body" 2>/dev/null || true)"
		if [ "$observed" = "$EXPECTED_SHA" ]; then
			echo "Health gate passed on attempt $attempt: $VERSION_URL reports sha $observed"
			rm -f "$body"
			exit 0
		fi
		if [ -n "$observed" ]; then
			last_failure="stale"
			last_sha="$observed"
			echo "Attempt $attempt: serving sha '$observed', expected '$EXPECTED_SHA'"
		else
			last_failure="malformed"
			echo "Attempt $attempt: HTTP 200 without a .sha field"
		fi
		;;
	000)
		last_failure="unreachable"
		echo "Attempt $attempt: no response (DNS, TLS or no container)"
		;;
	*)
		last_failure="http-error"
		last_status="$status"
		echo "Attempt $attempt: HTTP $status"
		;;
	esac

	rm -f "$body"
	sleep "$INTERVAL_SECONDS"
done

echo "::group::Deploy diagnosis"
case "$last_failure" in
stale)
	cat <<EOF
$BASE_URL serves a different build than this run deployed:

  expected  $EXPECTED_SHA
  serving   $last_sha

Dokploy accepted the rollout but did not replace the container. Check:

  1. Dokploy -> app -> Deployments: did a deployment start for this commit, and did it pass?
  2. Dokploy -> app -> General -> Docker image: it must be $EXPECTED_IMAGE,
     not a mutable :staging / :production tag.
  3. Dokploy -> app -> Logs: a new container that crashes on start leaves the old one serving.
EOF
	;;
unreachable)
	cat <<EOF
$VERSION_URL never answered. Check, in this sequence:

  1. Dokploy -> app -> Logs: did the container start? A failed GHCR pull
     (private image, wrong GHCR_PULL_TOKEN) shows here.
  2. The Let's Encrypt certificate: the first deploy to a new domain needs it.
  3. DNS: the domain must point to the Dokploy server.
EOF
	;;
http-error)
	cat <<EOF
$VERSION_URL answered HTTP $last_status. A 404 means the running image is older
than /version.json, or nginx does not use deploy/nginx.conf. A 502 or 503 means
Traefik has no healthy container. Read Dokploy -> app -> Logs.
EOF
	;;
malformed)
	cat <<EOF
$VERSION_URL answered 200 without a .sha field. Something other than this app
answers on the domain, or the SPA fallback served the shell because
version.json is missing from the image.
EOF
	;;
esac
echo "::endgroup::"

echo "::error::Health gate timed out after ${TIMEOUT_SECONDS}s: $VERSION_URL never reported sha $EXPECTED_SHA (failure: $last_failure)."
exit 1
