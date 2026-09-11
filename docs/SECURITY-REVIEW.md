# Security review — September 11, 2026

Scope: contract source at upstream `44242a6`, its documentation and this PR. This is a source review with adversarial execution of generated circuits, not an independent audit or a guarantee of no defects. GitHub reports the repository as public.

## Resolved in this branch

| Finding | Original behavior | Resolution |
| --- | --- | --- |
| High: false inclusion verification | Unknown evidence returns `1` when given the public root, including on an empty ledger. Reproduced against unmodified compiled source. | V2 proves knowledge of an evidence digest and secret opening whose randomized commitment is in the ledger. Wrong digest/opening and empty-ledger tests reject. |
| High: replay | Reusing a nullifier increments the count again. Reproduced against unmodified source. | A domain-separated submission tag is derived inside the circuit from the secret opening; its reuse is rejected before writes. Changing the evidence cannot reuse that opening. |
| High: disclosure in the earlier PR candidate | Public sets exposed raw evidence hashes and old nullifiers. VERA hashes description/file bytes without random salt, permitting known-document matching if published. | Replaced with `persistentCommit` and fresh random openings. No old nullifier input. Tests inspect the public ledger and nonempty public query transcripts for raw digest/opening leakage and cross-check client derivation against generated circuits. |
| Medium: stale-root verification | Any intervening submission invalidates a supplied current-root argument. | Removed rolling accumulators and the root argument. Verification checks an immutable inserted commitment directly and succeeds after other submissions. |
| High: accidental legacy-client compatibility | Old clients could treat identity-derived nullifiers as commitment randomness. | Explicit `submitEvidenceV2` / `verifySubmissionV2` names and a constructor domain. Old circuit entry points are absent. A client helper generates CSPRNG openings. |
| Critical design defects: vault | Unguarded reinitialization; public-key equality in place of ownership; unconstrained witness time; no beneficiary proof; ineffective one-claim check; no actual asset custody. Source does not parse on Compact 0.30.0. | Removed the unsupported vault source. No vault deployment target or custody claim remains. This is removal of unsafe functionality, not delivery of a replacement asset vault. |
| Unsafe TON scaffold and unpinned custom library | Empty internal-message handler implements no withdrawal/bridge. Vendored library differs from upstream and includes custom helpers. | Removed both from the branch. Their source and license headers remain in upstream history. No bridge functionality is shipped or claimed. |
| Misleading security/deployment claims | README claimed anonymity/spam prevention and linked a different transaction from the displayed hash. | Removed unsupported claims and unverified address table. Added build manifest generation and an explicit operator procedure for source/deployment verification. |

## Privacy model

The private opening must be independent 32-byte CSPRNG output, retained off-chain. The evidence commitment is `persistentCommit([evidence-domain-tag, deploymentDomain, evidenceHash], opening)`. The replay tag uses a different domain tag and omits the evidence digest; reusing an opening therefore cannot bind a second document. Both values are computed and constrained inside the circuit, never accepted as unchecked caller inputs. Raw evidence hashes and openings are not explicitly disclosed, stored in ledger fields or returned by the client public-receipt helper.

The public tag cannot be used as the secret to consume the same opening, under the commitment function's cryptographic assumptions. Fresh openings produce different commitments even for identical evidence. Domains separate otherwise identical inputs across deployments. Verification reveals the randomized commitment being checked, so repeated verification is linkable; transaction timing, counts and payer metadata are also public. The prover sees private inputs and must be trusted. Entropy cannot be established from a circuit assertion: rejecting zero catches one bad input but does not prove randomness. Client persistence must keep openings out of public APIs, signals, logs and telemetry.

These operations use the pinned runtime's commitment implementation and encoding. Tests establish consistency and the absence of raw values in observed transcripts; they are not a cryptographic proof of hiding or compiler correctness. See [the official commitment example](https://github.com/midnightntwrk/example-private-party) and [Compact disclosure semantics](https://docs.midnight.network/compact/reference/compact-reference).

## Remaining protocol limits and external acceptance work

- Anyone can submit with a fresh secret and pay the required network costs. This is a permissionless evidence register, not per-person rate limiting, report truth, identity authentication or Sybil resistance. Adding those policies requires a separately specified admission protocol; no ineffective anti-spam claim remains.
- Repeated evidence with fresh randomness is intentionally allowed to avoid exposing document equality. The counter measures accepted calls, not distinct documents or reporters. Public sets grow with submissions. Removal of global hash-chain read/modify/write operations removes that contention source, but no network throughput or cost bound is claimed.
- State and openings from the old deployment do not migrate. The application currently verifies finalized trusted-relay receipts and excludes the defective old `verifySubmission` from intake (`AlphaCompute/vera`, `docs/MVP-PROOF-RECOVERY.md`). Application V2 persistence, receipt handling and deployment must follow [MIGRATION.md](MIGRATION.md); this PR does not silently update that separate repository.
- The actual deployed address, network, verifier keys, upgrade authority and transaction identity remain unverified. Local artifact manifests cannot prove these external facts. Full proof-server/network acceptance and independent security review remain separate checks. No active contract, wallet or production configuration was modified.

## Verification

Runtime regressions cover false membership, wrong secrets, replay and evidence rebinding with all state unchanged, fresh-opening privacy, verification after intervening submissions, public transcript disclosure, substitution of public tags for secrets, client/circuit consistency, deployment isolation, zero/malformed inputs and missing legacy entry points. Full proving-key generation is run separately. CI downloads the pinned compiler with a fixed archive SHA-256 and uses a locked runtime dependency.

The original vault parse failure was at line 5 (`export ledger {`). Its findings are source-level design defects, not claims of a deployed exploit. The original false-membership and replay flaws were reproduced by executing the compiler-generated evidence circuit.
