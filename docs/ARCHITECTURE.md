# Corri Architecture

## Backend-first build boundary

The current engineering phase owns domain contracts, control APIs, persistence, delivery,
security, SDK logic, testing infrastructure, and integration documentation. Frontend
applications consume these contracts later.

```text
ALAT host application
  |
  | signed configuration and nearby branch requests
  v
Corri Context SDK ---- local geofence state machine
  |
  | visit metadata and encrypted request envelope
  v
Control API ---- PostgreSQL + PostGIS
  |
  | validated delivery job
  v
Redis + BullMQ worker
  |
  | signed encrypted webhook
  v
Wema-owned receiver

Developer console and demo screens consume Control API contracts.
They never bypass the API or import persistence modules.
```

## Module boundaries

- `packages/contracts`: versioned Zod schemas and TypeScript types.
- `packages/geofence-state-machine`: pure, deterministic visit-state transitions.
- `packages/config-verifier`: signed configuration verification.
- `packages/crypto-envelope`: host-side envelope encryption and receiver-side test helpers.
- `packages/delivery-client`: direct and managed-relay client behavior.
- `packages/corri-react-native`: public React Native SDK facade.
- `packages/test-harness`: deterministic clocks, IDs, fixtures, and integration drivers.
- `apps/control-api`: NestJS/Fastify HTTP API and application services.
- `infra`: migrations, local dependencies, seed data, and deployment definitions.

Domain packages do not import application code. Applications may import public package APIs.
Persistence types do not leak into HTTP contracts.

## First vertical slice

```text
branch import
  -> configuration publish
  -> nearby branch response
  -> controlled approach
  -> customer confirmation
  -> visit start
  -> encrypted delivery
  -> receiver receipt
  -> stable exit
  -> visit completion and privacy-safe metrics
```

Every controlled demo event enters the same domain services as the native path.

## Continuity paths

```text
No mobile data
  -> cached signed configuration
  -> native geofence
  -> local notification
  -> encrypted local outbox
  -> idempotent replay after reconnect

SMS fallback
  -> bank-owned SMS gateway
  -> signed normalized command
  -> Corri control API
  -> existing visit application service
  -> receipt through bank-owned SMS gateway
```

Corri does not store phone numbers or raw SMS messages. See `docs/RISK_MANAGEMENT.md`
and ADR 0002.
