# syntax=docker/dockerfile:1

# Builds both backend services into one image. The service that actually runs
# is chosen at start time by dockerCommand in render.yaml, because Render
# blueprints cannot pass Docker build arguments.

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

FROM base AS build
WORKDIR /repo
COPY . .
# Installs only the two backends and their workspace dependencies. A plain
# install pulls in Next and React for alat-demo and website, which the backend
# never runs: 532 packages instead of 319, and enough memory to fail a build on
# a small instance.
RUN pnpm install --frozen-lockfile \
  --filter "@corri/control-api..." \
  --filter "@corri/mock-wema-receiver..."
RUN pnpm --filter "@corri/control-api..." --filter "@corri/mock-wema-receiver..." build
# Bundles each app with its workspace dependencies into a standalone tree.
# --legacy is required because this workspace does not inject dependencies.
RUN pnpm --filter "@corri/control-api" deploy --prod --legacy /out/control-api
RUN pnpm --filter "@corri/mock-wema-receiver" deploy --prod --legacy /out/receiver

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out /app
RUN addgroup -S corri && adduser -S corri -G corri && chown -R corri:corri /app
USER corri
EXPOSE 10000
CMD ["node", "control-api/dist/main.js"]
