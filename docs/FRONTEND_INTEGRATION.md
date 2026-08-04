# Frontend guide

The frontend owns screens, permissions, notifications, native location handling, secure
storage, and readable customer text. Corri owns signed configuration, visit state, encrypted
delivery, and privacy-safe receipts.

## 1. Install

```bash
npm install @corri/sdk
```

Use version `0.12.1` or newer.

## 2. Create the client

```ts
import { createCorriClient, type CorriSignatureVerifier } from "@corri/sdk";

export function createAlatCorri(input: {
  apiBaseUrl: string;
  publicApplicationKey: string;
  installationId: string;
  signingKeyId: string;
  signingPublicKey: string;
  verifySignature: CorriSignatureVerifier;
  secureRandomUuid: () => string;
}) {
  return createCorriClient({
    apiBaseUrl: input.apiBaseUrl,
    publicApplicationKey: input.publicApplicationKey,
    fetch: globalThis.fetch,
    verifySignature: input.verifySignature,
    createId: (kind) => kind + "_" + input.secureRandomUuid(),
    initialization: {
      tenantId: "wema",
      applicationId: "alat-demo",
      anonymousInstallationId: input.installationId,
      configurationSigningKeyId: input.signingKeyId,
      configurationSigningPublicKey: input.signingPublicKey,
    },
  });
}
```

The host must provide an Ed25519 signature verifier and a cryptographically secure UUID source.
You may omit `createId` when `globalThis.crypto.randomUUID()` is available.

## 3. Start branch monitoring

```ts
await corri.syncConfiguration();
await corri.syncNearbyBranches({
  latitude: currentLocation.latitude,
  longitude: currentLocation.longitude,
});

corri.setConsent({
  branchAwareness: true,
  notifications: true,
});

corri.startMonitoring();
```

Configuration and nearby-branch data are signed. The SDK rejects invalid signatures, the wrong
tenant, the wrong application, and mismatched query results.

## 4. Connect screens to SDK events

```ts
const unsubscribe = corri.on("branchApproach", (branch) => {
  showVisitConfirmation(branch);
});

const visit = await corri.confirmVisit();
const timer = corri.getVisitTimer();

// Call during screen cleanup.
unsubscribe();
```

Use these actions for the confirmation screen:

| Customer action  | SDK call                  |
| ---------------- | ------------------------- |
| Confirm visit    | `confirmVisit()`          |
| Not now          | `snoozeBranch()`          |
| Not visiting     | `declineVisit()`          |
| Dismiss          | `ignoreApproach()`        |
| Manual visit end | `completeVisitManually()` |

`triggerControlledApproach`, `recordControlledExit`, and `completeStableExit` are for the
labelled demo only. Production location adapters must feed the same state-machine flow.

## 5. Send a customer request

Encrypt readable text inside the host application. Pass only the resulting
`DeliveryEnvelope` to Corri:

```ts
import type { DeliveryEnvelope } from "@corri/sdk";

export async function sendEnvelope(envelope: DeliveryEnvelope) {
  return corri.deliverEncryptedRequest(envelope);
}
```

The envelope must match the active tenant, application, branch, and visit. Never place readable
customer text in Corri events, logs, diagnostics, or API requests.

## HTTP endpoints

The SDK calls these control API routes:

| Method | Route                         | Purpose                              |
| ------ | ----------------------------- | ------------------------------------ |
| `GET`  | `/v1/sdk/configuration`       | Get signed application configuration |
| `GET`  | `/v1/sdk/branches/nearby`     | Get signed nearby branches           |
| `POST` | `/v1/sdk/visits/events`       | Record visit metadata                |
| `POST` | `/v1/sdk/deliveries`          | Relay an encrypted envelope          |
| `GET`  | `/v1/sdk/deliveries/:eventId` | Read a delivery receipt              |

Frontend-only demo views may also use:

- `GET /v1/demo/catalog`
- `GET /v1/demo/branches`
- `POST /v1/demo/configurations/publish`
- `GET /v1/demo/analytics`
- `GET /v1/demo/privacy`
- `GET /v1/wema/messages` on the mock receiver

Errors use one stable shape:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed",
    "requestId": "request-id"
  }
}
```

## Not ready for production

- Native React Native geofence, permission, notification, storage, and cryptography adapters
- Production API authentication and rate limiting
- Durable database storage, queued retries, and restart recovery
- Generated OpenAPI
- Production Wema branch coordinates and production cryptographic keys

See [the SDK reference](SDK_PUBLIC_API.md) for the complete public surface and
[the trust boundary](TRUST_BOUNDARY.md) for data-handling rules.
