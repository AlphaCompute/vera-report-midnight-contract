# Security review — September 11, 2026

Scope: application-owned contract source at upstream commit `44242a6`, the README, and the proposed changes. GitHub reports this repository as public. The vendored TON library was compared with upstream; it has custom extensions and was not independently audited. This is a source review and executable circuit regression check, not an independent audit or a guarantee of no defects.

## Evidence contract — reproduced findings and candidate repairs

- **High: false membership verification.** `verifySubmission` ignored `evidenceHash`; any hash passed when given the public accumulator. The new public commitment set requires actual membership. Tests exercise an unrelated hash with the correct root and historical membership after another insertion.
- **High: duplicate nullifiers accepted on-chain.** A hash accumulator cannot enforce uniqueness. The new nullifier set rejects replay in the circuit. The application-side database remains a defense in depth, not the contract authority. The failed replay regression checks that neither count nor membership changes.
- **Remaining design limits:** unrestricted callers can submit arbitrary commitments and fresh nullifiers; this is not Sybil resistance, identity authorization, evidence validity, encryption or an anti-spam rate limit. Public sets increase storage and expose commitments/nullifiers. Never submit plaintext evidence or identity-derived low-entropy values. Historical membership and nullifier state do not migrate automatically.

## Vault — critical, excluded from deployment

The old scaffold is retained in `legacy/vault.compact` for reference only. It fails to parse on Compact 0.30.0 and has no deployable artifact here.

- `createVault` can reset ownership and state without a one-time initialization guard.
- Owner checks compare a caller argument to a public ledger key, so knowledge of that public key substitutes for authority.
- `currentTime` is an unconstrained caller witness; it cannot enforce expiry or heartbeat time.
- Claim checks compare a supplied public accumulator to its ledger value without proving beneficiary membership or secret ownership.
- Comparing a newly computed hash to the previous accumulator does not enforce one claim per beneficiary.
- No asset custody, asset registration, balance accounting or transfer is implemented despite the previous README claim.

Do not patch these into an apparent asset vault without an agreed custody and authorization model. A replacement needs constructor-only initialization, secret/signature authorization, ledger-constrained time, explicit beneficiary membership, consumed-claim state and actual asset transfer invariants, with adversarial circuit tests and an independent audit before funds are placed at risk.

## TON — excluded from deployment

`legacy/midnit_ton.fc` has an empty internal-message handler and implements no bridge or withdrawal behavior. It must not receive assets. The vendored standard library is dependency code, not a bridge implementation.

## Assurance and migration

The evidence regression suite executes compiler-generated circuits using the pinned runtime. Full proving-key generation and a network proof/receipt run are separate checks. Reconcile generated artifacts in the application repository and perform an explicit new-address rollout; do not silently change historical verification semantics. No active contract or wallet was modified during this review.

## Additional critical review and release blockers

### High: the candidate changes the privacy boundary

The new sets publish raw `evidenceHash` and `nullifier` values. This is a deliberate disclosure, not hidden storage. The application at `AlphaCompute/vera` commit `6d11ee4a2f59d3c8de769cc240a05d22e4b410f3` hashes the description followed by file bytes without a random salt (`src/api/whistleblower.ts:411`). Publishing that digest allows observers to test guessed text or known documents and correlate identical submissions. The status endpoint deliberately withholds nullifiers as identity-adjacent data (`src/api/whistleblower.ts:779`). A high-entropy secret in nullifier derivation limits guessing, but publication still changes the application's disclosure boundary.

**Do not deploy this candidate with the existing application.** First choose and implement a privacy-preserving membership scheme or an explicitly accepted randomized-commitment protocol, including secret retention and receipt verification. A public hash is not automatically an anonymous commitment. Hashing an unsalted hash again does not fix guessability. Public membership queries also reveal the queried value in this candidate.

### High: source and deployed contract identity are not established

