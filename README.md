# VERA evidence commitment contract

**Review candidate only: do not deploy this revision until the disclosure and migration blockers in the security review are resolved.**

The build target is `contracts/midnight/whistleblower.compact`. It records public evidence commitments, rejects reused nullifiers and verifies evidence membership against the current accumulator. It does not encrypt evidence, authenticate reporters, prove report truth or enforce a per-person rate limit. A caller can generate fresh nullifiers. Public commitments and transaction timing remain observable.

## Build and test

Use Node 22 or later and Compact **0.30.0**, targeting ledger 8 and compact-runtime **0.15.0**. Install the compiler from the official [Compact release](https://github.com/midnightntwrk/compact/releases/tag/compactc-v0.30.0).

```sh
npm ci
COMPACTC=/path/to/compactc COMPACT_SKIP_ZK=1 npm test
COMPACTC=/path/to/compactc npm run build
```

The test command compiles executable circuits and runs adversarial runtime tests without proving keys. The full build generates proving artifacts. Neither test is a live network acceptance run.

## Deployment boundary

This revision adds ledger sets and changes circuit verification keys. It requires a **new deployment and application artifact/address migration**, not a source-only replacement at the existing address. Preserve the old address and receipts for historical verification. The new contract does not import historical commitments or used nullifiers. Do not treat legacy receipts as membership proofs in the new ledger. Select the correct network and validate proof-server/ledger compatibility before deployment. No deployment is performed by these scripts.

See [security review](docs/SECURITY-REVIEW.md). Files under `legacy/` are unsafe, unsupported reference scaffolds and are intentionally excluded from the build. They must not be deployed or used to custody assets.
