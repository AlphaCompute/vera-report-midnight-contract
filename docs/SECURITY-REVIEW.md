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

## Second-pass review

The generated ZK IR was inspected alongside the public query transcripts: evidence/opening input limbs feed commitment hashes, while disclosed values are the computed commitment/tag and ledger operations. No further exploitable evidence-circuit defect was established in this pass. This does not establish proof-system soundness or verify a deployed contract.

Additional verified build issues and fixes:

- `COMPACT_SKIP_ZK=0` previously skipped proving artifacts because the shell tested string presence. Only `0` (full) and `1` (skip) are now accepted; other values fail.
- Compact can return success when its proving-key tool is unavailable. Full builds now require nonempty prover and verifier files for both circuits. Fault-injection tests verify that a success exit without keys is rejected.
- A manifest previously consumed a shared output directory and hashed source only after building. It now compiles into a fresh private directory, disregards inherited skip/output settings, rejects source changes during compilation, validates exact circuit exports/toolchain versions, and retains the successful artifact directory for archival. Tests reproduce stale-artifact and changing-source cases and require no manifest output on failure.
- Compiler and language versions are also pinned in the Compact source so direct compilation cannot silently choose another toolchain. CI action references are pinned to the verified upstream commit IDs rather than mutable tags.

The manifest establishes local build provenance under a trusted compiler and host, not a cryptographic attestation. An actively compromised host/compiler can forge metadata and outputs; a checksum manifest does not replace compiler supply-chain verification or deployed-key comparison.

## September 14 contract and application integration review

Re-reviewed the V2 source against VERA staging `f8e1ffdffca0c1c175e45360f7162bc746a72a2d`. The application's `whistleblowerV2.compact` is byte-identical to this contract. The separately installed client helper and application AES-GCM opening adapter produce the same commitments/tags; generated circuits accept them and reject wrong evidence and replay. An additional mixed-history test performs 24 submissions with repeated evidence, altered-opening attacks and serialized-state restoration, checking membership and counts throughout.

A new build regression reproduced stale-key acceptance in the ordinary `npm run build` path: a compiler exiting zero without producing keys inherited old artifacts and passed. Compilation now uses a fresh directory and publishes only after checking the new output. Skip builds also cannot retain old proving keys. The isolated manifest path already rejected this case.

Application integration findings are addressed in a companion VERA change: fail closed on missing newly compiled keys; support explicitly selected V2 deployment constructor arguments/assets; require a successful finalized deployment receipt and report its actual transaction hash; compare deployed V2 verifier keys using the SDK before accepting a matching deployment domain. The prior direct-call workaround skipped `findDeployedContract` and therefore also skipped its key comparison. Tests cover the new boundaries, including real SDK comparison against ledger-v8 contract operations.

No V2 circuit semantics changed in this review. The upstream default branch still contains the legacy membership defect until this PR is merged. V2 activation, actual deployed keys/maintenance authority, prover confidentiality, live finalization and independent review remain external acceptance requirements. The repository is publicly visible; do not place confidential operational findings or credentials here.

## Private proving transport review — September 14 follow-up

The V2 circuit was rechecked for membership, replay atomicity, commitment/domain separation and public disclosure. No additional circuit-logic exploit was established. The review did reproduce a new application confidentiality issue in the pinned Midnight JS 4.0.4 HTTP proof client: HTTP 307 redirects resend a compiled V2 proving payload to a second server. In a loopback-only test using synthetic digest/opening values, the second server received a 503-byte serialized proving payload. No real reporter data or remote recipient was used.

VERA's companion change replaces both the application contract and wallet proof HTTP boundaries with redirect refusal, an overall timeout, bounded streamed responses and generic errors without server bodies, URLs or nested causes. It retains ledger-v8 payload/key encoding and transient 500/503 retries. Cross-repository CI compares the actual encoded V2 request bytes against the pinned SDK. Missing application proving keys fail before network I/O; ledger-native server-managed keys retain the SDK fallback.

This mitigation does not make the selected prover untrusted: it receives the private evidence digest and opening by design. Use an approved prover and encrypted transport or an appropriately isolated loopback path. Both restored and newly created wallets explicitly select the protected proving service. Synthetic transport compatibility tests cover native server-managed keys as well as application keys; they do not establish live wallet balancing or network acceptance. Deployment source identity, maintenance authority, endpoint/network controls, live finality and independent cryptographic review remain necessary acceptance work.