The upstream README displays transaction `00e955d977facbc568c29101e92799e68c88a94570d5bf1f5c0dc6efa6ffc64c5d` but links to a different transaction, `0x97d5d5c0b796fa756b6795436bab5274808434449fb6acbfee30782afcd35273`. No reproducible deployment manifest binds the listed address to this source, compiler, verifier keys, network, or maintenance authority. Neither the original nor candidate source should be represented as the verified deployed contract based on that table. Capture and independently compare these values before migration; this review did not query authenticated production infrastructure.

### Medium: global mutable roots create contention and stale verification

Every submission updates shared accumulators. `verifySubmission` requires the current root, so unrelated submissions can invalidate a prepared verification. The candidate supports membership of earlier evidence at the current root, not proofs anchored at arbitrary historical roots. Runtime tests confirm stale roots reject; network throughput, transaction contention and proof retry costs remain unmeasured. The public sets also grow without a contract-level bound.

### Protocol limits: uniqueness, authorization and auditability

A nullifier is caller-chosen, not proven to derive from an identity, report or secret. Any caller can use a fresh value; the same evidence hash can be submitted repeatedly with different nullifiers. `evidenceCount` therefore counts accepted calls, not distinct documents, reporters or valid reports. Membership does not bind a particular evidence hash to a particular nullifier, caller or transaction. If a nullifier becomes known before acceptance, another caller may consume it first; no ownership proof prevents that. These are protocol design limits, not fixed by a set.

The original comment claims an auditor can replay all transactions to detect duplicate nullifiers, but the original circuit discloses accumulator outputs rather than the raw inputs. The repository supplies neither an input-disclosure protocol nor a replay verifier. The hash chain alone does not substantiate public duplicate auditing.

The application currently verifies a trusted relay's finalized `submitEvidence` receipt bound to the evidence hash, nullifier and transaction; `docs/MVP-PROOF-RECOVERY.md` explicitly excludes the defective `verifySubmission` circuit from intake. This limits the direct impact on that intake path, but does not make the exported membership API correct or the receipt an independently reconstructed inclusion proof.

### Legacy TON library and build scope

The vendored library at `legacy/imports/stdlib.fc` is not an untouched standard library: comparison against `ton-blockchain/ton` commit `3d478cbde854be03a18ab2a59f8fc3c565cf7d14`, `crypto/smartcont/stdlib.fc`, shows custom message-building, fee and send-mode helpers. Its SHA-256 is `c89ed4650e333896513036fa7a0ded70c90e5599e4ab527f21715a0b45142119`. No pinned original provenance or executable coverage of those helpers is supplied. The existing LGPL header is preserved. Moving the library with the scaffold preserves its relative include path and excludes both from the supported build. No TON execution or asset-safety assurance is claimed.

## Validation evidence

- Compiled the unmodified upstream evidence circuit with Compact 0.30.0 and executed it with runtime 0.15.0: an unknown hash on an empty ledger returned `1n`; two submissions with the same nullifier produced count `2n`; another unknown hash with the current root returned `1n`.
- The candidate tests cover unknown membership, empty-ledger rejection, replay without state changes, recovery after rejection, historical evidence at the current root, stale-root rejection, repeated evidence with fresh nullifiers and cross-ledger isolation.
- The legacy vault fails at line 5 with a parse error on `export ledger {`. Its authorization and timing findings are source-level design defects, not a claim of a successful deployed exploit.
- The pinned dependency lockfile reported zero known advisories under `npm audit` on September 11, 2026. This does not audit the compiler or prove runtime correctness.
- The compiler release archive is checksum-verified in CI. Full proving-key generation is checked separately from executable circuit tests; neither constitutes proof-server or live-ledger acceptance.

References: [Compact disclosure and witness semantics](https://docs.midnight.network/compact/reference/compact-reference), [public ledger types](https://docs.midnight.network/compact/data-types/ledger-adt), and [pinned compiler release](https://github.com/midnightntwrk/compact/releases/tag/compactc-v0.30.0).
