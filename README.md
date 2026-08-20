# Corri

## Team Members

- Agape Miteu
- Michael Omoniyi

---

## 🚀 Live Demo

- **Live Application:** <https://corri-live.vercel.app>
- **Backend API:** not deployed yet. See [Put the backend online](#-put-the-backend-online-10-minutes)
- **Recorded Demo:** TODO: add the Loom walkthrough link before submission

**Nothing to install.** Open the link, pick a scenario on the left, and press
**Run this journey**. Seven scenarios are included, such as a normal branch
visit, a customer just walking past, and the bank's endpoint being down.

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

---

## 🛠️ Tech Stack

- **Frontend:** Next.js 16 (ALAT demo) and Next.js 15 (live site), React 19, Tailwind CSS 4
- **Backend:** NestJS 11 on Fastify, TypeScript, Zod for contract validation
- **Database:** In-memory repositories. The demo stores no customer data, by design
- **Deployment:** Vercel for the frontend, Render for the backend
- **Crypto:** Node Web Crypto, AES-256-GCM payload encryption with RSA-OAEP key wrapping
- **Tooling:** pnpm workspaces, Turborepo, Vitest, ESLint, Prettier, tsup

---

## ⚙️ Run It On Your Computer

You need two things installed first:

1. **Node.js 22.14 or newer.** Download from <https://nodejs.org>. Pick the LTS
   button. Click through the installer.
2. **pnpm.** After Node is installed, open a terminal and run:

   ```bash
   npm install -g pnpm
   ```

Then run these four commands, one at a time:

```bash
git clone https://github.com/Wema-Hackaholics-Hackathon/wema-hackaholics7-0-hackathon-yabatech-project-repro.git
cd wema-hackaholics7-0-hackathon-yabatech-project-repro
pnpm install
pnpm dev
```

That is it. No configuration, no database, no API keys. Everything runs with
working defaults.

Now open these in your browser:

| What                      | Address                                  |
| ------------------------- | ---------------------------------------- |
| Corri live site           | <http://localhost:3003>                  |
| ALAT demo app             | <http://localhost:3002>                  |
| Is the API alive?         | <http://localhost:3000/v1/health>        |
| Demo branches and keys    | <http://localhost:3000/v1/demo/catalog>  |
| Messages the bank receive | <http://localhost:3001/v1/wema/messages> |

To stop everything, press `Ctrl` and `C` in the terminal.

### If something goes wrong

| Problem                   | Fix                                                                   |
| ------------------------- | --------------------------------------------------------------------- |
| `pnpm: command not found` | Close and reopen your terminal, then try `npm install -g pnpm` again  |
| `port already in use`     | Something else is using 3000-3003. Close it, or restart your computer |
| Install fails partway     | Delete the `node_modules` folder and run `pnpm install` again         |
| Wrong Node version        | Run `node --version`. It must say 22.14 or higher                     |

---

## 🔌 Backend API Reference

Every address below starts with a **base URL**. Locally that is
`http://localhost:3000`. Once you deploy, it is your Render address.

All paths begin with `/v1`. Requests and responses are JSON.

### Corri API

| Method | Path                              | What it does                                     |
| ------ | --------------------------------- | ------------------------------------------------ |
| GET    | `/v1/health`                      | Returns service status. Use it to check it is up |
| GET    | `/v1/demo/catalog`                | Demo tenant, branches, and public keys           |
| GET    | `/v1/demo/branches`               | The demo branch list                             |
| POST   | `/v1/demo/configurations/publish` | Publish a signed tenant configuration            |
| GET    | `/v1/demo/analytics`              | Delivery latency and visit duration              |
| GET    | `/v1/demo/privacy`                | What Corri did and did not store                 |
| GET    | `/v1/sdk/configuration`           | Signed config the SDK verifies on start          |
| GET    | `/v1/sdk/branches/nearby`         | Branches near a coordinate                       |
| POST   | `/v1/sdk/visits/events`           | Report approach, visit start, and exit           |
| POST   | `/v1/sdk/deliveries`              | Send an encrypted request                        |
| GET    | `/v1/sdk/deliveries/:eventId`     | Delivery receipt and status                      |

SDK routes need this header:

```text
x-corri-public-application-key: demo-app-key
```

### Mock Wema receiver

Stands in for the bank's real endpoint.

| Method | Path                  | What it does                         |
| ------ | --------------------- | ------------------------------------ |
| GET    | `/v1/wema/messages`   | Everything the bank decrypted so far |
| POST   | `/v1/wema/deliveries` | Where Corri delivers ciphertext      |

### Try it right now

With `pnpm dev` running, paste this into a terminal:

```bash
curl http://localhost:3000/v1/health
curl http://localhost:3000/v1/demo/catalog
curl http://localhost:3001/v1/wema/messages
```

---

## 🌐 Put The Backend Online (10 minutes)

The backend is two small servers. `render.yaml` in this repository sets up both
at once, so you do not configure them by hand.

1. Go to <https://render.com> and sign up. GitHub sign-in is fine. It is free.
2. Click **New**, then **Blueprint**.
3. Choose this repository. Render reads `render.yaml` and shows two services:
   `corri-control-api` and `corri-mock-wema-receiver`.
4. Render asks you for two values. Type these:
   - `CORRI_CORS_ORIGINS` → `https://corri-live.vercel.app`
   - `WEMA_DEMO_WEBHOOK_URL` → leave `http://127.0.0.1:3001/v1/wema/deliveries`
     for now. You fix it in step 6.
5. Click **Apply**. Wait for both services to go green. First build takes a few
   minutes.
6. Copy the receiver's address, which looks like
   `https://corri-mock-wema-receiver.onrender.com`. Open `corri-control-api` →
   **Environment**, and set `WEMA_DEMO_WEBHOOK_URL` to that address plus
   `/v1/wema/deliveries`. Save. It redeploys itself.
7. Check it worked by opening
   `https://corri-control-api.onrender.com/v1/health` in your browser.

Then put your control-api address in the **Backend API** field at the top of
this README.

> **Two things to know about the free plan.** Services go to sleep after about
> 15 minutes of no traffic, and the next visit takes roughly a minute to wake
> up. Open the link once before a demo. Also, data is kept in memory, so
> everything resets whenever a service restarts. That is fine for the demo,
> which seeds itself on startup.

---

## ▲ Deploying The Frontend

The live site is already deployed. To ship a change:

```bash
vercel deploy --prod
```

The Vercel project uses **Root Directory** `website` with **Include source
files outside of the Root Directory** switched on, because this is a pnpm
workspace and `website` depends on files at the repository root.

To also deploy the ALAT demo as a second Vercel project, set its Root Directory
to `apps/alat-demo` and add the `NEXT_PUBLIC_*` values from `.env.example`,
pointing `NEXT_PUBLIC_CORRI_API_BASE_URL` at your Render control-api. Those
values are baked in at build time, so change one and redeploy.

`apps/control-api` and `apps/mock-wema-receiver` are long-running servers and
do not belong on Vercel. That is what the Render step above is for.

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

## 🧪 Checks

`pnpm check` runs the whole quality gate: format check, lint, typecheck, tests,
and build. CI runs the same command on every push.

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
