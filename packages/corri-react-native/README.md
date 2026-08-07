# @corri/sdk

Corri SDK handles signed branch configuration, visit state, and encrypted request delivery.

```bash
npm install @corri/sdk
```

```ts
import { createCorriClient, verifySignedPayloadWithWebCrypto } from "@corri/sdk";

const corri = createCorriClient({
  apiBaseUrl: "https://api.example.com",
  publicApplicationKey: "public-application-key",
  fetch: globalThis.fetch,
  verifySignature: verifySignedPayloadWithWebCrypto,
  createId: (kind) => kind + "_" + secureRandomUuid(),
  initialization: {
    tenantId: "wema",
    applicationId: "alat-demo",
    anonymousInstallationId: installationId,
    configurationSigningKeyId: signingKeyId,
    configurationSigningPublicKey: signingPublicKey,
  },
});

await corri.syncConfiguration();
await corri.syncNearbyBranches({ latitude: 6.45, longitude: 3.395 });
corri.setConsent({ branchAwareness: true, notifications: true });
corri.startMonitoring();
```

`verifySignedPayloadWithWebCrypto` is for browsers with Ed25519 Web Crypto support.
Native hosts may provide their own verifier. Every host must provide secure UUIDs, location
behavior, secure storage, and request encryption. Send only an encrypted
`DeliveryEnvelope` to `deliverEncryptedRequest()`.

Main methods:

- `syncConfiguration()` and `syncNearbyBranches()`
- `setConsent()`, `startMonitoring()`, and `stopMonitoring()`
- `confirmVisit()`, `getVisitTimer()`, and `completeVisitManually()`
- `deliverEncryptedRequest()` and `getDeliveryReceipt()`
- `on()`, `off()`, and `getDiagnostics()`

Version `0.12.2` is the current npm `latest` release.
