# Corri

## Team Members

- Agape Miteu
- Michael Omoniyi

---

## 🚀 Live Demo

- **Live Application:** <https://corri-alat-demo.vercel.app>
- **Backend API:** <https://corri-control-api.onrender.com/v1/health>
- **Recorded Demo:** TODO: add the Loom link

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

Last measured delivery took **389 milliseconds**, phone to bank.

---

## 🛠️ Tech Stack

- **Frontend:** Next.js, React, Tailwind CSS
- **Backend:** NestJS on Fastify, TypeScript
- **Database:** None. Nothing about the customer is stored
- **Deployment:** Vercel (frontend), Render (backend)
- **Security:** AES-256-GCM to lock the message, RSA-OAEP to lock the key

---

## 🔌 Backend API

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

> The backend sleeps after 15 minutes of no use, on the free plan. Open
> `/v1/health` once and give it a minute before demoing.

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
