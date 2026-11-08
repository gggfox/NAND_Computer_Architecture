# Runtime image for Dokploy (ADR 51). CI runs `pnpm build` first; this image only serves
# dist/client with nginx, so it needs no Node toolchain.
FROM nginx:1.29-alpine

# The commit the image serves. The deploy health gate reads it from /version.json.
ARG GIT_SHA=dev

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY dist/client /usr/share/nginx/html
RUN printf '{"sha":"%s"}\n' "$GIT_SHA" > /usr/share/nginx/html/version.json

EXPOSE 80
