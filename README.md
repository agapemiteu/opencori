# OpenCori

**Open-source, privacy-first geofencing and encrypted delivery.**

Let an app know a customer has arrived at your branch, and hear what they need
before they reach the counter — without OpenCori ever being able to read it.

[Live demo](https://opencori-demo.vercel.app) ·
[SDK](https://www.npmjs.com/package/@opencori/sdk) · Apache-2.0

---

## Why we built it

You take a number and wait. Twenty minutes, an hour. You get to the counter and
start from zero: who you are, what you need, what went wrong. The teller opens
your account while you talk. Nobody in that branch knew you were coming, or why.

The branch is just as blind. It cannot see how many people are inside, what they
came for, or who has been waiting an hour. It learns a visit went badly only if
someone complains, and most people just leave annoyed.

The obvious fix is to let people say what they need before they arrive. But
every version of that hands a middleman your complaints, your account details,
and a record of which branch you were in and when. **Fixing the queue by
creating a surveillance problem is not a fix.**

OpenCori is the fix without that trade. The message is encrypted on the device
and can only be opened by the organisation it was sent to. OpenCori routes it
and proves it arrived. It is the courier, not the reader.

## How it works

1. The app notices the customer is near a registered location and asks whether
   they are visiting.
2. They opt in and say what they need. Opting out sends nothing at all.
3. **The device encrypts the message before it leaves the device.**
4. OpenCori carries it to the organisation and cannot open it.
5. The organisation decrypts it and prepares before the customer arrives.
6. The app confirms delivery with a receipt.

Consent is per visit, not a standing permission. You can check the storage claim
against any running instance:

```bash
curl "https://corri-control-api.onrender.com/v1/privacy?tenantId=wema&applicationId=alat-demo"
```

It answers `readableRequestContentStored: false` and
`retainedEncryptedPayloadCount: 0`.

## Who it helps

**Banks and any organisation with branches.** Customers arrive expected instead
of queueing to explain themselves. You also get what you could never measure
inside the building: how long visits actually take, how they felt, and which
department or location is struggling — without reading anyone's request.

**Developers.** Two HTTP calls to onboard an organisation and upload its
locations. One npm package for the client. No proprietary SDK lock-in, no
per-seat pricing, no vendor holding your customers' data.

**Customers.** Nothing is sent unless they say yes, and only their bank can read
what they sent.

## Quick start

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

## Onboard your own locations

Two calls to get locations in. A third registers the app your customers use.

```bash
# 1. Register. The apiKey is returned once and never again.
curl -sX POST http://localhost:3000/v1/tenants \
  -H 'content-type: application/json' \
  -d '{"id":"your-bank","name":"Your Bank"}'

# 2. Upload locations. Idempotent by id, so re-send the whole file any time.
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
```

That is the whole required shape. Geofence radii default to 250 m approach,
100 m visit, 150 m exit — add `latitude` and `longitude` when you have them.

```bash
# 3. Register your app. OpenCori issues the signing key and returns the public
#    half; pin that in your client. You supply the receiver key, because only
#    you should be able to decrypt what your customers send.
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

Switch a location off, or change its radii:

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

No React Native or DOM dependency, one runtime dependency (`zod`), transport
injected — the same build runs in a React Native app, a browser, or Node. Source
and reference app: [agapemiteu/opencori-sdk](https://github.com/agapemiteu/opencori-sdk).

## API

Onboarding. Every route needs the organisation's API key except creating the
tenant, which is what issues it.

| Method | Endpoint                                           | What it does              |
| ------ | -------------------------------------------------- | ------------------------- |
| POST   | `/v1/tenants`                                      | Register, returns the key |
| POST   | `/v1/tenants/:tenantId/applications`               | Register an application   |
| GET    | `/v1/tenants/:tenantId/applications/:appId/policy` | Read timer and cooldowns  |
| PUT    | `/v1/tenants/:tenantId/applications/:appId/policy` | Set timer and cooldowns   |
| PUT    | `/v1/tenants/:tenantId/branches`                   | Bulk upload locations     |
| GET    | `/v1/tenants/:tenantId/branches`                   | List locations            |
| PATCH  | `/v1/tenants/:tenantId/branches/:branchId`         | Switch off, adjust radii  |

Read and device-facing routes.

| Method | Endpoint                      | What it does                     |
| ------ | ----------------------------- | -------------------------------- |
| GET    | `/v1/health`                  | Is the service up                |
| GET    | `/v1/privacy`                 | What was and was not stored      |
| GET    | `/v1/analytics`               | Delivery speed and visit length  |
| GET    | `/v1/catalog`                 | Locations and public keys        |
| GET    | `/v1/branches`                | Location list                    |
| POST   | `/v1/configurations/publish`  | Publish signed configuration     |
| GET    | `/v1/sdk/configuration`       | Settings the app checks on start |
| GET    | `/v1/sdk/branches/nearby`     | Locations near a coordinate      |
| POST   | `/v1/sdk/visits/events`       | Arriving, visiting, leaving      |
| POST   | `/v1/sdk/deliveries`          | Send an encrypted message        |
| GET    | `/v1/sdk/deliveries/:eventId` | Delivery receipt                 |

`/v1/sdk/*` is the surface the published SDK calls — treat those paths as a
released contract. The `demo/`-prefixed aliases exist for clients that predate
the rename.

## What the operator learns

OpenCori measures the visit without reading the request.

- **Duration** — the clock runs from check-in to leaving. `/v1/analytics`
  reports the median and the slowest tenth.
- **Satisfaction** — the client asks for a rating afterwards, with reasons like
  Long Wait Time or Unresolved Issue. Beside the measured duration, "long wait"
  stops being an opinion.
- **By department** — the rating carries the services the customer selected.
- **By location** — every visit carries where it happened, so sites can be
  compared on volume, waiting time, and rating.

Because only the receiving organisation can decrypt a request, the content
behind that insight belongs to them alone.

## Operator control

The organisation decides when OpenCori is on. A location can be switched off:
new visits are refused and delivery stops immediately, including for a visit
already in progress — the switch you need during an incident or an unplanned
closure.

## Storage

Two implementations of one interface, chosen by whether `DATABASE_URL` is set.

| `DATABASE_URL` | Catalog lives in | Survives a restart |
| -------------- | ---------------- | ------------------ |
| unset          | Memory           | No                 |
| set            | Postgres         | Yes                |

Unset is the default so local development and the tests need no database. To
add another store, implement `CatalogRepository` in
`apps/api/src/catalog/catalog.repository.ts` and return it from the factory in
`app.module.ts`. Read-only callers depend on the narrower `CatalogReader`.

Storing this does not weaken the privacy claim: locations and tenants are the
organisation's own configuration, not customer data.

## Project layout

| Path                       | What it is                                 |
| -------------------------- | ------------------------------------------ |
| `apps/api`                 | Presence, delivery, and receipts (NestJS)  |
| `apps/mock-receiver`       | Stands in for the organisation's system    |
| `packages/contracts`       | Wire schemas shared with the SDK           |
| `packages/crypto-envelope` | AES-256-GCM message, RSA-OAEP key wrapping |
| `packages/config-verifier` | Signs and verifies configuration           |

## Not built yet

- Opening hours and public holidays, so availability follows a schedule
- A dwell limit that asks whether the customer is still waiting
- Sending the visit rating to the backend and grouping it by location and
  department

## Contributing

Fork, branch, and open a pull request. Run `pnpm check` first — it must pass.
Tests live beside the code they cover; a bug fix should come with the test that
would have caught it.

## Deployments

| What     | Where                                           |
| -------- | ----------------------------------------------- |
| Demo     | <https://opencori-demo.vercel.app>              |
| API      | <https://corri-control-api.onrender.com>        |
| Receiver | <https://corri-mock-wema-receiver.onrender.com> |

The hosted backends run on a free plan and sleep after 15 minutes. Waking one
takes about 25 seconds, and a send goes app → API → receiver, so open the
receiver first, then the API, before demoing.

## License

[Apache-2.0](LICENSE).
