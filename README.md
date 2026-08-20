# Corri

## Team Members

- Agape Miteu
- Michael Omoniyi

---

## 🚀 Live Demo

- **Live Application:** TODO: add the deployed URL before submission
- **Backend API:** TODO: add the deployed control-api URL before submission
- **Recorded Demo:** TODO: add the Loom walkthrough link before submission

---

## 🎯 The Problem

> **How might we** let a customer raise a request at a bank branch without the
> infrastructure in the middle ever reading what they wrote?

Branch queues waste customer time. The usual fix is to route the customer's
message through a middle service, which means that service holds readable
complaints, account references, and location history. That is a privacy
liability for the customer and a compliance liability for the bank.

## ✨ Our Solution

Corri lets an opted-in app recognise a branch visit and send an encrypted
customer request to the organisation that owns the branch.

The host app encrypts the request. Corri handles branch presence, encrypted
delivery, and the receipt. Corri never needs readable complaints or banking
data.

```text
Customer writes in ALAT
  -> ALAT encrypts
  -> Corri relays ciphertext
  -> Wema verifies and decrypts
  -> ALAT receives a delivery receipt
```

The payload is sealed with an AES-256-GCM data key, and that data key is
wrapped with the receiver's RSA-OAEP public key. Only the receiver holds the
private key, so the relay moves ciphertext it cannot open. The same SDK state
machine handles approach, confirmation, visit timing, and exit, and the demo
reports delivery latency, visit duration, and privacy-safe evidence.

Status: the backend flow and the SDK work end to end and are covered by tests.
The visual ALAT, receiver, and developer-console screens are still being built.

---

## 🛠️ Tech Stack

- **Frontend:** Next.js 16 (ALAT demo) and Next.js 15 (live site), React 19, Tailwind CSS 4
- **Backend:** NestJS 11 on Fastify, TypeScript, Zod for contract validation
- **Database:** In-memory repositories. The demo stores no customer data, by design
- **Deployment:** Vercel
- **Crypto:** Node Web Crypto, AES-256-GCM payload encryption with RSA-OAEP key wrapping
- **Tooling:** pnpm workspaces, Turborepo, Vitest, ESLint, Prettier, tsup

---

## ⚙️ How to Set Up and Run Locally

Requires Node.js 22.14+ and pnpm 11+.

1. Clone the repository:

   ```bash
   git clone https://github.com/Wema-Hackaholics-Hackathon/wema-hackaholics7-0-hackathon-yabatech-project-repro.git
   ```

2. Navigate to the project directory:

   ```bash
   cd wema-hackaholics7-0-hackathon-yabatech-project-repro
   ```

3. Install dependencies:

   ```bash
   pnpm install
   ```

4. Copy `.env.example` to `.env` and adjust if needed. The defaults work for
   local development:

   ```bash
   CORRI_HOST=0.0.0.0
   CORRI_PORT=3000
   CORRI_SERVICE_VERSION=0.0.0
   CORRI_CORS_ORIGINS=http://localhost:3002
   NODE_ENV=development
   WEMA_DEMO_WEBHOOK_URL=http://127.0.0.1:3001/v1/wema/deliveries
   ```

5. Run the development server:

   ```bash
   pnpm dev
   ```

| Service            | URL                                      |
| ------------------ | ---------------------------------------- |
| Corri API          | <http://localhost:3000/v1/health>        |
| Demo configuration | <http://localhost:3000/v1/demo/catalog>  |
| Mock Wema receiver | <http://localhost:3001/v1/wema/messages> |
| ALAT demo frontend | <http://localhost:3002>                  |
| Corri live site    | <http://localhost:3003>                  |

Run `pnpm check` to execute the full quality gate: format check, lint,
typecheck, tests, and build.

---

## ▲ Deploying to Vercel

This is a pnpm + Turborepo monorepo with two deployable frontends, so link the
whole repo rather than a single project:

```bash
vercel link --repo
```

That writes `.vercel/repo.json`, which is gitignored. Set the Root Directory
per Vercel project:

| Vercel project | Root Directory   | Notes                            |
| -------------- | ---------------- | -------------------------------- |
| Live site      | `website`        | Self-contained. Needs no backend |
| ALAT demo      | `apps/alat-demo` | Needs a reachable control-api    |

Leave "Include files outside the Root Directory" enabled so Vercel can read
`pnpm-workspace.yaml`, `pnpm-lock.yaml`, and the shared `packages/*`.

`website` has no required environment variables. `apps/alat-demo` falls back to
localhost defaults, so set the `NEXT_PUBLIC_*` values from `.env.example` in the
Vercel project before deploying it. They are inlined at build time, and
`turbo.json` includes `NEXT_PUBLIC_*` in the `build` task's cache key so changing
one triggers a rebuild.

`apps/control-api` and `apps/mock-wema-receiver` are long-running NestJS servers
and are not configured for Vercel. Host them elsewhere, or leave the live site
as the demo surface.

---

## 📁 Repository Structure

| Path                              | Purpose                                        |
| --------------------------------- | ---------------------------------------------- |
| `apps/control-api`                | Configuration, visits, delivery, and analytics |
| `apps/alat-demo`                  | ALAT host integration                          |
| `apps/mock-wema-receiver`         | Receiver verification and decryption           |
| `packages/corri-react-native`     | Source for `@corri/sdk`                        |
| `packages/contracts`              | Shared types and validation                    |
| `packages/crypto-envelope`        | Envelope encryption and payload hashing        |
| `packages/geofence-state-machine` | Approach, visit, and exit state transitions    |
| `packages/config-verifier`        | Tenant configuration verification              |
| `website`                         | Public site and interactive scenario demo      |

## 📚 Documentation

| Goal                                    | Guide                                                    |
| --------------------------------------- | -------------------------------------------------------- |
| Build on Corri and add the ALAT screens | [Getting started](docs/GETTING_STARTED.md)               |
| Add `@corri/sdk` to another app         | [SDK reference](docs/SDK.md)                             |
| Check what Corri may store              | [Privacy boundary](docs/TRUST_BOUNDARY.md)               |
| Where the branch coordinates came from  | [Branch seed provenance](docs/BRANCH_SEED_PROVENANCE.md) |

The demo uses in-memory storage, demo keys, and non-production branch
coordinates. The keys in `apps/mock-wema-receiver/src/demo-keys.ts` are
throwaway demo keypairs committed on purpose so the receiver runs without setup.
They are not production credentials.
