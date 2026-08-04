# SDK and HTTP reference

`@corri/sdk@0.12.1` is published on npm with the `latest` tag.

```bash
npm install @corri/sdk
```

## Runtime exports

| Export                | Use                                         |
| --------------------- | ------------------------------------------- |
| `createCorriClient`   | Create and initialize the normal SDK client |
| `CorriClient`         | Build a client with a custom transport      |
| `FetchCorriTransport` | Call the Corri HTTP API                     |
| `CorriTransportError` | Read a failed HTTP status                   |

Types such as `DeliveryEnvelope`, `DeliveryReceipt`, `CorriEventMap`, and
`CorriSignatureVerifier` are also exported for TypeScript.

## Client options

`createCorriClient(options)` accepts:

| Option                                         | Required | Meaning                                            |
| ---------------------------------------------- | -------- | -------------------------------------------------- |
| `apiBaseUrl`                                   | Yes      | Control API base URL                               |
| `publicApplicationKey`                         | Yes      | Public host application key sent with API requests |
| `fetch`                                        | Yes      | Host fetch implementation                          |
| `verifySignature`                              | Yes      | Host Ed25519 verification function                 |
| `initialization.tenantId`                      | Yes      | `wema` for the demo                                |
| `initialization.applicationId`                 | Yes      | `alat-demo` for the demo                           |
| `initialization.anonymousInstallationId`       | Yes      | Anonymous local installation ID                    |
| `initialization.configurationSigningKeyId`     | Yes      | Pinned configuration key ID                        |
| `initialization.configurationSigningPublicKey` | Yes      | Pinned Ed25519 public key                          |
| `createId`                                     | No       | Secure event and visit ID function                 |
| `now`                                          | No       | Clock override for deterministic tests             |

## Client methods

Configuration and monitoring:

- `syncConfiguration()`
- `syncNearbyBranches({ latitude, longitude, radiusKm?, limit? })`
- `setConsent({ branchAwareness, notifications })`
- `getConsent()`
- `startMonitoring()`
- `stopMonitoring()`
- `getRegisteredBranches()`

Visit handling:

- `confirmVisit()`
- `snoozeBranch()`
- `declineVisit()`
- `ignoreApproach()`
- `getVisitTimer()`
- `getActiveVisit()`
- `completeVisitManually()`

Encrypted delivery:

- `deliverEncryptedRequest(envelope)`
- `getDeliveryReceipt(eventId)`

Recovery and support:

- `flushPendingVisitEvents()`
- `getDiagnostics()`
- `on(eventName, listener)`
- `off(eventName, listener)`

## Events

| Event                   | Meaning                             |
| ----------------------- | ----------------------------------- |
| `configurationVerified` | Signed configuration accepted       |
| `configurationRejected` | Configuration or scope rejected     |
| `branchApproach`        | Ask the customer to confirm a visit |
| `visitStarted`          | Customer confirmed the visit        |
| `visitCompleted`        | Visit ended                         |
| `deliveryAccepted`      | Encrypted request accepted          |
| `deliveryCompleted`     | Receiver returned a valid receipt   |
| `deliveryFailed`        | Delivery failed                     |
| `diagnostic`            | Privacy-safe SDK diagnostic         |

`on()` returns an unsubscribe function.

## Demo-only methods

Do not call these from a production UI:

- `triggerControlledApproach()`
- `recordControlledExit()`
- `completeStableExit()`
- `resetDemoState()`

## Control API

Default local base URL: `http://localhost:3000`

| Method | Route                         | Required input                                                          |
| ------ | ----------------------------- | ----------------------------------------------------------------------- |
| `GET`  | `/v1/health`                  | None                                                                    |
| `GET`  | `/v1/sdk/configuration`       | `tenantId`, `applicationId`                                             |
| `GET`  | `/v1/sdk/branches/nearby`     | `tenantId`, `applicationId`, `lat`, `lng`; optional `radiusKm`, `limit` |
| `POST` | `/v1/sdk/visits/events`       | A typed visit event                                                     |
| `POST` | `/v1/sdk/deliveries`          | An encrypted `DeliveryEnvelope`                                         |
| `GET`  | `/v1/sdk/deliveries/:eventId` | `tenantId` query value                                                  |

Demo routes:

- `GET /v1/demo/catalog`
- `GET /v1/demo/branches`
- `POST /v1/demo/configurations/publish`
- `GET /v1/demo/analytics`
- `GET /v1/demo/privacy`

Mock receiver routes use `http://localhost:3001`:

- `POST /v1/wema/deliveries`
- `GET /v1/wema/messages`

## Rules the frontend must keep

1. Verify signed configuration before monitoring.
2. Ask for consent before branch awareness starts.
3. Encrypt readable requests inside the host app.
4. Send only an encrypted envelope to Corri.
5. Display readable demo text only in the mock Wema receiver.
6. Keep controlled methods visibly labelled as demo behavior.

The current API is a demo interface. Production authentication, rate limiting, native mobile
adapters, durable persistence, queued delivery recovery, and OpenAPI generation are pending.

See [the frontend guide](FRONTEND_INTEGRATION.md) for the shortest integration path.
