# Frontend Integration Contract

The frontend engineer owns presentation and interaction design. Backend modules provide a
stable, documented integration surface.

## Backend deliverables before frontend work

- Published `@corri/sdk` and contract package entry points
- Generated OpenAPI document for the control API
- Stable response envelopes and machine-readable error codes
- Seed commands and deterministic demo fixtures
- Typed event schemas for approach, visit, exit, delivery, and diagnostics
- Mock receiver endpoint behavior and signature-verification fixtures
- Clear labels for real, simulated, unavailable, and failed states

## Frontend constraints

- Frontend applications call public API and package interfaces only.
- Frontend applications do not import database schemas or application services.
- Corri screens never display decrypted request content.
- The mock Wema receiver is the only screen allowed to display demo plaintext.
- UI changes cannot redefine domain event names, delivery states, or visit timing rules.

Contract changes require versioning, migration notes, and consumer tests.
