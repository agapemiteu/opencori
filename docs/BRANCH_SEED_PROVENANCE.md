# Demo Branch Seed Provenance

Last checked: 2026-08-03

The first vertical slice includes ten representative Wema demo records across ten Nigerian
regions. These records are test and presentation fixtures, not a production branch registry.
Every record has `metadata.demoData: true` and `metadata.productionEligible: false`.

## Wema-owned sources

- Wema contact page: <https://www.wemabank.com/contact-us>
  - Supports the name and address used for the Marina demo record: 54 Marina, Lagos Island.
- Wema support branch sort-code index:
  <https://purpleconnect.wemabank.com/support/solutions/folders/67000566977>
  - Supports the published branch names, states, and sort codes used from Abia, Abuja,
    Akwa Ibom, Bauchi, Bayelsa, and Delta.
- Wema support branch sort-code index, page 2:
  <https://purpleconnect.wemabank.com/support/solutions/folders/67000566977/page/2>
  - Supports the published branch names, states, and sort codes used from Kaduna, Kano,
    and Kogi.

## Coordinate rules

- The Marina coordinate is explicitly `ESTIMATED`, demo-only, and not bank-verified.
- The other nine records are `MISSING` and cannot enter nearby-branch results.
- No address or coordinate is inferred for records where the cited source does not supply one.
- A bank-approved export remains required before any record becomes production-eligible.

The seed is deterministic. Its fixed retrieval label is part of test evidence, not a statement
that the public pages are a live production integration.
