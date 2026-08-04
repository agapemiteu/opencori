# @corri/sdk

Privacy-first branch presence and encrypted-delivery SDK for host applications.

Install:

```bash
npm install @corri/sdk
```

Version `0.12.0` began the Corri proximity-platform SDK line. This repository contains the
reviewed `0.12.1` patch. The former authorization SDK remains available as
`@corri/sdk@0.11.2`.

## Host integration

```ts
import { createCorriClient } from "@corri/sdk";

const corri = createCorriClient({
  apiBaseUrl: "https://api.example.com",
  publicApplicationKey: "public_app_key",
  fetch: globalThis.fetch,
  verifySignature: verifyEd25519,
  createId: (kind) => `${kind}_${secureRandomUuid()}`,
  initialization: {
    tenantId: "wema",
    applicationId: "alat-demo",
    anonymousInstallationId: "install_random_id",
    configurationSigningKeyId: "config_key_1",
    configurationSigningPublicKey: "-----BEGIN PUBLIC KEY-----\n...",
  },
});

await corri.syncConfiguration();
await corri.syncNearbyBranches({ latitude: 6.45, longitude: 3.39 });
corri.setConsent({ branchAwareness: true, notifications: true });
corri.startMonitoring();

const unsubscribe = corri.on("branchApproach", (event) => {
  hostApp.showBranchConfirmation(event);
});
```

`createId` must use a cryptographically secure UUID source. It can be omitted only when the host
runtime provides `globalThis.crypto.randomUUID()`.

The host owns all screens and readable customer data. Pass only a host-encrypted
`DeliveryEnvelope` to `deliverEncryptedRequest`.

## Public surface

- `createCorriClient`
- `syncConfiguration`
- `syncNearbyBranches`
- `setConsent` and `getConsent`
- `startMonitoring` and `stopMonitoring`
- `getRegisteredBranches`
- `confirmVisit`, `snoozeBranch`, `declineVisit`, and `ignoreApproach`
- `getVisitTimer` and `getActiveVisit`
- `completeVisitManually`
- `deliverEncryptedRequest` and `getDeliveryReceipt`
- `flushPendingVisitEvents`
- `getDiagnostics`
- `on` and `off`

`triggerControlledApproach`, `recordControlledExit`, `completeStableExit`, and
`resetDemoState` exist only for the controlled demo and test harness. Native permission,
background geofence, notification, secure-storage, and React Native cryptography adapters are
not included yet.
