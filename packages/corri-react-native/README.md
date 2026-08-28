# @corri/sdk

Signed branch configuration, visit state, and encrypted delivery for host apps.

```bash
npm install @corri/sdk
```

Your backend supplies the API URL, public application key, tenant and application IDs,
and a pinned configuration-signing public key.

```ts
import { createCorriClient, verifySignedPayloadWithWebCrypto } from "@corri/sdk";

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

await corri.syncConfiguration();
await corri.syncNearbyBranches({ latitude, longitude });
corri.setConsent({ branchAwareness: true, notifications: true });
corri.startMonitoring();
```

The host must keep a stable anonymous installation ID and encrypt readable customer
text before calling `deliverEncryptedRequest()`.

Main methods:

- Visits: `confirmVisit()`, `getVisitTimer()`, `completeVisitManually()`
- Delivery: `deliverEncryptedRequest()`, `getDeliveryReceipt()`
- Events: `on()`, `off()`, `getDiagnostics()`

See the [quickstart and full reference](https://github.com/agapemiteu/opencori#readme).
