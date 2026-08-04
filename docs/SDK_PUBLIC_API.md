# @corri/sdk public API

Status: reviewed patch prepared for publication

Repository package version: `0.12.1`

npm `latest`: `0.12.0` until the reviewed patch is published

Install:

```bash
npm install @corri/sdk
```

The npm `latest` tag now follows the proximity SDK. The former authorization SDK remains
available by installing `@corri/sdk@0.11.2`.

## Frontend setup

```ts
import {
  createCorriClient,
  type CorriEventMap,
  type DeliveryEnvelope,
  type DeliveryReceipt,
} from "@corri/sdk";

export const corri = createCorriClient({
  apiBaseUrl: environment.corriApiBaseUrl,
  publicApplicationKey: environment.corriPublicApplicationKey,
  fetch: globalThis.fetch,
  verifySignature: verifyEd25519,
  createId: (kind) => `${kind}_${secureRandomUuid()}`,
  initialization: {
    tenantId: "wema",
    applicationId: "alat-demo",
    anonymousInstallationId: installationId,
    configurationSigningKeyId: environment.corriConfigurationKeyId,
    configurationSigningPublicKey: environment.corriConfigurationPublicKey,
  },
});
```

`verifyEd25519` is a host-supplied React Native adapter in this initial release. It must verify the signed
payload against the pinned key and return `false` on any parse, key, or signature failure.

`secureRandomUuid` is also host supplied and must be cryptographically secure. The `createId`
option can be omitted only when the runtime provides `globalThis.crypto.randomUUID()`.

## Screen-to-API mapping

| Host screen or behavior       | SDK interface                                                          |
| ----------------------------- | ---------------------------------------------------------------------- |
| Branch Assistance setting     | `setConsent`, `getConsent`                                             |
| Branch monitor status         | `syncConfiguration`, `syncNearbyBranches`, `getDiagnostics`            |
| Incoming branch prompt        | `branchApproach` event                                                 |
| Yes, I am visiting            | `confirmVisit`                                                         |
| Not now                       | `snoozeBranch`                                                         |
| I am not visiting             | `declineVisit`                                                         |
| Ignore                        | `ignoreApproach`                                                       |
| Active visit                  | `visitStarted` event, `getVisitTimer`, `getActiveVisit`                |
| Manual exit fallback          | `completeVisitManually`                                                |
| Stable exit                   | `visitCompleted` event                                                 |
| Customer request submission   | Host encryption, then `deliverEncryptedRequest`                        |
| Delivery progress and receipt | `deliveryAccepted`, `deliveryCompleted`, `deliveryFailed`, receipt API |
| Debug or support panel        | `diagnostic` event and `getDiagnostics`                                |

The UI should subscribe once when a screen or application service mounts and call the returned
unsubscribe function during cleanup.

## Public methods

### Configuration and monitoring

- `syncConfiguration()`
- `syncNearbyBranches({ latitude, longitude, radiusKm?, limit? })`
- `setConsent({ branchAwareness, notifications })`
- `getConsent()`
- `startMonitoring()`
- `stopMonitoring()`
- `getRegisteredBranches()`

Monitoring requires a verified configuration and branch-awareness consent.

### Visit choices and state

- `confirmVisit()`
- `snoozeBranch()`
- `declineVisit()`
- `ignoreApproach()`
- `getVisitTimer()`
- `getActiveVisit()`
- `completeVisitManually()`

The timer starts only after `confirmVisit`. Prompt-choice methods reject calls when no prompt is
pending.

### Delivery

- `deliverEncryptedRequest(envelope: DeliveryEnvelope)`
- `getDeliveryReceipt(eventId)`

The SDK accepts only an opaque encrypted envelope matching the active visit. The frontend must
send readable text to a host-owned encryption service first. Readable content must never be
placed in Corri events, logs, diagnostics, or API requests.

### Events

- `configurationVerified`
- `configurationRejected`
- `branchApproach`
- `visitStarted`
- `visitCompleted`
- `deliveryAccepted`
- `deliveryCompleted`
- `deliveryFailed`
- `diagnostic`

Event payloads are available through `CorriEventMap`, and `on` enforces the correct payload type
for each event name.

## Demo-only methods

These methods exist for deterministic presenter controls and tests. Production UI must not call
them:

- `triggerControlledApproach`
- `recordControlledExit`
- `completeStableExit`
- `resetDemoState`

## Current limitations

- Native background geofence, permission, notification, and secure-storage adapters are pending.
- React Native Ed25519 verification and envelope-encryption adapters are pending.
- Offline visit events are queued in memory only.
- Delivery retry and durable receipt recovery remain server-side deferred work.
- `branchAmbiguous`, `visitExpired`, `deliveryRetrying`, and `permissionChanged` are not
  emitted yet and must not be mocked by the frontend.
