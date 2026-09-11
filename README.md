# VERA evidence commitment contract

Records randomized evidence commitments on Midnight. Evidence digests and commitment openings stay private to the caller/prover. The contract verifies actual membership and prevents reusing the same opening within a deployment. It does not encrypt files, authenticate reporters, establish report truth or provide per-person rate limiting.

## Build and test

Use Node 22 or later and Compact **0.30.0**, targeting ledger 8 and compact-runtime **0.15.0**. Install the compiler from the official [release](https://github.com/midnightntwrk/compact/releases/tag/compactc-v0.30.0).

```sh
npm ci
COMPACTC=/path/to/compactc COMPACT_SKIP_ZK=1 npm test
COMPACTC=/path/to/compactc npm run build
```

Tests execute generated circuits. The full build generates proving artifacts. Neither is live network acceptance.

## V2 protocol

Initialize a fresh deployment with `createDeploymentDomain()` from `client/commitments.mjs`. For each new submission, generate `createOpening()` and persist it in protected storage before sending a transaction. Call `submitEvidenceV2(evidenceHash, opening)`. Use the same retained opening to reconcile that submission or call `verifySubmissionV2(evidenceHash, opening)`.

Only a domain-separated randomized commitment and replay tag are public. `publicReceipt(domain, evidenceHash, opening)` reproduces these values with the pinned runtime encoding and excludes the secrets. Never send the opening, evidence hash, circuit proof inputs or private storage records to logs, public signals, telemetry or an untrusted proof server. Randomness quality cannot be proved by this circuit: callers must use fresh CSPRNG output.

Verification reveals which randomized commitment is queried. Transaction timing, counts, payer metadata and repeated verification remain observable. This is not an unlinkable anonymous membership protocol.

## Migration

**This is a breaking protocol requiring a new deployment and application integration.** Old circuit names are absent, so existing clients fail rather than reuse old nullifiers as secrets. Historical commitments are not imported. Preserve old addresses and receipts with their original verification semantics. Follow [migration instructions](docs/MIGRATION.md) before deployment.

The unsafe vault and empty TON bridge have been removed from this branch. Their original source remains in upstream git history; this repository supplies no asset custody or bridge implementation.

See the [security review](docs/SECURITY-REVIEW.md) for findings, fixes and remaining assurance limits.
