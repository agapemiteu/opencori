# Build the ALAT demo

You build the screens. Corri already provides signed configuration, visit state,
browser encryption, delivery, and receipts.

## 1. Fork and run

Fork <https://github.com/agapemiteu/corri>, then run:

```bash
git clone https://github.com/<your-github-name>/corri.git
cd corri
git remote add upstream https://github.com/agapemiteu/corri.git
pnpm install
pnpm check
pnpm dev
```

Replace `<your-github-name>` with your GitHub username. Keep `pnpm dev`
running.

| Check                                    | Expected                         |
| ---------------------------------------- | -------------------------------- |
| <http://localhost:3000/v1/health>        | API health JSON                  |
| <http://localhost:3000/v1/demo/catalog>  | Wema and ALAT demo configuration |
| <http://localhost:3001/v1/wema/messages> | An empty list before delivery    |

Run the frontend on port `3002`. That is the API's allowed local browser origin.

## 2. Create the Corri host

In a browser-only file under `apps/alat-demo/src`:

```ts
import { createAlatDemoHost, loadAlatDemoBrowserBootstrap } from "./index.js";

const key = "corri.demo.installation-id";

function installationId() {
  const saved = localStorage.getItem(key);
  if (saved) return saved;

  const created = "inst_" + crypto.randomUUID();
  localStorage.setItem(key, created);
  return created;
}

export async function startCorri() {
  const setup = await loadAlatDemoBrowserBootstrap({
    apiBaseUrl: "http://localhost:3000",
    anonymousInstallationId: installationId(),
  });

  const host = createAlatDemoHost(setup.dependencies);
  await host.initialize(setup.initialization);
  return host;
}
```

Call `startCorri()` once in a client-side effect. Keep the returned host in app
state or React context.

## 3. Run the controlled visit

```ts
const host = await startCorri();

await host.corri.syncNearbyBranches({
  latitude: 6.45,
  longitude: 3.395,
});

host.corri.setConsent({
  branchAwareness: true,
  notifications: true,
});

host.corri.on("branchApproach", showConfirmationScreen);
host.corri.startMonitoring();
host.corri.triggerControlledApproach("wema_marina");
```

`triggerControlledApproach()` is demo-only. Production apps need a native
location adapter.

## 4. Connect the screens

| Customer action | SDK call                                   |
| --------------- | ------------------------------------------ |
| Confirm visit   | `await host.corri.confirmVisit()`          |
| Not now         | `host.corri.snoozeBranch()`                |
| Not visiting    | `host.corri.declineVisit()`                |
| Dismiss         | `host.corri.ignoreApproach()`              |
| Show timer      | `host.corri.getVisitTimer()`               |
| End visit       | `await host.corri.completeVisitManually()` |

Send the form text through the host:

```ts
const receipt = await host.sendCustomerRequest(customerText);
```

The host encrypts before calling Corri. After delivery, check:

- Receiver message: <http://localhost:3001/v1/wema/messages>
- Latency and visit duration: <http://localhost:3000/v1/demo/analytics>
- Privacy proof: <http://localhost:3000/v1/demo/privacy>

To demo a controlled exit:

```ts
host.corri.recordControlledExit();
await host.corri.completeStableExit();
```

## Keep these boundaries

- Never replace signature verification with `return true`.
- Never send readable customer text to Corri.
- Never import `@corri/crypto-envelope` into browser code.
- Never commit `.next`, `dist`, `node_modules`, keys, or local env files.

## Fix common errors

| Error              | Fix                                                           |
| ------------------ | ------------------------------------------------------------- |
| CORS blocked       | Use port 3002 or update `CORRI_CORS_ORIGINS`.                 |
| Catalog is 404     | Restart `pnpm dev`.                                           |
| Signature rejected | Use `loadAlatDemoBrowserBootstrap()`.                         |
| Request rejected   | Confirm a visit before sending.                               |
| Huge pull request  | Remove generated `.next` files and rebase on `upstream/main`. |

Before a pull request:

```bash
git fetch upstream
git rebase upstream/main
pnpm check
```

See the [SDK reference](SDK.md) for every method, event, and route.
