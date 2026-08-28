# Corri SDK

`@opencori/sdk` handles signed branch configuration, visit state, and encrypted
delivery.

```bash
npm install @opencori/sdk
```

Forking this repo? Use the tested helper in [Getting started](GETTING_STARTED.md).
Use the API below when adding Corri to another host app.

## Exports

| Export                             | Purpose                                  |
| ---------------------------------- | ---------------------------------------- |
| `createCorriClient`                | Create the standard client               |
| `CorriClient`                      | Create a client with custom dependencies |
| `FetchCorriTransport`              | Call the Corri HTTP API                  |
| `CorriTransportError`              | Read a failed HTTP status                |
| `verifySignedPayloadWithWebCrypto` | Verify Ed25519 in browsers               |

Types such as `DeliveryEnvelope`, `DeliveryReceipt`,
`CorriEventMap`, and `CorriSignatureVerifier` are also exported.

## Create a client

```ts
import { createCorriClient, verifySignedPayloadWithWebCrypto } from "@opencori/sdk";

const corri = createCorriClient({
  apiBaseUrl,
  publicApplicationKey,
  fetch: globalThis.fetch,
  verifySignature: verifySignedPayloadWithWebCrypto,
  initialization: {
    tenantId,
    applicationId,
    anonymousInstallationId,
    configurationSigningKeyId,
    configurationSigningPublicKey,
  },
});
```

The backend must provide the IDs and public keys. Production apps must pin the
configuration-signing public key.

| Option                 | Required | Purpose                                        |
| ---------------------- | -------- | ---------------------------------------------- |
| `apiBaseUrl`           | Yes      | Corri API URL                                  |
| `publicApplicationKey` | Yes      | Identify the host app                          |
| `fetch`                | Yes      | Send HTTP requests                             |
| `verifySignature`      | Yes      | Verify Ed25519 signatures                      |
| `initialization.*`     | Yes      | Set tenant, app, installation, and signing key |
| `createId`             | No       | Override secure event and visit IDs            |
| `now`                  | No       | Override time in tests                         |

The default ID factory uses `crypto.randomUUID()`.

## Start in this order

```ts
await corri.syncConfiguration();
await corri.syncNearbyBranches({ latitude, longitude });
corri.setConsent({ branchAwareness: true, notifications: true });
corri.startMonitoring();
```

The SDK rejects invalid signatures, scope mismatches, stale configuration versions,
and nearby results that do not match the query.

## Methods

| Group         | Methods                                                                  |
| ------------- | ------------------------------------------------------------------------ |
| Configuration | `syncConfiguration()`, `syncNearbyBranches()`                            |
| Consent       | `setConsent()`, `getConsent()`                                           |
| Monitoring    | `startMonitoring()`, `stopMonitoring()`, `getRegisteredBranches()`       |
| Visit         | `confirmVisit()`, `snoozeBranch()`, `declineVisit()`, `ignoreApproach()` |
| Visit state   | `getVisitTimer()`, `getActiveVisit()`, `completeVisitManually()`         |
| Delivery      | `deliverEncryptedRequest()`, `getDeliveryReceipt()`                      |
| Recovery      | `flushPendingVisitEvents()`, `getDiagnostics()`                          |
| Events        | `on()`, `off()`                                                          |

`syncNearbyBranches()` accepts `latitude`, `longitude`, optional
`radiusKm` (default 50), and optional `limit` (default 20).

Delivery must match the active tenant, application, branch, and visit token.
Queued visit events are currently in memory and do not survive a restart.

## Events

| Event                   | Meaning                     |
| ----------------------- | --------------------------- |
| `configurationVerified` | Configuration accepted      |
| `configurationRejected` | Signature or scope rejected |
| `branchApproach`        | Ask for visit confirmation  |
| `visitStarted`          | Visit confirmed             |
| `visitCompleted`        | Visit ended                 |
| `deliveryAccepted`      | Encrypted request accepted  |
| `deliveryCompleted`     | Receiver delivered it       |
| `deliveryFailed`        | Delivery failed             |
| `diagnostic`            | Privacy-safe diagnostic     |

`on()` returns an unsubscribe function.

Demo-only methods: `triggerControlledApproach()`,
`recordControlledExit()`, `completeStableExit()`, and
`resetDemoState()`.

## HTTP routes

Corri API: `http://localhost:3000`

| Method | Route                         |
| ------ | ----------------------------- |
| `GET`  | `/v1/health`                  |
| `GET`  | `/v1/sdk/configuration`       |
| `GET`  | `/v1/sdk/branches/nearby`     |
| `POST` | `/v1/sdk/visits/events`       |
| `POST` | `/v1/sdk/deliveries`          |
| `GET`  | `/v1/sdk/deliveries/:eventId` |

Demo routes: `/v1/demo/catalog`, `/v1/demo/branches`,
`/v1/demo/configurations/publish`, `/v1/demo/analytics`, and
`/v1/demo/privacy`.

Mock receiver: `POST /v1/wema/deliveries` and
`GET /v1/wema/messages` on `http://localhost:3001`.

Errors use this shape:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed",
    "requestId": "request-id"
  }
}
```

Read the [privacy boundary](TRUST_BOUNDARY.md) before adding data to a request,
event, diagnostic, or log.
