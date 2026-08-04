# Corri

Corri helps opted-in mobile apps recognise a branch visit and send an encrypted customer
request to the organisation that owns the branch.

Corri receives visit metadata and encrypted data. It does not receive readable complaints,
banking credentials, account numbers, or transaction data.

## Use the SDK

```bash
npm install @corri/sdk
```

```ts
import { createCorriClient } from "@corri/sdk";
```

Start with the [frontend guide](docs/FRONTEND_INTEGRATION.md). Use the
[SDK and HTTP reference](docs/SDK_PUBLIC_API.md) when you need exact methods, events, or routes.

## What works

- Signed Wema configuration and nearby-branch responses
- Customer confirmation, visit timing, and controlled exit
- Host-side request encryption
- Encrypted delivery to the mock Wema receiver
- Receiver verification, decryption, and delivery receipts
- Delivery latency, branch-presence duration, and privacy proof

This is a tested demo slice. Native mobile adapters, durable storage, queued retries,
production authentication, and visual applications are not finished.

## Run locally

Requires Node.js 22.14 or newer and pnpm 11 or newer.

```bash
pnpm install
pnpm check
pnpm dev
```

The control API uses `http://localhost:3000`. The mock Wema receiver uses
`http://localhost:3001`.

## Repository guide

- `apps/control-api`: SDK, demo, delivery, analytics, and privacy endpoints
- `apps/alat-demo`: ALAT host integration example
- `apps/mock-wema-receiver`: receiver verification and decryption demo
- `packages/corri-react-native`: source for `@corri/sdk`
- `packages/contracts`: shared schemas and types

Security rules are defined in [the trust boundary](docs/TRUST_BOUNDARY.md). The current
service flow is described in [the architecture summary](docs/ARCHITECTURE.md).
