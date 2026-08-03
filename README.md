# Corri

Corri is privacy-first geofencing and secure-delivery infrastructure for mobile
applications. It detects confirmed physical visits, measures branch-presence duration,
and delivers organisation-owned encrypted requests to organisation-defined destinations.

This repository is being built backend-first. The current milestone establishes shared
contracts, deterministic domain logic, the control API, persistence boundaries, and the
integration surface required by a later frontend implementation.

## Requirements

- Node.js 24
- pnpm 11
- PostgreSQL with PostGIS for database-backed development
- Redis for queue-backed delivery development

## Commands

```bash
pnpm install
pnpm check
pnpm dev
```

The control API listens on `http://localhost:3000` by default. Its first endpoint is
`GET /v1/health`.

Read `docs/BUILD_SPEC.md` before implementing product behavior.
