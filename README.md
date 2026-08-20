# Corri

## Team Members

- Agape Miteu
- Michael Omoniyi

---

## 🚀 Live Demo

- **Live Application:** <https://corri-alat-demo.vercel.app>
- **Backend API:** <https://corri-control-api.onrender.com/v1/health>
- **Scenario walkthrough:** <https://corri-live.vercel.app>
- **Recorded Demo:** TODO: add the Loom link

---

## 🎯 The Problem

> **How might we** let a customer raise a request at a bank branch without the
> infrastructure in the middle ever reading what they wrote?

Routing a customer's message through a middle service means that service holds
readable complaints, account references, and location history. That is a privacy
liability for the customer and a compliance liability for the bank.

## ✨ Our Solution

Corri lets an opted-in app recognise a branch visit and send an **encrypted**
customer request to the bank that owns the branch.

```text
Customer writes in ALAT -> ALAT encrypts -> Corri relays ciphertext
  -> Wema verifies and decrypts -> ALAT receives a delivery receipt
```

The message is sealed with an AES-256-GCM key, and that key is wrapped with the
bank's RSA-OAEP public key. Only the bank can open it. Corri moves ciphertext it
cannot read.

---

## 🛠️ Tech Stack

| Layer    | Built with                                       |
| -------- | ------------------------------------------------ |
| Frontend | Next.js, React 19, Tailwind CSS                  |
| Backend  | NestJS on Fastify, TypeScript, Zod               |
| Data     | In-memory. No customer data is stored, by design |
| Crypto   | AES-256-GCM payloads, RSA-OAEP key wrapping      |
| Deploy   | Vercel (frontend), Render (backend)              |
| Tooling  | pnpm workspaces, Turborepo, Vitest               |

---

## ⚙️ Run It Locally

Install [Node.js](https://nodejs.org) 22.14+, then `npm install -g pnpm`.

```bash
git clone https://github.com/Wema-Hackaholics-Hackathon/wema-hackaholics7-0-hackathon-yabatech-project-repro.git
cd wema-hackaholics7-0-hackathon-yabatech-project-repro
pnpm install
pnpm dev
```

No configuration, no database, no API keys. Then open:

| What            | Address                                  |
| --------------- | ---------------------------------------- |
| **ALAT demo**   | <http://localhost:3002>                  |
| Corri live site | <http://localhost:3003>                  |
| API health      | <http://localhost:3000/v1/health>        |
| Bank inbox      | <http://localhost:3001/v1/wema/messages> |

Press `Ctrl` + `C` to stop. Run `pnpm check` to run lint, types, tests, build.

**Trouble?** `pnpm` not found → reopen your terminal. Port in use → close
whatever holds 3000-3003. Install broke → delete `node_modules`, run
`pnpm install` again.

---

## 🔌 Backend API

Base URL is `http://localhost:3000` locally, or your Render URL once deployed.
All responses are JSON.

### Corri API

| Method | Endpoint                          | Purpose                            |
| ------ | --------------------------------- | ---------------------------------- |
| GET    | `/v1/health`                      | Service status. Check it is up     |
| GET    | `/v1/demo/catalog`                | Demo tenant, branches, public keys |
| GET    | `/v1/demo/branches`               | Demo branch list                   |
| GET    | `/v1/demo/analytics`              | Delivery latency, visit duration   |
| GET    | `/v1/demo/privacy`                | What Corri did and did not store   |
| POST   | `/v1/demo/configurations/publish` | Publish a signed configuration     |
| GET    | `/v1/sdk/configuration`           | Signed config the SDK verifies     |
| GET    | `/v1/sdk/branches/nearby`         | Branches near a coordinate         |
| POST   | `/v1/sdk/visits/events`           | Report approach, start, exit       |
| POST   | `/v1/sdk/deliveries`              | Send an encrypted request          |
| GET    | `/v1/sdk/deliveries/:eventId`     | Delivery receipt and status        |

The SDK sends this header on `/v1/sdk/*`, and CORS allows it. The demo API
does not enforce it yet, so requests succeed without it. The value comes from
`publicApplicationKey` in `/v1/demo/catalog`:

```text
x-corri-public-application-key: corri_demo_public_application_key_not_for_production
```

### Bank receiver

| Method | Endpoint              | Purpose                         |
| ------ | --------------------- | ------------------------------- |
| GET    | `/v1/wema/messages`   | What the bank has decrypted     |
| POST   | `/v1/wema/deliveries` | Where Corri delivers ciphertext |

### Try it

```bash
curl http://localhost:3000/v1/health
curl http://localhost:3000/v1/demo/catalog
curl http://localhost:3001/v1/wema/messages
```

---

## 🌐 Deploy

### Backend, on Render, free

1. Sign up at <https://render.com>. No card needed for free services.
2. **New** → **Blueprint** → pick this repository. It reads `render.yaml` and
   shows two services.
3. Render asks for two values on `corri-control-api`:
   - `CORRI_CORS_ORIGINS` → your frontend URL
   - `WEMA_DEMO_WEBHOOK_URL` → leave blank for now, fixed in step 5
4. **Apply**, then wait for both to go green. First build takes a few minutes.
5. Copy the receiver URL, then set `WEMA_DEMO_WEBHOOK_URL` on
   `corri-control-api` to that URL plus `/v1/wema/deliveries`. Save.
6. Confirm: open `https://corri-control-api.onrender.com/v1/health`.

> Free services sleep after ~15 minutes idle and take ~50s to wake. Open the
> link once before demoing. Data is in memory and resets on restart, which is
> fine because the demo seeds itself on startup.

### Frontend, on Vercel, free

The ALAT demo is `apps/alat-demo`. **Deploy the backend first** — it calls the
API on startup and shows an error if that fails.

```bash
vercel link
vercel deploy --prod
```

Set **Root Directory** to `apps/alat-demo` and switch on **Include source files
outside of the Root Directory** (this is a pnpm workspace). Then set
`NEXT_PUBLIC_CORRI_API_BASE_URL` to your Render URL, plus the other
`NEXT_PUBLIC_*` values from `.env.example`. Finally add the Vercel URL to
`CORRI_CORS_ORIGINS` on Render, or the browser blocks every request.

---

## 📁 Structure

| Path                          | Purpose                        |
| ----------------------------- | ------------------------------ |
| `apps/alat-demo`              | **ALAT frontend**              |
| `apps/control-api`            | Corri API                      |
| `apps/mock-wema-receiver`     | Stand-in for the bank endpoint |
| `packages/corri-react-native` | `@corri/sdk`                   |
| `packages/crypto-envelope`    | Encryption and payload hashing |
| `packages/contracts`          | Shared types and validation    |
| `website`                     | Public site and scenario demo  |

## 📚 Docs

| Guide                                      | For                                |
| ------------------------------------------ | ---------------------------------- |
| [Getting started](docs/GETTING_STARTED.md) | Building on Corri                  |
| [SDK reference](docs/SDK.md)               | Adding `@corri/sdk`                |
| [Privacy boundary](docs/TRUST_BOUNDARY.md) | What Corri may store               |
| [Upstream](docs/UPSTREAM.md)               | How this tracks `agapemiteu/corri` |

Demo keys in `apps/mock-wema-receiver/src/demo-keys.ts` are throwaway keypairs
committed on purpose so the demo runs with no setup. They are not production
credentials.
