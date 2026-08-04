# Architecture

## Current demo flow

```text
ALAT host
  -> @corri/sdk
  -> Corri control API
  -> signed encrypted delivery
  -> mock Wema receiver
  -> delivery receipt
```

The host app keeps readable customer text. It encrypts the request before calling Corri. Corri
handles visit metadata and the encrypted envelope. Only the receiver decrypts the request.

## Main components

- `apps/control-api`: signed configuration, nearby branches, visits, delivery, analytics, and
  privacy endpoints
- `apps/alat-demo`: host-side integration and encryption example
- `apps/mock-wema-receiver`: signed-delivery verification and receiver-side decryption
- `packages/corri-react-native`: published `@corri/sdk`
- `packages/contracts`: shared Zod schemas and TypeScript types
- `packages/geofence-state-machine`: visit state transitions
- `packages/config-verifier`: signed payload verification
- `packages/crypto-envelope`: envelope encryption helpers

## Current storage

Visit and delivery repositories are in memory. They prove the end-to-end behavior but do not
survive a process restart.

Production work still needs tenant-scoped database storage, a delivery queue, bounded retries,
reconciliation, expiry cleanup, and operational authentication.

## Boundary

Frontend applications use the SDK and HTTP contracts. They do not import control API services
or repository implementations. See [the trust boundary](TRUST_BOUNDARY.md) for the data Corri
may and may not process.
