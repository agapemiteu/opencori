# Corri

Privacy-first geofencing and secure-delivery infrastructure.

Corri lets an app recognise that someone has arrived at a physical location and
deliver an encrypted request to the organisation that owns it. Corri routes the
message and issues the receipt. It cannot read what it carries.

The reference integration in this repository is a bank: a customer walks toward
a branch, says what they need, and the teller is ready before they reach the
counter. Only the bank holds the key.

## Contents

| Path                              | What it is                                 |
| --------------------------------- | ------------------------------------------ |
| `apps/api`                        | Presence, delivery, and receipts (NestJS)  |
| `apps/mock-receiver`              | Stands in for the receiving organisation   |
| `apps/demo`                       | Reference client app (Next.js)             |
| `packages/corri-react-native`     | Client SDK                                 |
| `packages/crypto-envelope`        | AES-256-GCM message, RSA-OAEP key wrapping |
| `packages/geofence-state-machine` | Arriving, visiting, leaving                |

## Run locally

Install [Node.js](https://nodejs.org) 22.14+, then `npm install -g pnpm`.

```bash
git clone https://github.com/agapemiteu/opencori.git
cd opencori
pnpm install
pnpm dev
```

No configuration, no database, no keys. Then open:

| What      | Address                                  |
| --------- | ---------------------------------------- |
| Demo app  | <http://localhost:3002>                  |
| Corri API | <http://localhost:3000/v1/health>        |
| Receiver  | <http://localhost:3001/v1/wema/messages> |

`pnpm check` runs format, lint, types, tests and build. Run it before pushing.

### Walking through the demo

In the app, in this order:

1. **Sync & Start Monitoring.** Loads the locations and starts watching.
2. **Trigger Approach (Marina).** Stands in for walking up to the branch.
3. **Yes, I am visiting.** Checks you in and starts the visit clock.
4. Pick a service, then **Send Secure Request.** A green bar confirms the
   receiver unlocked it.
5. **Complete Visit.** This brings up the rating form. It does not appear on its
   own after a send.

Open the receiver inbox to see it from the other side. The request is there in
plain text, because the receiver holds the key and Corri does not.

## How it works

1. The client detects the user is near a registered location and asks whether
   they are visiting.
2. The user opts in and picks what they need. Opting out sends nothing at all.
3. The device encrypts the message before it leaves the device.
4. Corri carries it to the receiving organisation and cannot open it.
5. The organisation decrypts it and prepares before the user arrives.
6. The client confirms delivery with a receipt.

Corri is the courier, not the reader. Consent is per visit, not a standing
permission.

You can verify the storage claim against a running instance:

```bash
curl "http://localhost:3000/v1/privacy?tenantId=wema&applicationId=alat-demo"
```

It answers `readableRequestContentStored: false` and
`retainedEncryptedPayloadCount: 0`.

## What the operator learns

Corri measures the visit without reading the request.

**Duration.** The clock starts at check-in and stops on leaving.
`/v1/analytics` reports the median and the slowest tenth, so an operator
sees the number without opening anybody's record.

**Satisfaction.** After the visit the client asks for a rating, offering reasons
such as Long Wait Time, Unresolved Issue, Crowded, or Staff Unresponsive. Put
that beside the measured duration and "long wait" stops being an opinion.

**By department.** The rating carries the services the user selected, so scores
attach to what they actually came for rather than to the site as a whole.

**By location.** Every visit carries the location it happened at, so sites can be
compared on volume, waiting time, and rating. Because only the receiving
organisation can decrypt a request, the content of that insight belongs to them
alone.

Ratings currently stay in the client and totals are not yet grouped by location.
The data is already tagged, so sending and grouping it is the next step, not a
rebuild.

## Operator control

The receiving organisation decides when Corri is on.

**Working now:** a location can be switched off. New visits are refused and
delivery stops immediately, including for a visit already in progress — the
switch needed during an incident or an unplanned closure.

**Next:** opening hours and public holidays, per location and in its own
timezone. The manual switch always overrides the schedule, because an emergency
is by definition what the schedule did not predict.

## API

Control API:

| Method | Endpoint                      | What it does                     |
| ------ | ----------------------------- | -------------------------------- |
| GET    | `/v1/health`                  | Is the service up                |
| GET    | `/v1/privacy`                 | What was and was not stored      |
| GET    | `/v1/analytics`               | Delivery speed and visit length  |
| GET    | `/v1/catalog`                 | Locations and public keys        |
| GET    | `/v1/branches`                | Location list                    |
| GET    | `/v1/sdk/configuration`       | Settings the app checks on start |
| GET    | `/v1/sdk/branches/nearby`     | Locations near a coordinate      |
| POST   | `/v1/sdk/visits/events`       | Arriving, visiting, leaving      |
| POST   | `/v1/sdk/deliveries`          | Send an encrypted message        |
| GET    | `/v1/sdk/deliveries/:eventId` | Delivery receipt                 |

Receiver, standing in for the receiving organisation's own system:

| Method | Endpoint              | What it does                   |
| ------ | --------------------- | ------------------------------ |
| GET    | `/v1/wema/messages`   | Messages the receiver unlocked |
| POST   | `/v1/wema/deliveries` | Where Corri drops them off     |

## Built with

| Layer      | Built with                                 |
| ---------- | ------------------------------------------ |
| Frontend   | Next.js, React, Tailwind CSS               |
| Backend    | NestJS on Fastify, TypeScript              |
| Database   | None. No customer data is stored           |
| Deployment | Vercel (frontend), Render (backend)        |
| Security   | AES-256-GCM message, RSA-OAEP key wrapping |

## Hosted demo

A deployed instance runs at <https://corri-alat-demo.vercel.app>.

Its backends are on Render's free plan and sleep after 15 minutes without
traffic; waking one takes about 25 seconds. A send goes app -> control API ->
receiver, so wake the receiver first:

```bash
curl -sS --fail --retry 3 --retry-all-errors --retry-delay 5 --max-time 150 https://corri-mock-wema-receiver.onrender.com/v1/wema/messages
curl -sS --fail --retry 3 --retry-all-errors --retry-delay 5 --max-time 150 https://corri-control-api.onrender.com/v1/health
```

The retry flags are not optional: a waking service refuses the first calls, so a
plain `curl` reports an error on exactly the case you are testing for. On Windows
PowerShell type `curl.exe` — plain `curl` there is an alias for
`Invoke-WebRequest` and ignores these flags.

The app starts both wakes itself when it loads, so a send rarely fails if you
forget. What you skip is the wait, because the app cannot finish loading until
the control API answers.

## Roadmap

- Opening hours and holidays, so availability is controlled automatically
- A dwell limit that asks whether the user is still waiting and flags a
  supervisor
- Send the visit rating to the backend, then group it by location and by
  department

## Documentation

- [Getting started](docs/GETTING_STARTED.md) — build a client against Corri
- [SDK reference](docs/SDK.md)
- [Trust boundary](docs/TRUST_BOUNDARY.md) — what Corri may and may not store
- [Location seed provenance](docs/BRANCH_SEED_PROVENANCE.md)

## License

[Apache-2.0](LICENSE).
