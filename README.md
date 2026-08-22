# Corri

## Team Members

- Agape Miteu
- Michael Omoniyi

---

## 🚀 Live Demo

- **Live Application:** <https://corri-alat-demo.vercel.app>
- **Backend API:** [what Corri stored](https://corri-control-api.onrender.com/v1/demo/privacy?tenantId=wema&applicationId=alat-demo) · [speed and visits](https://corri-control-api.onrender.com/v1/demo/analytics?tenantId=wema&applicationId=alat-demo) · [the bank's inbox](https://corri-mock-wema-receiver.onrender.com/v1/wema/messages)
- **Recorded Demo:** TODO: add the Loom link

The backend sleeps when nobody is using it. If the app shows an error, open
<https://corri-control-api.onrender.com/v1/health>, wait for it to answer, then
reload. That takes up to a minute the first time and is instant afterwards.

---

## 🎯 The Problem

> **How might we** let a customer tell a bank branch what they came for, without
> the app in the middle being able to read it?

You walk into a Wema branch and join the queue. When you finally reach the
counter, you explain your problem from scratch. The teller starts from zero.
Everybody waits.

The obvious fix is to send your message ahead. But then whoever runs that
service is holding your complaint, your account details, and a record of which
branch you were in and when. That is a lot of personal information sitting
somewhere it does not need to be.

## ✨ Our Solution

Corri lives inside ALAT. There is no new app to download and no new account.

1. You get close to a Wema branch. ALAT asks if you are visiting.
2. You say yes and pick what you need: card pickup, cash withdrawal, a complaint.
3. Your phone locks the message before it leaves your phone.
4. Corri carries the locked message to the bank. Corri cannot open it.
5. The bank unlocks it. The teller sees what you need before you reach the counter.
6. ALAT shows you a receipt saying it arrived.

Only the bank holds the key. Corri is the courier, not the reader.

You do not have to take our word for it. The API will tell you what it kept:

```bash
curl "https://corri-control-api.onrender.com/v1/demo/privacy?tenantId=wema&applicationId=alat-demo"
```

It answers `readableRequestContentStored: false` and
`retainedEncryptedPayloadCount: 0`. No message text, no account data, nothing
held afterwards.

Last measured delivery took **123 milliseconds**, phone to bank.

### It also times your visit

The clock starts the moment you tap "Yes, I'm visiting" and stops when you
leave. That gives the branch one number it never had: how long you were
actually in there.

Ten minutes is a normal visit. Two hours usually means something went wrong.
Nobody attended to you, or your problem needed a manager and never got one.
Right now a branch only finds out when a customer complains afterwards, and
most people just leave angry instead.

The bank sees the duration, not who you are. `/v1/demo/analytics` reports the
middle and the slowest tenth across all visits, so a branch manager can see
"half our customers are stuck here over 40 minutes" without opening anybody's
personal record.

```bash
curl "https://corri-control-api.onrender.com/v1/demo/analytics?tenantId=wema&applicationId=alat-demo"
```

**Not built yet:** acting on it automatically. The next step is a limit, say two
hours, that asks the customer if they are still waiting and flags the visit for
a supervisor. The timing is already recorded. The rule that reacts to it is not
written.

### What the branch gets

A bank measures everything online. How long a page took, where people gave up,
whether they came back. Inside the building it measures almost nothing. The
branch is the most expensive thing the bank owns and the least understood.

Corri gives the branch the same feedback loop, without watching anyone in
particular: how many people came in, what they came for, how long they stayed,
and how they felt about it.

When the visit ends, ALAT asks for a rating out of five. Rate it low and it
offers Long Wait Time, Unresolved Issue, Crowded, Staff Unresponsive. Rate it
high and it offers Friendly Staff, Fast Service, Issue Resolved, Clean
Environment. Put that beside the measured duration and "long wait" stops being
an opinion and becomes a number the branch can act on.

**Not wired up yet:** the rating is collected in the app but not sent to the
backend, so it does not reach the analytics.

---

## 🛠️ Tech Stack

- **Frontend:** Next.js, React, Tailwind CSS
- **Backend:** NestJS on Fastify, TypeScript
- **Database:** None. Nothing about the customer is stored
- **Deployment:** Vercel (frontend), Render (backend)
- **Security:** AES-256-GCM to lock the message, RSA-OAEP to lock the key

---

## 🔌 Backend API

### See it working

These are live. Click them.

| Link                                                                                                               | What it shows                         |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| [What we stored](https://corri-control-api.onrender.com/v1/demo/privacy?tenantId=wema&applicationId=alat-demo)     | Proof no message text was kept        |
| [Speed and visits](https://corri-control-api.onrender.com/v1/demo/analytics?tenantId=wema&applicationId=alat-demo) | Delivery time, how long people stayed |
| [The bank's inbox](https://corri-mock-wema-receiver.onrender.com/v1/wema/messages)                                 | Messages the bank unlocked            |
| [Branches and keys](https://corri-control-api.onrender.com/v1/demo/catalog)                                        | What the app is configured with       |
| [Is it up](https://corri-control-api.onrender.com/v1/health)                                                       | Service status                        |

### Everything else

Base URL: `https://corri-control-api.onrender.com`

| Method | Endpoint                      | What it does                     |
| ------ | ----------------------------- | -------------------------------- |
| GET    | `/v1/health`                  | Is the service up                |
| GET    | `/v1/demo/catalog`            | Branches and public keys         |
| GET    | `/v1/demo/branches`           | Branch list                      |
| GET    | `/v1/demo/analytics`          | Delivery speed and visit counts  |
| GET    | `/v1/demo/privacy`            | What was and was not stored      |
| GET    | `/v1/sdk/configuration`       | Settings the app checks on start |
| GET    | `/v1/sdk/branches/nearby`     | Branches near a location         |
| POST   | `/v1/sdk/visits/events`       | Arriving, visiting, leaving      |
| POST   | `/v1/sdk/deliveries`          | Send a locked message            |
| GET    | `/v1/sdk/deliveries/:eventId` | Did it arrive                    |

The bank's side, standing in for Wema's real system. Base URL:
`https://corri-mock-wema-receiver.onrender.com`

| Method | Endpoint              | What it does               |
| ------ | --------------------- | -------------------------- |
| GET    | `/v1/wema/messages`   | Messages the bank unlocked |
| POST   | `/v1/wema/deliveries` | Where Corri drops them off |

### If the app says "failed to fetch"

The backend is asleep. Open these two and wait for each to answer, then reload
the app:

1. <https://corri-control-api.onrender.com/v1/health>
2. <https://corri-mock-wema-receiver.onrender.com/v1/wema/messages>

The first request after an idle spell takes up to a minute while the server
starts. Everything after that is fast.

---

## ⚙️ How to Set Up and Run Locally

Install [Node.js](https://nodejs.org) 22.14 or newer, then `npm install -g pnpm`.

```bash
git clone https://github.com/Wema-Hackaholics-Hackathon/wema-hackaholics7-0-hackathon-yabatech-project-repro.git
cd wema-hackaholics7-0-hackathon-yabatech-project-repro
pnpm install
pnpm dev
```

No setup, no database, no keys to fill in. Then open:

| What          | Address                                  |
| ------------- | ---------------------------------------- |
| **ALAT demo** | <http://localhost:3002>                  |
| Corri API     | <http://localhost:3000/v1/health>        |
| Bank inbox    | <http://localhost:3001/v1/wema/messages> |

`pnpm check` runs the tests, types, and build.

More detail lives in [docs/](docs/): the
[SDK reference](docs/SDK.md), what Corri may store
([privacy boundary](docs/TRUST_BOUNDARY.md)), and how this repo tracks the
original project ([upstream](docs/UPSTREAM.md)).
