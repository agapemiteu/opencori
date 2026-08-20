# syntax=docker/dockerfile:1

# One image definition for both backend services. Pick which one with the APP
# build argument, wired up in fly.control-api.toml and fly.receiver.toml.

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

FROM base AS build
WORKDIR /repo
COPY . .
ARG APP
RUN pnpm install --frozen-lockfile
# Builds the app and every workspace package it depends on.
RUN pnpm --filter "${APP}..." build
# Bundles the app plus its workspace dependencies into a standalone tree.
# --legacy is required because this workspace does not inject dependencies.
RUN pnpm --filter "${APP}" deploy --prod --legacy /out

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out .
RUN addgroup -S corri && adduser -S corri -G corri && chown -R corri:corri /app
USER corri
EXPOSE 8080
CMD ["node", "dist/main.js"]
