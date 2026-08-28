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

## Not built yet

Locations are currently a fixed seed in `apps/api/src/demo/demo-seed.ts`: one
tenant, one application, ten branches. There is no way for an organisation to
onboard its own.

Reaching "any developer onboards any organisation's locations" needs four
things:

- Persistence, so a catalog outlives a restart
- Write endpoints: create tenant, create application, bulk-upload locations
- API keys, so an organisation authenticates as itself
- Per-location settings, starting with the visit timer

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
