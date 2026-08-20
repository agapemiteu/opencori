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
RUN pnpm install --frozen-lockfile
# Builds both apps and every workspace package they depend on.
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
