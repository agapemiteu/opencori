# OpenCori

Privacy-first geofencing and secure-delivery API.

OpenCori lets an organisation register its physical locations, then recognise
that a customer has arrived at one and receive an encrypted request from them
before they reach the counter. OpenCori routes the message and issues the
receipt. It cannot read what it carries.

The worked example is a bank branch: a customer walks toward a branch, their
banking app asks whether they are visiting, they say what they need, and the
teller is ready when they arrive. Only the bank holds the key.

This repository is the **API**. The client half — the SDK a banking app embeds,
and the reference app that drives it — lives in the SDK repository.

## Contents

| Path                       | What it is                                 |
| -------------------------- | ------------------------------------------ |
| `apps/api`                 | Presence, delivery, and receipts (NestJS)  |
| `apps/mock-receiver`       | Stands in for the receiving organisation   |
| `packages/contracts`       | Wire schemas shared with the SDK           |
| `packages/crypto-envelope` | AES-256-GCM message, RSA-OAEP key wrapping |
| `packages/config-verifier` | Signs and verifies configuration           |

## Run locally

Requires Node.js 22.14+ and pnpm 11+.

```bash
git clone https://github.com/agapemiteu/opencori.git
cd opencori
pnpm install
pnpm dev
```

No configuration, no database, no keys. Then:

| What     | Address                                  |
| -------- | ---------------------------------------- |
| API      | <http://localhost:3000/v1/health>        |
| Receiver | <http://localhost:3001/v1/wema/messages> |

`pnpm check` runs format, lint, types, tests and build. Run it before pushing.

## How it works

1. The client detects the user is near a registered location and asks whether
   they are visiting.
2. The user opts in and picks what they need. Opting out sends nothing at all.
3. The device encrypts the message before it leaves the device.
4. OpenCori carries it to the receiving organisation and cannot open it.
5. The organisation decrypts it and prepares before the user arrives.
6. The client confirms delivery with a receipt.

OpenCori is the courier, not the reader. Consent is per visit, not a standing
permission.

Verify the storage claim against a running instance:

```bash
curl "http://localhost:3000/v1/privacy?tenantId=wema&applicationId=alat-demo"
```

It answers `readableRequestContentStored: false` and
`retainedEncryptedPayloadCount: 0`.

## What the operator learns

OpenCori measures the visit without reading the request.

**Duration.** The clock starts at check-in and stops on leaving. `/v1/analytics`
reports the median and the slowest tenth, so an operator sees the number without
opening anybody's record.

**Satisfaction.** After the visit the client asks for a rating, offering reasons
such as Long Wait Time, Unresolved Issue, Crowded, or Staff Unresponsive. Put
that beside the measured duration and "long wait" stops being an opinion.

**By department.** The rating carries the services the user selected, so scores
attach to what they actually came for rather than to the site as a whole.

**By location.** Every visit carries the location it happened at, so sites can be
compared on volume, waiting time, and rating. Because only the receiving
organisation can decrypt a request, the content of that insight belongs to them
alone.

## Operator control

The receiving organisation decides when OpenCori is on.

**Working now:** a location can be switched off. New visits are refused and
delivery stops immediately, including for a visit already in progress — the
switch needed during an incident or an unplanned closure.

**Next:** opening hours and public holidays, per location and in its own
timezone. The manual switch always overrides the schedule, because an emergency
is by definition what the schedule did not predict.

## API

Onboarding. Every route needs the tenant's API key except creating the tenant,
which is what issues it:

| Method | Endpoint                                           | What it does              |
| ------ | -------------------------------------------------- | ------------------------- |
| POST   | `/v1/tenants`                                      | Register, returns the key |
| POST   | `/v1/tenants/:tenantId/applications`               | Register an application   |
| GET    | `/v1/tenants/:tenantId/applications/:appId/policy` | Read timer and cooldowns  |
| PUT    | `/v1/tenants/:tenantId/applications/:appId/policy` | Set timer and cooldowns   |
| PUT    | `/v1/tenants/:tenantId/branches`                   | Bulk upload locations     |
| GET    | `/v1/tenants/:tenantId/branches`                   | List locations            |
| PATCH  | `/v1/tenants/:tenantId/branches/:branchId`         | Switch off, adjust radii  |

Read and device-facing routes:

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

`/v1/sdk/*` is the device-facing surface the published SDK calls. Those paths are
a released contract — treat them as fixed.

Receiver, standing in for the receiving organisation's own system:

| Method | Endpoint              | What it does                   |
| ------ | --------------------- | ------------------------------ |
| GET    | `/v1/wema/messages`   | Messages the receiver unlocked |
| POST   | `/v1/wema/deliveries` | Where OpenCori drops them off  |

## Onboarding your own locations

Two calls. The first gives you a key; the second uploads your locations.

```bash
# 1. Register. The apiKey comes back once and is never shown again.
curl -sX POST http://localhost:3000/v1/tenants \
  -H 'content-type: application/json' \
  -d '{"id":"your-bank","name":"Your Bank"}'

# 2. Upload locations.
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

That is the whole required shape. The geofence radii default to 250 m approach,
100 m visit, 150 m exit; add `latitude` and `longitude` when you have them.
Upload is idempotent by `id`, so re-sending your whole location file moves only
what changed.

To switch a location off, or change its radii:

```bash
curl -sX PATCH http://localhost:3000/v1/tenants/your-bank/branches/marina \
  -H "authorization: Bearer $OPENCORI_API_KEY" \
  -H 'content-type: application/json' -d '{"active":false}'
```

The visit timer and cooldowns live on the application policy, at
`PUT /v1/tenants/:tenantId/applications/:applicationId/policy`.

## Not built yet

The catalog is held in memory and **does not survive a restart**.
`CatalogRepository` in `apps/api/src/catalog/` is the seam a durable
implementation slots into; nothing above it changes when it does.

Adding a database does not weaken the privacy claim. Locations and tenants are
the organisation's own configuration, not customer data. Nothing readable about
a customer request is stored either way.

## Built with

| Layer      | Built with                                 |
| ---------- | ------------------------------------------ |
| Backend    | NestJS on Fastify, TypeScript              |
| Database   | None. No customer data is stored           |
| Deployment | Render, via `Dockerfile` and `render.yaml` |
| Security   | AES-256-GCM message, RSA-OAEP key wrapping |

## Hosted instance

The backends run on Render's free plan and sleep after 15 minutes without
traffic; waking one takes about 25 seconds. A send goes app -> API -> receiver,
so wake the receiver first:

```bash
curl -sS --fail --retry 3 --retry-all-errors --retry-delay 5 --max-time 150 https://corri-mock-wema-receiver.onrender.com/v1/wema/messages
curl -sS --fail --retry 3 --retry-all-errors --retry-delay 5 --max-time 150 https://corri-control-api.onrender.com/v1/health
```

The retry flags are not optional: a waking service refuses the first calls, so a
plain `curl` reports an error on exactly the case you are testing for. On Windows
PowerShell type `curl.exe` — plain `curl` there is an alias for
`Invoke-WebRequest` and ignores these flags.

## Documentation

- [SDK reference](docs/SDK.md)
- [Trust boundary](docs/TRUST_BOUNDARY.md) — what OpenCori may and may not store
- [Location seed provenance](docs/BRANCH_SEED_PROVENANCE.md)

## License

[Apache-2.0](LICENSE).
