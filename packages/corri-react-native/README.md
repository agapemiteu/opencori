# @corri/sdk

Corri SDK handles signed branch configuration, visit state, and encrypted request delivery.

```bash
npm install @corri/sdk
```

```ts
import { createCorriClient } from "@corri/sdk";

const corri = createCorriClient({
  apiBaseUrl: "https://api.example.com",
  publicApplicationKey: "public-application-key",
  fetch: globalThis.fetch,
  verifySignature: verifyEd25519,
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

The host application must provide signature verification, a secure UUID source, native
location behavior, secure storage, and request encryption. Send only an encrypted
`DeliveryEnvelope` to `deliverEncryptedRequest()`.

Main methods:

- `syncConfiguration()` and `syncNearbyBranches()`
- `setConsent()`, `startMonitoring()`, and `stopMonitoring()`
- `confirmVisit()`, `getVisitTimer()`, and `completeVisitManually()`
- `deliverEncryptedRequest()` and `getDeliveryReceipt()`
- `on()`, `off()`, and `getDiagnostics()`

Version `0.12.1` is the current npm `latest` release.
