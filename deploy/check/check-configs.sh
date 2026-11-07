#!/usr/bin/env bash
# Checks the nginx and Apache examples in deploy/ with Docker. CI and developers run it from the repo root.
# The nginx image is the one in the Dockerfile, so the check tests the config that ships.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
nginx_image="$(sed -n 's/^FROM \(nginx:[^ ]*\).*/\1/p' "$root/Dockerfile" | head -n 1)"
httpd_image="httpd:2.4"

if [ -z "$nginx_image" ]; then
  echo "check-configs: no nginx image in the Dockerfile." >&2
  exit 1
fi

echo "== nginx -t ($nginx_image)"
docker run --rm \
  -v "$root/deploy/nginx.conf:/etc/nginx/conf.d/default.conf:ro" \
  "$nginx_image" nginx -t

# httpd -t does not read .htaccess, so the test vhost includes it. The request test below runs
# the real .htaccess with AllowOverride All.
echo "== httpd -t ($httpd_image)"
work="$(mktemp -d)"
trap 'rm -rf "$work"; docker rm -f deploy-check-httpd >/dev/null 2>&1 || true' EXIT
mkdir -p "$work/spa/assets"
echo "shell" > "$work/spa/_shell.html"
echo "app" > "$work/spa/assets/app.js"
echo "worker" > "$work/spa/sw.js"
cp "$root/deploy/.htaccess" "$work/spa/.htaccess"
chmod -R a+rX "$work"

httpd_args=(
  -v "$work/spa:/var/www/spa:ro"
  -v "$root/deploy/check/httpd-vhost.conf:/usr/local/apache2/conf/extra/spa-vhost.conf:ro"
)
setup='echo "Include conf/extra/spa-vhost.conf" >> /usr/local/apache2/conf/httpd.conf'
docker run --rm "${httpd_args[@]}" "$httpd_image" \
  sh -c "$setup && httpd -t"

echo "== httpd requests ($httpd_image)"
docker run -d --name deploy-check-httpd -p 127.0.0.1:8089:80 "${httpd_args[@]}" "$httpd_image" \
  sh -c "$setup && httpd-foreground" >/dev/null
for _ in $(seq 1 30); do
  if curl -s -o /dev/null http://127.0.0.1:8089/; then
    break
  fi
  sleep 1
done

status() {
  curl -s -o /dev/null -w '%{http_code}' -H 'Host: spa.test' "http://127.0.0.1:8089$1"
}
failed=0
expect() {
  local actual
  actual="$(status "$1")"
  if [ "$actual" = "$2" ]; then
    echo "ok   $1 -> $actual"
  else
    echo "FAIL $1 -> $actual (expected $2)" >&2
    failed=1
  fi
}
expect / 200
expect /some/unknown/route 200
expect /sw.js 200
expect /assets/app.js 200
expect /assets/missing.js 404
exit "$failed"
