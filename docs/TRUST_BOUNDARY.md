# Privacy boundary

Corri handles branch-visit metadata and encrypted delivery. It must not receive banking
records or readable customer requests.

## Corri may process

- Tenant, application, anonymous installation, branch, visit, and event identifiers
- Branch configuration, coordinates, radii, country, and time zone
- Consent state, approach, confirmation, dwell, exit, and cooldown events
- Visit timestamps, duration, source, and measurement confidence
- Bank-defined route keys
- Encrypted payload envelopes, hashes, sizes, expiry, and key identifiers
- Delivery status, attempts, latency, receipts, and destination health
- SDK version, platform, configuration version, and privacy-safe telemetry
- Fallback channel, reason, normalized command, opaque correlation ID, and receipt metadata

## Corri must never receive

- Customer identity, account number, BVN, card details, or credentials
- Account balances, transactions, support history, or banking access tokens
- Plain-text requests, complaints, or support conversations
- Receiver private keys or data-encryption keys in readable form
- Banking decisions, fraud decisions, refunds, reversals, or case-resolution data
- Phone numbers, raw SMS bodies, contact books, or telecom account credentials

## Enforcement rules

1. The host application encrypts request content before calling Corri.
2. Route selection uses a tenant-owned route key, never content inspection.
3. Corri logs neither plaintext, ciphertext, cryptographic keys, nor sensitive headers.
4. Delivery storage retains ciphertext only while delivery or receipt recovery requires it.
5. Tenant identifiers are mandatory at every persistence and service boundary.
6. Proximity is a convenience signal, not proof of presence or authorization.
7. A bank-owned SMS gateway retains phone identity and sends Corri only signed normalized
   commands.
8. Free-form SMS content never enters Corri.

Any proposed change that weakens these rules requires a security review and an explicit ADR.
