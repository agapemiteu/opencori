# Corri

Walk into a bank and be expected. Corri tells the branch what you need before
you reach the counter, and cannot read the message itself.

## Team Members

- Agape Miteu
- Michael Omoniyi

---

## 🚀 Live Demo

- **Live Application:** <https://corri-alat-demo.vercel.app>
- **Backend API:** <https://corri-control-api.onrender.com/v1/health>
- **Recorded Demo:** TODO: add the Loom link

> The backend sleeps when idle. If the app shows an error, open the API link
> above, wait for it to answer, then reload. Up to a minute the first time,
> instant afterwards.

---

## 🎯 The Problem

> **How might we** make a branch visit feel expected, so customers are served
> faster instead of queueing and explaining themselves from scratch?

You take a number and wait. Twenty minutes, an hour, sometimes longer. You get
to the counter and start from zero: who you are, what you need, what went wrong.
The teller opens your account while you talk. Nobody in that branch knew you
were coming, or why.

The branch is just as blind. It cannot see how many people are inside, what they
came for, or who has been sitting there an hour. It finds out a visit went badly
only if the customer complains, and most people just leave annoyed.

The obvious fix is to let people say what they need before they arrive. But
every version of that hands a middleman your complaints, your account details,
and a record of which branch you were in and when. Fixing the queue by creating
a privacy problem is not a fix.

## ✨ Our Solution

Corri lives inside ALAT. No new app, no new account.

1. You get near a Wema branch. ALAT asks if you are visiting.
2. You say yes and pick what you need.
3. Your phone locks the message before it leaves your phone.
4. Corri carries it to the bank and cannot open it.
5. The bank unlocks it. The teller is ready before you reach the counter.
6. ALAT confirms it arrived.

**Only the bank holds the key. Corri is the courier, not the reader.**

### What the customer gets

Your complaint is already at the counter before you are. The teller has read it,
pulled your account and, if it needs a manager or a card printed, started that
while you were still in the queue. You stop repeating yourself, and the problem
gets resolved in one visit instead of "come back tomorrow".

You also opt in each time. No new app, no new account, and if you say you are
just passing by, nothing is sent at all.

Check that yourself:

```bash
curl "https://corri-control-api.onrender.com/v1/demo/privacy?tenantId=wema&applicationId=alat-demo"
```

It answers `readableRequestContentStored: false` and
`retainedEncryptedPayloadCount: 0`. Last measured delivery: **382ms**, phone to
bank.

---

## 📊 What the Branch Learns

A bank measures everything online and almost nothing inside the most expensive
thing it owns: the building.

**How long you were there.** The clock starts when you check in and stops when
you leave. Ten minutes is a normal visit. Two hours means nobody attended to
you. `/v1/demo/analytics` reports the median and the slowest tenth, so a manager
sees the number without opening anybody's record.

**How it felt.** After the visit ALAT asks for a rating. Score it low and it
offers Long Wait Time, Unresolved Issue, Crowded, Staff Unresponsive. Put that
beside the measured duration and "long wait" stops being an opinion.

**Which branch, and which team.** Every visit carries the branch it happened at,
so Wema can compare Marina against Ikeja on volume and waiting time. And because
only the bank can decrypt a request, only the bank can see what each customer
came for: card issuance, account opening, loans, complaints. That tells the bank
which department is clearing its queue and which is the bottleneck. Corri never
sees any of it, so the insight belongs to the bank alone.

Today the numbers are totalled across all branches. The data is already tagged
by branch and by service, so grouping it is the next step, not a rebuild.

---

## 🎛️ Bank Control

The bank decides when Corri is on. Not us.

**Working now:** a branch can be switched off. New visits are refused and
delivery stops immediately, including for a visit already in progress. That is
the switch a bank needs during a security incident or an unplanned closure.

**Next:** opening hours and public holidays, so it turns itself off at closing
and back on at opening, per branch and in the branch's own timezone. The manual
switch always overrides the schedule, because an emergency is by definition what
the schedule did not predict.

---

## 🛠️ Tech Stack

| Layer      | Built with                                 |
| ---------- | ------------------------------------------ |
| Frontend   | Next.js, React, Tailwind CSS               |
| Backend    | NestJS on Fastify, TypeScript              |
| Database   | None. No customer data is stored           |
| Deployment | Vercel (frontend), Render (backend)        |
| Security   | AES-256-GCM message, RSA-OAEP key wrapping |

---

## 🔌 Backend API

Base URL `https://corri-control-api.onrender.com`

| Method | Endpoint                      | What it does                     |
| ------ | ----------------------------- | -------------------------------- |
| GET    | `/v1/health`                  | Is the service up                |
| GET    | `/v1/demo/privacy`            | What was and was not stored      |
| GET    | `/v1/demo/analytics`          | Delivery speed and visit length  |
| GET    | `/v1/demo/catalog`            | Branches and public keys         |
| GET    | `/v1/demo/branches`           | Branch list                      |
| GET    | `/v1/sdk/configuration`       | Settings the app checks on start |
| GET    | `/v1/sdk/branches/nearby`     | Branches near a location         |
| POST   | `/v1/sdk/visits/events`       | Arriving, visiting, leaving      |
| POST   | `/v1/sdk/deliveries`          | Send a locked message            |
| GET    | `/v1/sdk/deliveries/:eventId` | Did it arrive                    |

Base URL `https://corri-mock-wema-receiver.onrender.com`, standing in for Wema's
own system

| Method | Endpoint              | What it does               |
| ------ | --------------------- | -------------------------- |
| GET    | `/v1/wema/messages`   | Messages the bank unlocked |
| POST   | `/v1/wema/deliveries` | Where Corri drops them off |

---

## ⚙️ Run Locally

Install [Node.js](https://nodejs.org) 22.14+, then `npm install -g pnpm`.

```bash
git clone https://github.com/Wema-Hackaholics-Hackathon/wema-hackaholics7-0-hackathon-yabatech-project-repro.git
cd wema-hackaholics7-0-hackathon-yabatech-project-repro
pnpm install
pnpm dev
```

No configuration, no database, no keys. Then open:

| What          | Address                                  |
| ------------- | ---------------------------------------- |
| **ALAT demo** | <http://localhost:3002>                  |
| Corri API     | <http://localhost:3000/v1/health>        |
| Bank inbox    | <http://localhost:3001/v1/wema/messages> |

`pnpm check` runs lint, types, tests and build. Run it before pushing.

---

## 🗺️ Next

- Opening hours and holidays, so the bank controls availability automatically
- A dwell limit that asks the customer if they are still waiting and flags a
  supervisor
- Break the analytics down by branch and by department, so managers can compare
  performance across the network
- Send the visit rating to the backend so it reaches the analytics

More detail in [docs/](docs/): the [SDK reference](docs/SDK.md) and
[what Corri may store](docs/TRUST_BOUNDARY.md).
