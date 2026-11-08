#!/usr/bin/env bash
#
# Tell Dokploy which image to run, then deploy it (ADR 51).
#
# Pins the application to the immutable per-commit reference
# `ghcr.io/garzafox/nand_computer_architecture:<sha>` with
# `application.saveDockerProvider`, then calls `application.deploy`. A mutable
# `:staging` / `:production` tag can be served from the server's local image
# cache, so a stale rollout can look green. A new reference on every deploy
# prevents that.
#
# The GHCR package is private, so Dokploy needs pull credentials. They are sent
# with every rollout, because saveDockerProvider replaces all of its fields.
#
# Set by `sops exec-env secrets/<env>.env`:
#   DOKPLOY_API_URL, DOKPLOY_API_KEY, DOKPLOY_APPLICATION_ID,
#   GHCR_PULL_USERNAME, GHCR_PULL_TOKEN (classic PAT with read:packages)
# Set by the workflow:
#   IMAGE_REF     immutable ghcr.io reference to roll out
#   DEPLOY_TITLE  label in the Dokploy deployment history
set -euo pipefail

: "${IMAGE_REF:?IMAGE_REF is required}"
DEPLOY_TITLE="${DEPLOY_TITLE:-$IMAGE_REF}"

for name in DOKPLOY_API_URL DOKPLOY_API_KEY DOKPLOY_APPLICATION_ID; do
	if [ -z "${!name:-}" ]; then
		echo "::error::$name is not set. Add it to this environment's secrets/<env>.env with sops."
		exit 1
	fi
done
if [ -z "${GHCR_PULL_USERNAME:-}" ] || [ -z "${GHCR_PULL_TOKEN:-}" ]; then
	echo "::error::GHCR_PULL_USERNAME and GHCR_PULL_TOKEN are not set. The GHCR image is private, so Dokploy cannot pull it. Add a classic PAT with read:packages to secrets/<env>.env with sops (see deploy/README.md)."
	exit 1
fi

# Values from `sops exec-env` are not GitHub secrets, so GitHub does not mask
# them. add-mask keeps them out of the log if Dokploy echoes them in an error.
echo "::add-mask::$DOKPLOY_API_KEY"
echo "::add-mask::$GHCR_PULL_TOKEN"

# `curl --config` keeps the key out of the process table.
CURL_CONFIG="$(mktemp)"
trap 'rm -f "$CURL_CONFIG"' EXIT
chmod 600 "$CURL_CONFIG"
printf 'header = "x-api-key: %s"\n' "$DOKPLOY_API_KEY" >"$CURL_CONFIG"

api_post() {
	local endpoint="$1" payload="$2" body status
	body="$(mktemp)"
	status="$(
		curl -sS --max-time 30 --config "$CURL_CONFIG" \
			-o "$body" -w '%{http_code}' \
			-X POST "${DOKPLOY_API_URL%/}/api/${endpoint}" \
			-H 'Content-Type: application/json' \
			--data-binary @-  <<<"$payload"
	)" || status="000"

	if [ "$status" -lt 200 ] || [ "$status" -ge 300 ]; then
		echo "::error::Dokploy ${endpoint} failed with HTTP ${status}: $(tr -d '\n' <"$body" | head -c 500)"
		rm -f "$body"
		return 1
	fi
	rm -f "$body"
	echo "Dokploy ${endpoint}: HTTP ${status}"
}

echo "Pinning the Dokploy application to $IMAGE_REF"
api_post application.saveDockerProvider "$(
	jq -n \
		--arg applicationId "$DOKPLOY_APPLICATION_ID" \
		--arg dockerImage "$IMAGE_REF" \
		--arg username "$GHCR_PULL_USERNAME" \
		--arg password "$GHCR_PULL_TOKEN" \
		'{
			applicationId: $applicationId,
			dockerImage: $dockerImage,
			username: $username,
			password: $password,
			registryUrl: "ghcr.io"
		}'
)"

api_post application.deploy "$(
	jq -n \
		--arg applicationId "$DOKPLOY_APPLICATION_ID" \
		--arg title "$DEPLOY_TITLE" \
		'{applicationId: $applicationId, title: $title}'
)"

echo "Dokploy accepted the rollout of $IMAGE_REF. The health gate checks that it serves."
