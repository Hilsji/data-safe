# syntax=docker/dockerfile:1
# Build-Kontext: Repo-Wurzel (docker compose setzt ihn)
# Optional: Schulnetz mit TLS-Inspektion → Zertifikat als Build-Secret „extra_ca“ übergeben (siehe README).
FROM node:22-bookworm-slim AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    npm ci --workspace apps/web --include-workspace-root

FROM deps AS build
COPY apps/web apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w apps/web

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN useradd --uid 10001 --create-home guide && mkdir -p /data/uploads && chown -R guide /data && chmod 700 /data/uploads
COPY --from=build --chown=guide /repo/apps/web/.next/standalone ./
COPY --from=build --chown=guide /repo/apps/web/.next/static ./apps/web/.next/static
USER guide
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
