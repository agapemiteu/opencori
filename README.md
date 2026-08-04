# Corri

Corri adds privacy-safe branch awareness to mobile applications. It confirms opted-in
visits, measures branch-presence duration, and relays encrypted customer requests to an
organisation-owned receiver.

Corri never receives banking credentials, account data, or readable request content. The
host application encrypts each request before it reaches Corri.

## Current status

The first Wema and ALAT backend slice is working:

- signed Wema branch configuration and nearby-branch lookup
- the published `@corri/sdk` visit state machine
- customer confirmation, visit timing, and controlled exit
- host-side encryption and signed relay delivery
- mock Wema verification, decryption, and delivery receipts
- privacy-safe delivery latency and branch-presence metrics

Native mobile adapters, durable persistence, queued retries, and visual applications are
still pending. See [TODOS.md](TODOS.md) for the honest implementation boundary.

## Install the SDK

```bash
npm install @corri/sdk
```

```ts
import { createCorriClient } from "@corri/sdk";
```

The public API and frontend integration contract are documented in
[docs/SDK_PUBLIC_API.md](docs/SDK_PUBLIC_API.md).

## Repository

- `apps/control-api`: configuration, nearby branches, visits, delivery, analytics, and privacy APIs
- `apps/alat-demo`: typed host integration for the ALAT demonstration
- `apps/mock-wema-receiver`: Wema-owned receiver simulation
- `packages/corri-react-native`: source for the published `@corri/sdk` package
- `packages/contracts`: shared runtime and TypeScript contracts
- `packages/geofence-state-machine`: deterministic visit state logic
- `packages/config-verifier`: signed-configuration verification
- `packages/crypto-envelope`: host-side envelope encryption
- `docs`: build specification, trust boundary, decisions, and integration guides

## Development

Requires Node.js 24 and pnpm 11.

```bash
pnpm install
pnpm check
pnpm dev
```

The control API defaults to `http://localhost:3000`. The mock Wema receiver defaults to
`http://localhost:3001`.

Read [docs/BUILD_SPEC.md](docs/BUILD_SPEC.md) before changing product behaviour. Any change
that could expose readable customer content must preserve
[docs/TRUST_BOUNDARY.md](docs/TRUST_BOUNDARY.md).
