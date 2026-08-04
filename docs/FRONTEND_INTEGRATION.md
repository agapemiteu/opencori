# Frontend Integration Contract

The frontend engineer owns presentation and interaction design. Backend modules provide a
stable, documented integration surface.

The complete package handoff is in `docs/SDK_PUBLIC_API.md`. Install it with
`npm install @corri/sdk`.

## Backend deliverables before frontend work

- Published `@corri/sdk@0.12.0` package and typed entry point
- Generated OpenAPI document for the control API
- Stable response envelopes and machine-readable error codes
- Seed commands and deterministic demo fixtures
- Typed event schemas for approach, visit, exit, delivery, and diagnostics
- Mock receiver endpoint behavior and signature-verification fixtures
- Clear labels for real, simulated, unavailable, and failed states

## Frontend constraints

- Frontend applications call public API and package interfaces only.
- Frontend applications do not import database schemas or application services.
- Corri screens never display decrypted request content.
- The mock Wema receiver is the only screen allowed to display demo plaintext.
- UI changes cannot redefine domain event names, delivery states, or visit timing rules.

Contract changes require versioning, migration notes, and consumer tests.

## Available demo configuration endpoints

The first backend slice provides these contract-validated endpoints:

- `GET /v1/demo/catalog`
- `GET /v1/demo/branches`
- `POST /v1/demo/configurations/publish`
- `GET /v1/sdk/branches/nearby`

Nearby queries require `tenantId`, `applicationId`, `lat`, `lng`, and `radiusKm`; `limit`
defaults to 20. Configuration and nearby responses are signed with Ed25519. The ALAT host must
pin the application's configuration-signing public key and verify the signature before using
either payload.

The current routes expose deterministic demo fixtures only. They are not authenticated admin
or production SDK routes, and the UI must retain the demo label.

## Available SDK and visit interfaces

The ALAT integration imports `createCorriClient` and typed events from `@corri/sdk`.
The current tested sequence is:

1. Initialize with tenant, application, anonymous installation, and pinned signing-key data.
2. Synchronize and verify configuration.
3. Synchronize and verify nearby branches.
4. Set branch-awareness consent and start monitoring.
5. Use `triggerControlledApproach` only in visibly labelled demo mode.
6. Confirm the visit, read `getVisitTimer`, record an exit candidate, and complete the stable
   exit after the configured grace period.

Visit metadata is sent to `POST /v1/sdk/visits/events`. Demo-only operational views read
`GET /v1/demo/analytics` and `GET /v1/demo/privacy`. The SDK queues visit events in memory
when the transport is unavailable and exposes an explicit flush method.

The package does not yet include native permission, background geofence, notification,
secure-storage, or Ed25519 adapters. The host supplies the signature-verification adapter until
the React Native implementation is added.

## Available encrypted delivery interfaces

`AlatDemoIntegration.sendCustomerRequest` encrypts readable text inside the host boundary with
AES-256-GCM and wraps its random content key for Wema with RSA-OAEP SHA-256. It passes only the
validated envelope to `CorriClient.deliverEncryptedRequest`. The SDK requires an active visit
for the same tenant, application, and branch.

The control API accepts and retrieves delivery state through:

- `POST /v1/sdk/deliveries`
- `GET /v1/sdk/deliveries/:eventId?tenantId=...`

Corri signs the outbound webhook with its separate Ed25519 delivery key. The mock receiver
verifies signature, timestamp, expiry, ciphertext hash, and replay consistency before decrypting
with its receiver-owned demo RSA private key. It exposes:

- `POST /v1/wema/deliveries`
- `GET /v1/wema/messages`

The delivery receipt contains identifiers, status, timestamps, attempt count, and latency. It
never contains readable request content. `GET /v1/demo/analytics` exposes median delivery latency
and branch-presence duration. `GET /v1/demo/privacy` reports retained record classes and proves
the successful demo path retains neither readable content nor ciphertext.

The checked-in cryptographic keys and routes are deterministic demo fixtures only. Production
keys must be generated, stored, rotated, and audited outside the repository. The visual ALAT,
receiver, and Developer Console screens remain frontend work. Generated OpenAPI is also still
pending.
