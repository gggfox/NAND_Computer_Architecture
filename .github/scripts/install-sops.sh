#!/bin/sh
# Installs a pinned sops binary for the deploy workflows. sops decrypts age
# recipients natively, so the age CLI is not needed. Bump the version and the
# checksum together, from the release's sops-v<ver>.checksums.txt:
#   gh release download v<ver> -R getsops/sops -p 'sops-v<ver>.checksums.txt'
set -eu

SOPS_VERSION="3.13.3"
SOPS_SHA256="e5bec3346a873ae91d871550f3e698c1aad962aff462a080e40f25fde17fef6b"

tmp="$(mktemp)"
curl -fsSL --retry 3 -o "$tmp" \
	"https://github.com/getsops/sops/releases/download/v${SOPS_VERSION}/sops-v${SOPS_VERSION}.linux.amd64"
echo "${SOPS_SHA256}  ${tmp}" | sha256sum -c -
install -m 0755 "$tmp" /usr/local/bin/sops
rm -f "$tmp"
sops --disable-version-check --version
