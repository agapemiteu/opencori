# OpenCori

**Open-source geofencing and encrypted delivery for physical branches.**

Why does walking into a bank still feel like the bank has no idea you're there?
You enter, take a number, wait, and when it is finally your turn, you explain
everything from scratch.

OpenCori lets the branch know what you need before you reach the counter,
without OpenCori being able to read what you said.

[Live demo](https://opencori-demo.vercel.app) ·
[SDK on npm](https://www.npmjs.com/package/@opencori/sdk) · Apache-2.0

## What happens when a customer uses it

1. The customer comes close to a bank's configured geofence, and the banking app
   asks: **"Are you visiting this branch?"**
2. If they tap yes, they select what they came for: card replacement, loan
   services, an account issue.
3. **The request is encrypted on the device before it leaves the phone.**
4. OpenCori routes the encrypted request to the bank. Only the bank can open it.
   OpenCori does not have the key.
5. The branch gets useful context before the customer reaches the counter.

Tapping no sends nothing at all. Consent is per visit, not a setting switched on
once and forgotten.

We did not want to improve the branch experience by creating another place where
customer information could be exposed. That was the part we cared about most, so
it is something you can check rather than trust:

```bash
curl "https://corri-control-api.onrender.com/v1/privacy?tenantId=wema&applicationId=alat-demo"
```

It answers `readableRequestContentStored: false` and
`retainedEncryptedPayloadCount: 0`.

## What the bank learns

OpenCori tracks the visit and collects feedback afterwards, without reading the
request. So instead of seeing **"2 stars"**, a manager can see
**"2 stars, Loan Services, Marina branch."**

That is a much more useful signal. `/v1/analytics` reports visit duration,
the median and the slowest tenth, and every visit carries the location it
happened at, so branches can be compared on volume, waiting time, and rating.

## Run it

Requires Node.js 22.14+ and pnpm 11+.

```bash
git clone https://github.com/agapemiteu/opencori.git
cd opencori
pnpm install
pnpm dev
```

No configuration, no database, no keys.

| What     | Address                                  |
| -------- | ---------------------------------------- |
| API      | <http://localhost:3000/v1/health>        |
| Receiver | <http://localhost:3001/v1/wema/messages> |

`pnpm check` runs format, lint, types, tests, and build.

## Onboard a bank

Two calls to get branches in. A third registers the app customers use.

```bash
# 1. Register. The apiKey is returned once and never again.
curl -sX POST http://localhost:3000/v1/tenants \
  -H 'content-type: application/json' \
  -d '{"id":"your-bank","name":"Your Bank"}'

# 2. Upload branches. Idempotent by id, so re-send the whole file any time.
curl -sX PUT http://localhost:3000/v1/tenants/your-bank/branches \
  -H "authorization: Bearer $OPENCORI_API_KEY" \
  -H 'content-type: application/json' \
  -d '{"branches":[{
        "id":"marina",
        "externalBranchId":"WB-001",
        "name":"Marina",
        "addressLine1":"54 Marina",
        "city":"Lagos",
        "stateOrRegion":"Lagos",
        "countryCode":"NG",
        "timeZone":"Africa/Lagos"
      }]}'

# 3. Register the app. OpenCori issues the signing key and returns the public
#    half to pin in your client. You supply the receiver key, because only you
#    should be able to decrypt what your customers send.
curl -sX POST http://localhost:3000/v1/tenants/your-bank/applications \
  -H "authorization: Bearer $OPENCORI_API_KEY" \
  -H 'content-type: application/json' \
  -d '{
        "id":"mobile",
        "name":"Your Banking App",
        "publicApplicationKey":"pk_live_yourbank",
        "receiverEncryptionKeyId":"receiver-key-1",
        "receiverEncryptionPublicKey":"-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n"
      }'
```

Eight fields is the whole required shape for a branch. Geofence radii default to
250 m approach, 100 m visit, 150 m exit. Add `latitude` and `longitude` when you
have them.

Switching a branch off refuses new visits and stops delivery immediately, even
for a visit already in progress:

```bash
curl -sX PATCH http://localhost:3000/v1/tenants/your-bank/branches/marina \
  -H "authorization: Bearer $OPENCORI_API_KEY" \
  -H 'content-type: application/json' -d '{"active":false}'
```

The visit timer and cooldowns live on the application policy, at
`PUT /v1/tenants/:tenantId/applications/:applicationId/policy`.

## Client SDK

```bash
npm install @opencori/sdk
```

No React Native or DOM dependency and one runtime dependency (`zod`), so the same
build runs in a React Native app, a browser, or Node. Source and reference app:
[agapemiteu/opencori-sdk](https://github.com/agapemiteu/opencori-sdk).

## API

Onboarding. Every route needs the bank's API key except creating the tenant,
which is what issues it.

| Method | Endpoint                                           | What it does              |
| ------ | -------------------------------------------------- | ------------------------- |
| POST   | `/v1/tenants`                                      | Register, returns the key |
| POST   | `/v1/tenants/:tenantId/applications`               | Register an application   |
| GET    | `/v1/tenants/:tenantId/applications/:appId/policy` | Read timer and cooldowns  |
| PUT    | `/v1/tenants/:tenantId/applications/:appId/policy` | Set timer and cooldowns   |
| PUT    | `/v1/tenants/:tenantId/branches`                   | Bulk upload branches      |
| GET    | `/v1/tenants/:tenantId/branches`                   | List branches             |
| PATCH  | `/v1/tenants/:tenantId/branches/:branchId`         | Switch off, adjust radii  |

Read and device-facing routes.

| Method | Endpoint                      | What it does                     |
| ------ | ----------------------------- | -------------------------------- |
| GET    | `/v1/health`                  | Is the service up                |
| GET    | `/v1/privacy`                 | What was and was not stored      |
| GET    | `/v1/analytics`               | Delivery speed and visit length  |
| GET    | `/v1/catalog`                 | Branches and public keys         |
| GET    | `/v1/branches`                | Branch list                      |
| POST   | `/v1/configurations/publish`  | Publish signed configuration     |
| GET    | `/v1/sdk/configuration`       | Settings the app checks on start |
| GET    | `/v1/sdk/branches/nearby`     | Branches near a coordinate       |
| POST   | `/v1/sdk/visits/events`       | Arriving, visiting, leaving      |
| POST   | `/v1/sdk/deliveries`          | Send an encrypted message        |
| GET    | `/v1/sdk/deliveries/:eventId` | Delivery receipt                 |

`/v1/sdk/*` is the surface the published SDK calls, so treat those paths as a
released contract.

## Layout

| Path                       | What it is                                 |
| -------------------------- | ------------------------------------------ |
| `apps/api`                 | Presence, delivery, and receipts (NestJS)  |
| `apps/mock-receiver`       | Stands in for the bank's own system        |
| `packages/contracts`       | Wire schemas shared with the SDK           |
| `packages/crypto-envelope` | AES-256-GCM message, RSA-OAEP key wrapping |
| `packages/config-verifier` | Signs and verifies configuration           |

## Storage

Two implementations of one interface, chosen by whether `DATABASE_URL` is set:
unset keeps the catalog in memory, which is what local development and the tests
use; set makes it durable in Postgres, with no other change.

To add another store, implement `CatalogRepository` in
`apps/api/src/catalog/catalog.repository.ts` and return it from the factory in
`app.module.ts`. Read-only callers depend on the narrower `CatalogReader`.

Storing this does not weaken the privacy claim. Branches and banks are the
organisation's own configuration, not customer data.

## Not built yet

- Opening hours and public holidays, so availability follows a schedule
- A dwell limit that asks whether the customer is still waiting
- Sending the visit rating to the backend and grouping it by branch and service

## Contributing

We built the core, proved the approach, and made the project public for anyone
interested in taking it further. There are still things that can be improved, and
we are not trying to build every possible version ourselves.

Fork it, branch, and open a pull request. Run `pnpm check` first, and it must pass.
Tests live beside the code they cover, and a bug fix should come with the test
that would have caught it.

## Deployments

| What     | Where                                           |
| -------- | ----------------------------------------------- |
| Demo     | <https://opencori-demo.vercel.app>              |
| API      | <https://corri-control-api.onrender.com>        |
| Receiver | <https://corri-mock-wema-receiver.onrender.com> |

The hosted backends run on a free plan and sleep after 15 minutes. Waking one
takes about 25 seconds, and a send goes app → API → receiver, so open the
receiver first, then the API, before demoing.

## Credits

Built by [Agape Miteu](https://github.com/agapemiteu) (backend: APIs, encrypted
delivery, branch onboarding, storage, privacy controls) and Michael Omoniyi
(frontend: geofence prompt, service selection, snooze flow, visit states,
feedback experience).

We used Wema Bank's publicly available branch information as a reference
integration. OpenCori is an independent open-source project and is not
affiliated with or endorsed by Wema Bank.

## License

[Apache-2.0](LICENSE).
