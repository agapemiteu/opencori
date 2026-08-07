# Corri

Corri lets an opted-in app recognise a branch visit and send an encrypted customer
request to the organisation that owns the branch.

The host app encrypts the request. Corri handles branch presence, encrypted delivery,
and the receipt. Corri does not need readable complaints or banking data.

> Hackathon status: the backend flow and SDK work. The visual ALAT, receiver, and
> developer-console screens are still being built.

## Run it

Requires Node.js 22.14+ and pnpm 11+.

```bash
git clone https://github.com/agapemiteu/corri.git
cd corri
pnpm install
pnpm dev
```

| Service            | URL                                      |
| ------------------ | ---------------------------------------- |
| Corri API          | <http://localhost:3000/v1/health>        |
| Demo configuration | <http://localhost:3000/v1/demo/catalog>  |
| Mock Wema receiver | <http://localhost:3001/v1/wema/messages> |

A frontend can run on `http://localhost:3002`. There is no visual app on
`main` yet.

Run `pnpm check` before opening a pull request.

## Use the SDK

```bash
npm install @corri/sdk
```

Choose one guide:

| Goal                                  | Guide                                      |
| ------------------------------------- | ------------------------------------------ |
| Fork Corri and build the ALAT screens | [Getting started](docs/GETTING_STARTED.md) |
| Add `@corri/sdk` to another app       | [SDK reference](docs/SDK.md)               |
| Check what Corri may store            | [Privacy boundary](docs/TRUST_BOUNDARY.md) |

## How it works

```text
Customer writes in ALAT
  -> ALAT encrypts
  -> Corri relays ciphertext
  -> Wema verifies and decrypts
  -> ALAT receives a delivery receipt
```

The same SDK state machine handles approach, confirmation, visit timing, and exit.
The demo reports delivery latency, visit duration, and privacy-safe evidence.

## Repository map

| Path                          | Purpose                                        |
| ----------------------------- | ---------------------------------------------- |
| `apps/control-api`            | Configuration, visits, delivery, and analytics |
| `apps/alat-demo`              | Tested ALAT host integration                   |
| `apps/mock-wema-receiver`     | Receiver verification and decryption           |
| `packages/corri-react-native` | Source for `@corri/sdk`                        |
| `packages/contracts`          | Shared types and validation                    |

The demo uses in-memory storage, demo keys, and non-production branch coordinates.
